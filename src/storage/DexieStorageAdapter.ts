import type { StorageAdapter } from './StorageAdapter';
import type {
  Note,
  Folder,
  NoteCreateInput,
  NoteUpdateInput,
  FolderCreateInput,
  FolderUpdateInput,
} from './types';
import { db as defaultDb, type WickerlyDB } from './db';
import { createDoc, writeField, mergeDoc } from '../crdt/lww';
import type { LWWDoc, LWWTimestamp } from '../crdt/types';

function newId(): string {
  return crypto.randomUUID();
}

export class DexieStorageAdapter implements StorageAdapter {
  private readonly db: WickerlyDB;

  constructor(db: WickerlyDB = defaultDb) {
    this.db = db;
  }

  // ── Clock management ───────────────────────────────────────────────────────

  // Atomically increments the Lamport clock and returns a fresh timestamp.
  // When called inside an active Dexie transaction that includes the meta table,
  // Dexie automatically joins that transaction (no nested transaction overhead).
  private async tickClock(): Promise<LWWTimestamp> {
    return this.db.transaction('rw', this.db.meta, async () => {
      let peerRecord = await this.db.meta.get('peerId');
      if (!peerRecord) {
        peerRecord = { key: 'peerId', value: newId() };
        await this.db.meta.put(peerRecord);
      }
      const peerId = peerRecord.value as string;

      const lamportRecord = await this.db.meta.get('lamport');
      const next = ((lamportRecord?.value as number) ?? 0) + 1;
      await this.db.meta.put({ key: 'lamport', value: next });

      return { lamport: next, peerId };
    });
  }

  async getPeerId(): Promise<string> {
    const record = await this.db.meta.get('peerId');
    if (record) return record.value as string;
    const id = newId();
    await this.db.meta.put({ key: 'peerId', value: id });
    return id;
  }

  // ── Notes ──────────────────────────────────────────────────────────────────

  async getNotes(): Promise<Note[]> {
    return this.db.notes.orderBy('updatedAt').reverse().toArray();
  }

  async getNoteById(id: string): Promise<Note | undefined> {
    return this.db.notes.get(id);
  }

  async createNote(input: NoteCreateInput): Promise<Note> {
    const now = Date.now();
    return this.db.transaction('rw', [this.db.notes, this.db.crdt_docs, this.db.meta], async () => {
      const ts = await this.tickClock();
      const note: Note = {
        pinned: false,
        archived: false,
        ...input,
        id: newId(),
        createdAt: now,
        updatedAt: now,
      };
      const doc = createDoc(note.id, ts, {
        title:    note.title,
        content:  note.content,
        tags:     [...note.tags],
        folderId: note.folderId,
        pinned:   note.pinned ?? false,
        archived: note.archived ?? false,
      });
      await this.db.notes.add(note);
      await this.db.crdt_docs.put(doc);
      return note;
    });
  }

  async updateNote(id: string, input: NoteUpdateInput): Promise<Note> {
    return this.db.transaction('rw', [this.db.notes, this.db.crdt_docs, this.db.meta], async () => {
      const ts = await this.tickClock();
      const existing = await this.db.notes.get(id);
      if (!existing) throw new Error(`Note ${id} not found`);
      const updated: Note = { ...existing, ...input, id, updatedAt: Date.now() };

      const currentDoc = await this.db.crdt_docs.get(id);
      let lwwDoc: LWWDoc;

      if (currentDoc) {
        lwwDoc = currentDoc;
        if (input.title    !== undefined) lwwDoc = writeField(lwwDoc, 'title',    input.title,     ts);
        if (input.content  !== undefined) lwwDoc = writeField(lwwDoc, 'content',  input.content,   ts);
        if (input.tags     !== undefined) lwwDoc = writeField(lwwDoc, 'tags',     [...input.tags], ts);
        if (input.folderId !== undefined) lwwDoc = writeField(lwwDoc, 'folderId', input.folderId,  ts);
        if (input.pinned   !== undefined) lwwDoc = writeField(lwwDoc, 'pinned',   input.pinned,    ts);
        if (input.archived !== undefined) lwwDoc = writeField(lwwDoc, 'archived', input.archived,  ts);
      } else {
        // Note predates CRDT integration — backfill a CRDT doc from current state
        lwwDoc = createDoc(id, ts, {
          title:    updated.title,
          content:  updated.content,
          tags:     [...updated.tags],
          folderId: updated.folderId,
          pinned:   updated.pinned ?? false,
          archived: updated.archived ?? false,
        });
      }

      await this.db.notes.put(updated);
      await this.db.crdt_docs.put(lwwDoc);
      return updated;
    });
  }

