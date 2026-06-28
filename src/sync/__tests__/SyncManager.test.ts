import 'fake-indexeddb/auto';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncManager } from '../SyncManager';
import { DexieStorageAdapter } from '../../storage/DexieStorageAdapter';
import { WickerlyDB } from '../../storage/db';
import { createDoc, writeField } from '../../crdt/lww';
import type { SyncTransport, PeerInfo } from '../types';
import type { LWWDoc } from '../../crdt';

// ─────────────────────────────────────────────────────────────────────────────
// In-memory mock transport — no Tauri, no network
// ─────────────────────────────────────────────────────────────────────────────

class MockSyncTransport implements SyncTransport {
  peerId = '';
  docs: LWWDoc[] = [];
  peers: PeerInfo[] = [];
  started = false;
  incomingHandler: ((docs: LWWDoc[]) => void) | null = null;

  async start(peerId: string, initialDocs: LWWDoc[]): Promise<number> {
    this.peerId = peerId;
    this.docs = [...initialDocs];
    this.started = true;
    return 12345;
  }

  async stop(): Promise<void> {
    this.started = false;
    this.incomingHandler = null;
  }

  async setDocs(docs: LWWDoc[]): Promise<void> {
    this.docs = [...docs];
  }

  async getPeers(): Promise<PeerInfo[]> {
    return this.peers;
  }

  async fetchPeerDocs(_baseUrl: string): Promise<LWWDoc[]> {
    return [];
  }

  async pushToPeer(_baseUrl: string, _docs: LWWDoc[]): Promise<void> {}

  async onIncomingDocs(handler: (docs: LWWDoc[]) => void): Promise<() => void> {
    this.incomingHandler = handler;
    return () => { this.incomingHandler = null; };
  }

  /** Test helper — simulate a remote peer pushing docs to us. */
  simulatePush(docs: LWWDoc[]): void {
    this.incomingHandler?.(docs);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test setup
// ─────────────────────────────────────────────────────────────────────────────

let db: WickerlyDB;
let adapter: DexieStorageAdapter;
let transport: MockSyncTransport;
let manager: SyncManager;
const onSync = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  db = new WickerlyDB(`wickerly-test-${crypto.randomUUID()}`);
  adapter = new DexieStorageAdapter(db);
  transport = new MockSyncTransport();
  manager = new SyncManager(adapter, transport);
});

