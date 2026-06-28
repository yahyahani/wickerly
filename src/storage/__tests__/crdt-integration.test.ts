import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { DexieStorageAdapter } from '../DexieStorageAdapter';
import { WickerlyDB } from '../db';
import { createDoc, writeField } from '../../crdt/lww';

let db: WickerlyDB;
let adapter: DexieStorageAdapter;

beforeEach(() => {
  // Unique DB name per test — fake-indexeddb keeps them isolated in memory
  db = new WickerlyDB(`wickerly-test-${crypto.randomUUID()}`);
  adapter = new DexieStorageAdapter(db);
});

afterEach(async () => {
  await db.close();
  await db.delete();
});

// ─────────────────────────────────────────────────────────────────────────────
// createNote produces a matching CRDT doc
// ─────────────────────────────────────────────────────────────────────────────

describe('createNote → CRDT doc', () => {
  test('getCRDTDoc returns a doc with matching field values', async () => {
    const note = await adapter.createNote({
      title: 'Hello CRDT', content: 'Some body', tags: ['test'], folderId: null,
    });

    const doc = await adapter.getCRDTDoc(note.id);
    expect(doc).toBeDefined();
    expect(doc!.id).toBe(note.id);
    expect(doc!.fields.title.value).toBe('Hello CRDT');
    expect(doc!.fields.content.value).toBe('Some body');
    expect(doc!.fields.tags.value).toEqual(['test']);
    expect(doc!.fields.folderId.value).toBeNull();
    expect(doc!.fields.pinned.value).toBe(false);
    expect(doc!.fields.archived.value).toBe(false);
  });

  test('initial doc carries a positive Lamport timestamp', async () => {
    const note = await adapter.createNote({ title: 'ts', content: '', tags: [], folderId: null });
    const doc = await adapter.getCRDTDoc(note.id);
    expect(doc!.fields.title.ts.lamport).toBeGreaterThan(0);
  });

  test('peerId on doc matches getPeerId()', async () => {
    const note = await adapter.createNote({ title: 'peer', content: '', tags: [], folderId: null });
    const doc = await adapter.getCRDTDoc(note.id);
    const peerId = await adapter.getPeerId();
    expect(doc!.fields.title.ts.peerId).toBe(peerId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateNote writes only changed fields with a fresh timestamp
// ─────────────────────────────────────────────────────────────────────────────

describe('updateNote → per-field CRDT writes', () => {
  test('title update bumps title lamport; content lamport is unchanged', async () => {
    const note = await adapter.createNote({ title: 'v1', content: 'body', tags: [], folderId: null });
    const before = (await adapter.getCRDTDoc(note.id))!;

    await adapter.updateNote(note.id, { title: 'v2' });
    const after = (await adapter.getCRDTDoc(note.id))!;

    expect(after.fields.title.ts.lamport).toBeGreaterThan(before.fields.title.ts.lamport);
    expect(after.fields.content.ts.lamport).toBe(before.fields.content.ts.lamport);
    expect(after.fields.title.value).toBe('v2');
  });

  test('boolean field update (pinned) only bumps that field', async () => {
    const note = await adapter.createNote({ title: 't', content: '', tags: [], folderId: null });
    const before = (await adapter.getCRDTDoc(note.id))!;

    await adapter.updateNote(note.id, { pinned: true });
    const after = (await adapter.getCRDTDoc(note.id))!;

    expect(after.fields.pinned.value).toBe(true);
    expect(after.fields.pinned.ts.lamport).toBeGreaterThan(before.fields.pinned.ts.lamport);
    expect(after.fields.title.ts.lamport).toBe(before.fields.title.ts.lamport);
  });

  test('Lamport clock is strictly monotonically increasing across writes', async () => {
    const note = await adapter.createNote({ title: 'a', content: '', tags: [], folderId: null });
    const doc1 = (await adapter.getCRDTDoc(note.id))!;

    await adapter.updateNote(note.id, { title: 'b' });
    const doc2 = (await adapter.getCRDTDoc(note.id))!;

    await adapter.updateNote(note.id, { content: 'new content' });
    const doc3 = (await adapter.getCRDTDoc(note.id))!;

    expect(doc2.fields.title.ts.lamport).toBeGreaterThan(doc1.fields.title.ts.lamport);
    expect(doc3.fields.content.ts.lamport).toBeGreaterThan(doc2.fields.title.ts.lamport);
  });

  test('folderId update to null is written correctly', async () => {
    const note = await adapter.createNote({ title: 't', content: '', tags: [], folderId: 'f-1' });
    await adapter.updateNote(note.id, { folderId: null });
    const doc = (await adapter.getCRDTDoc(note.id))!;
    expect(doc.fields.folderId.value).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getPeerId is stable across calls
// ─────────────────────────────────────────────────────────────────────────────

describe('getPeerId', () => {
  test('returns the same UUID on every call', async () => {
    const a = await adapter.getPeerId();
    const b = await adapter.getPeerId();
    const c = await adapter.getPeerId();
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyRemoteDoc — sync merge scenarios
// ─────────────────────────────────────────────────────────────────────────────

describe('applyRemoteDoc', () => {
  test('new note from remote is created locally with correct fields', async () => {
    const remoteDoc = createDoc('remote-1', { lamport: 10, peerId: 'peer-B' }, {
      title: 'Remote', content: 'Remote body', tags: ['synced'],
      folderId: null, pinned: false, archived: false,
    });

    const note = await adapter.applyRemoteDoc(remoteDoc);
    expect(note.id).toBe('remote-1');
    expect(note.title).toBe('Remote');
    expect(note.content).toBe('Remote body');
    expect(note.tags).toEqual(['synced']);

    const stored = await adapter.getCRDTDoc('remote-1');
    expect(stored!.fields.title.value).toBe('Remote');
  });

  test('local edit at higher Lamport wins over stale remote', async () => {
    const note = await adapter.createNote({ title: 'v1', content: '', tags: [], folderId: null });
    await adapter.updateNote(note.id, { title: 'v2-local' });

    // Remote peer sends an old version with a low Lamport value
    const staleRemote = createDoc(note.id, { lamport: 1, peerId: 'peer-B' }, {
      title: 'old-remote', content: '', tags: [], folderId: null, pinned: false, archived: false,
    });

    await adapter.applyRemoteDoc(staleRemote);
    const updated = await adapter.getNoteById(note.id);
    expect(updated!.title).toBe('v2-local');
  });

  test('remote edit at higher Lamport overwrites local', async () => {
    const note = await adapter.createNote({ title: 'local', content: '', tags: [], folderId: null });

    const newerRemote = createDoc(note.id, { lamport: 9999, peerId: 'peer-B' }, {
      title: 'remote-wins', content: '', tags: [], folderId: null, pinned: false, archived: false,
    });

    await adapter.applyRemoteDoc(newerRemote);
    const updated = await adapter.getNoteById(note.id);
    expect(updated!.title).toBe('remote-wins');
  });

  test('per-field independence: remote wins title, local wins content', async () => {
    // Set up local note with high-lamport content write
    const note = await adapter.createNote({ title: 'old-title', content: '', tags: [], folderId: null });
    await adapter.updateNote(note.id, { content: 'local-content-v2' });
    const localDoc = (await adapter.getCRDTDoc(note.id))!;

    // Remote has a newer title but older content (lower lamport)
    const contentLamport = localDoc.fields.content.ts.lamport;
    const remoteDoc = createDoc(note.id, { lamport: contentLamport + 50, peerId: 'peer-B' }, {
      title: 'remote-title-wins',
      content: '',
      tags: [], folderId: null, pinned: false, archived: false,
    });
    // Manually override content to have a lower lamport (simulate remote never touched content)
    const remoteWithOldContent = writeField(remoteDoc, 'content', '', { lamport: 1, peerId: 'peer-B' });

    await adapter.applyRemoteDoc(remoteWithOldContent);
    const merged = await adapter.getNoteById(note.id);
    expect(merged!.title).toBe('remote-title-wins');
    expect(merged!.content).toBe('local-content-v2');
  });

  test('clock is advanced past remote lamport so next local write is strictly later', async () => {
    const remoteDoc = createDoc('note-x', { lamport: 100, peerId: 'peer-B' }, {
      title: 'remote', content: '', tags: [], folderId: null, pinned: false, archived: false,
    });
    await adapter.applyRemoteDoc(remoteDoc);

    const local = await adapter.createNote({ title: 'after-remote', content: '', tags: [], folderId: null });
    const localDoc = (await adapter.getCRDTDoc(local.id))!;
    expect(localDoc.fields.title.ts.lamport).toBeGreaterThan(100);
  });

  test('applying the same remote doc twice is idempotent', async () => {
    const remoteDoc = createDoc('idem-1', { lamport: 5, peerId: 'peer-B' }, {
      title: 'idempotent', content: 'body', tags: [], folderId: null, pinned: false, archived: false,
    });

    const first  = await adapter.applyRemoteDoc(remoteDoc);
    const second = await adapter.applyRemoteDoc(remoteDoc);

    expect(second.title).toBe(first.title);
    expect(second.content).toBe(first.content);

    const doc = (await adapter.getCRDTDoc('idem-1'))!;
    expect(doc.fields.title.value).toBe('idempotent');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAllCRDTDocs and deleteNote
// ─────────────────────────────────────────────────────────────────────────────

describe('getAllCRDTDocs', () => {
  test('returns one doc per created note', async () => {
    await adapter.createNote({ title: 'A', content: '', tags: [], folderId: null });
    await adapter.createNote({ title: 'B', content: '', tags: [], folderId: null });
    await adapter.createNote({ title: 'C', content: '', tags: [], folderId: null });

    const docs = await adapter.getAllCRDTDocs();
    expect(docs).toHaveLength(3);
  });
});

describe('deleteNote removes CRDT doc', () => {
  test('getCRDTDoc returns undefined after deletion', async () => {
    const note = await adapter.createNote({ title: 'gone', content: '', tags: [], folderId: null });
    await adapter.deleteNote(note.id);
    expect(await adapter.getCRDTDoc(note.id)).toBeUndefined();
    expect(await adapter.getNoteById(note.id)).toBeUndefined();
  });
});