  async deleteNote(id: string): Promise<void> {
    await this.db.transaction('rw', [this.db.notes, this.db.crdt_docs], async () => {
      await this.db.notes.delete(id);
      await this.db.crdt_docs.delete(id);
    });
  }

  // ── Folders ────────────────────────────────────────────────────────────────

  async getFolders(): Promise<Folder[]> {
    return this.db.folders.orderBy('name').toArray();
  }

  async getFolderById(id: string): Promise<Folder | undefined> {
    return this.db.folders.get(id);
  }

  async createFolder(input: FolderCreateInput): Promise<Folder> {
    const now = Date.now();
    const folder: Folder = { ...input, id: newId(), createdAt: now, updatedAt: now };
    await this.db.folders.add(folder);
    return folder;
  }

  async updateFolder(id: string, input: FolderUpdateInput): Promise<Folder> {
    const existing = await this.db.folders.get(id);
    if (!existing) throw new Error(`Folder ${id} not found`);
    const updated: Folder = { ...existing, ...input, id, updatedAt: Date.now() };
    await this.db.folders.put(updated);
    return updated;
  }

  async deleteFolder(id: string): Promise<void> {
    await this.db.notes.where('folderId').equals(id).modify({ folderId: null });
    await this.db.folders.delete(id);
  }

  // ── CRDT sync surface ──────────────────────────────────────────────────────

  async getCRDTDoc(noteId: string): Promise<LWWDoc | undefined> {
    return this.db.crdt_docs.get(noteId);
  }

  async getAllCRDTDocs(): Promise<LWWDoc[]> {
    return this.db.crdt_docs.toArray();
  }

  async applyRemoteDoc(incoming: LWWDoc): Promise<Note> {
    const now = Date.now();
    return this.db.transaction('rw', [this.db.notes, this.db.crdt_docs, this.db.meta], async () => {
      // Advance local clock past all remote timestamps (Lamport rule)
      const maxRemote = Math.max(
        incoming.fields.title.ts.lamport,
        incoming.fields.content.ts.lamport,
        incoming.fields.tags.ts.lamport,
        incoming.fields.folderId.ts.lamport,
        incoming.fields.pinned.ts.lamport,
        incoming.fields.archived.ts.lamport,
      );
      const lamportRecord = await this.db.meta.get('lamport');
      const currentLamport = (lamportRecord?.value as number) ?? 0;
      await this.db.meta.put({ key: 'lamport', value: Math.max(currentLamport, maxRemote) + 1 });

      // Merge with local CRDT state — if no local doc yet, the remote doc wins outright
      const localDoc = await this.db.crdt_docs.get(incoming.id);
      const merged = localDoc ? mergeDoc(localDoc, incoming) : incoming;

      // Persist the merged Note view
      const existingNote = await this.db.notes.get(incoming.id);
      const note: Note = {
        id:       merged.id,
        title:    merged.fields.title.value,
        content:  merged.fields.content.value,
        tags:     [...merged.fields.tags.value],
        folderId: merged.fields.folderId.value,
        pinned:   merged.fields.pinned.value,
        archived: merged.fields.archived.value,
        createdAt: existingNote?.createdAt ?? now,
        updatedAt: now,
      };

      await this.db.notes.put(note);
      await this.db.crdt_docs.put(merged);
      return note;
    });
  }
}