afterEach(async () => {
  await manager.stop();
  await db.close();
  await db.delete();
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// start()
// ─────────────────────────────────────────────────────────────────────────────

describe('SyncManager.start', () => {
  test('starts the transport with the stable peerId', async () => {
    await manager.start(onSync);
    const expected = await adapter.getPeerId();
    expect(transport.peerId).toBe(expected);
    expect(transport.started).toBe(true);
  });

  test('sends all existing docs to the transport on start', async () => {
    await adapter.createNote({ title: 'a', content: '', tags: [], folderId: null });
    await adapter.createNote({ title: 'b', content: '', tags: [], folderId: null });
    await manager.start(onSync);
    expect(transport.docs).toHaveLength(2);
  });

  test('calling start() twice is idempotent', async () => {
    await manager.start(onSync);
    await manager.start(onSync); // second call is a no-op
    expect(transport.started).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Incoming docs (remote peer pushes to us)
// ─────────────────────────────────────────────────────────────────────────────

describe('incoming docs from remote peer', () => {
  test('new note from peer is created locally and onSync is called', async () => {
    await manager.start(onSync);

    const remoteDoc = createDoc('remote-1', { lamport: 5, peerId: 'peer-B' }, {
      title: 'Remote note', content: 'body', tags: [],
      folderId: null, pinned: false, archived: false,
    });
    transport.simulatePush([remoteDoc]);
    await new Promise((r) => setTimeout(r, 50));

    const note = await adapter.getNoteById('remote-1');
    expect(note?.title).toBe('Remote note');
    expect(onSync).toHaveBeenCalled();
  });

  test('stale remote doc does not overwrite newer local state', async () => {
    const note = await adapter.createNote({ title: 'local-v1', content: '', tags: [], folderId: null });
    await adapter.updateNote(note.id, { title: 'local-v2' });

    await manager.start(onSync);

    const stale = createDoc(note.id, { lamport: 1, peerId: 'peer-B' }, {
      title: 'old-remote', content: '', tags: [], folderId: null, pinned: false, archived: false,
    });
    transport.simulatePush([stale]);
    await new Promise((r) => setTimeout(r, 50));

    const current = await adapter.getNoteById(note.id);
    expect(current?.title).toBe('local-v2');
  });

  test('newer remote doc overwrites older local state', async () => {
    const note = await adapter.createNote({ title: 'old-local', content: '', tags: [], folderId: null });

    await manager.start(onSync);

    const newer = createDoc(note.id, { lamport: 9999, peerId: 'peer-B' }, {
      title: 'remote-wins', content: '', tags: [], folderId: null, pinned: false, archived: false,
    });
    transport.simulatePush([newer]);
    await new Promise((r) => setTimeout(r, 50));

    const current = await adapter.getNoteById(note.id);
    expect(current?.title).toBe('remote-wins');
  });

  test('per-field independence: remote title wins, local content wins', async () => {
    const note = await adapter.createNote({ title: 'old', content: '', tags: [], folderId: null });
    await adapter.updateNote(note.id, { content: 'local-content-high-ts' });
    const localDoc = (await adapter.getCRDTDoc(note.id))!;
    const localContentLamport = localDoc.fields.content.ts.lamport;

    await manager.start(onSync);

    // Remote has high-ts title but low-ts content
    let remoteDoc = createDoc(note.id, { lamport: localContentLamport + 100, peerId: 'peer-B' }, {
      title: 'remote-title-wins', content: 'remote-content-will-lose',
      tags: [], folderId: null, pinned: false, archived: false,
    });
    remoteDoc = writeField(remoteDoc, 'content', 'remote-content-will-lose', { lamport: 1, peerId: 'peer-B' });

    transport.simulatePush([remoteDoc]);
    await new Promise((r) => setTimeout(r, 50));

    const current = await adapter.getNoteById(note.id);
    expect(current?.title).toBe('remote-title-wins');
    expect(current?.content).toBe('local-content-high-ts');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// notifyDocsChanged()
// ─────────────────────────────────────────────────────────────────────────────

describe('notifyDocsChanged', () => {
  test('updates the transport doc cache after a local note write', async () => {
    await manager.start(onSync);
    expect(transport.docs).toHaveLength(0);

    await adapter.createNote({ title: 'new', content: '', tags: [], folderId: null });
    await manager.notifyDocsChanged();

    expect(transport.docs).toHaveLength(1);
    expect(transport.docs[0].fields.title.value).toBe('new');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Peer sync (fetch + push)
// ─────────────────────────────────────────────────────────────────────────────

describe('peer sync', () => {
  test('fetches peer docs and applies them', async () => {
    const remoteDoc = createDoc('peer-note-1', { lamport: 3, peerId: 'peer-B' }, {
      title: 'peer title', content: '', tags: [], folderId: null, pinned: false, archived: false,
    });

    // Transport will return this doc when asked for a peer's docs
    transport.fetchPeerDocs = async () => [remoteDoc];
    transport.peers = [{ peer_id: 'peer-B', base_url: 'http://192.168.1.2:4242' }];

    const pushed: LWWDoc[][] = [];
    transport.pushToPeer = async (_url, docs) => { pushed.push(docs); };

    await manager.start(onSync);
    await new Promise((r) => setTimeout(r, 100));

    const note = await adapter.getNoteById('peer-note-1');
    expect(note?.title).toBe('peer title');
    expect(pushed.length).toBeGreaterThan(0);
  });

  test('onSync is called after applying peer docs', async () => {
    const doc = createDoc('p-note', { lamport: 1, peerId: 'peer-C' }, {
      title: 'synced', content: '', tags: [], folderId: null, pinned: false, archived: false,
    });
    transport.fetchPeerDocs = async () => [doc];
    transport.peers = [{ peer_id: 'peer-C', base_url: 'http://10.0.0.5:9999' }];

    await manager.start(onSync);
    await new Promise((r) => setTimeout(r, 100));

    expect(onSync).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stop()
// ─────────────────────────────────────────────────────────────────────────────

describe('SyncManager.stop', () => {
  test('stops the transport and removes the incoming-docs listener', async () => {
    await manager.start(onSync);
    await manager.stop();
    expect(transport.started).toBe(false);
    expect(transport.incomingHandler).toBeNull();
  });

  test('docs pushed after stop() are not applied', async () => {
    await manager.start(onSync);
    await manager.stop();

    const doc = createDoc('after-stop', { lamport: 1, peerId: 'peer-Z' }, {
      title: 'should not appear', content: '', tags: [], folderId: null, pinned: false, archived: false,
    });
    transport.simulatePush([doc]); // handler is null, so nothing happens
    await new Promise((r) => setTimeout(r, 50));

    const note = await adapter.getNoteById('after-stop');
    expect(note).toBeUndefined();
  });
});
