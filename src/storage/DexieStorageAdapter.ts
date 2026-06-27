import type { StorageAdapter } from './StorageAdapter';
import type {
  Note,
  Folder,
  NoteCreateInput,
  NoteUpdateInput,
  FolderCreateInput,
  FolderUpdateInput,
} from './types';
import { db } from './db';

function newId(): string {
  return crypto.randomUUID();
}

export class DexieStorageAdapter implements StorageAdapter {
  // ── Notes ──────────────────────────────────────────────────────────────────

  async getNotes(): Promise<Note[]> {
    return db.notes.orderBy('updatedAt').reverse().toArray();
  }

  async getNoteById(id: string): Promise<Note | undefined> {
    return db.notes.get(id);
  }

  async createNote(input: NoteCreateInput): Promise<Note> {
    const now = Date.now();
    const note: Note = {
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    await db.notes.add(note);
    return note;
  }

  async updateNote(id: string, input: NoteUpdateInput): Promise<Note> {
    const existing = await db.notes.get(id);
    if (!existing) throw new Error(`Note ${id} not found`);
    const updated: Note = { ...existing, ...input, id, updatedAt: Date.now() };
    await db.notes.put(updated);
    return updated;
  }

  async deleteNote(id: string): Promise<void> {
    await db.notes.delete(id);
  }

  // ── Folders ────────────────────────────────────────────────────────────────

  async getFolders(): Promise<Folder[]> {
    return db.folders.orderBy('name').toArray();
  }

  async getFolderById(id: string): Promise<Folder | undefined> {
    return db.folders.get(id);
  }

  async createFolder(input: FolderCreateInput): Promise<Folder> {
    const now = Date.now();
    const folder: Folder = {
      ...input,
      id: newId(),
      createdAt: now,
      updatedAt: now,
    };
    await db.folders.add(folder);
    return folder;
  }

  async updateFolder(id: string, input: FolderUpdateInput): Promise<Folder> {
    const existing = await db.folders.get(id);
    if (!existing) throw new Error(`Folder ${id} not found`);
    const updated: Folder = { ...existing, ...input, id, updatedAt: Date.now() };
    await db.folders.put(updated);
    return updated;
  }

  async deleteFolder(id: string): Promise<void> {
    // Move orphaned notes to root before deleting the folder
    await db.notes.where('folderId').equals(id).modify({ folderId: null });
    await db.folders.delete(id);
  }
}
