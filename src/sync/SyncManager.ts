import type { StorageAdapter } from '../storage/StorageAdapter';
import type { SyncTransport, PeerInfo } from './types';

const SYNC_INTERVAL_MS = 30_000;

export class SyncManager {
  private readonly adapter: StorageAdapter;
  private readonly transport: SyncTransport;

  private onSync: (() => Promise<void>) | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private unlistenIncoming: (() => void) | null = null;
  private running = false;
  private syncing = false;
  private lastPeerCount = 0;
  private lastSyncAt: number | null = null;

  constructor(adapter: StorageAdapter, transport: SyncTransport) {
    this.adapter = adapter;
    this.transport = transport;
  }

  async start(onSync: () => Promise<void>): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.onSync = onSync;

    const peerId = await this.adapter.getPeerId();
    const docs = await this.adapter.getAllCRDTDocs();
    await this.transport.start(peerId, docs);

    this.unlistenIncoming = await this.transport.onIncomingDocs(
      (incoming) => void this.applyIncoming(incoming),
    );

    // Initial sync + periodic polling
    void this.syncAllPeers();
    this.intervalId = setInterval(
      () => void this.syncAllPeers(),
      SYNC_INTERVAL_MS,
    );
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    this.running = false;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.unlistenIncoming?.();
    this.unlistenIncoming = null;
    await this.transport.stop().catch(() => {});
  }

  /** Call after every local note write to keep the transport cache fresh. */
  async notifyDocsChanged(): Promise<void> {
    const docs = await this.adapter.getAllCRDTDocs();
    await this.transport.setDocs(docs);
    void this.syncAllPeers();
  }

  // ── private ─────────────────────────────────────────────────────────────────

  getStatus(): { peerCount: number; lastSyncAt: number | null } {
    return { peerCount: this.lastPeerCount, lastSyncAt: this.lastSyncAt };
  }

  private async applyIncoming(incoming: unknown[]): Promise<void> {
    for (const raw of incoming) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await this.adapter.applyRemoteDoc(raw as any);
    }
    this.lastSyncAt = Date.now();
    await this.onSync?.();
  }

  private async syncAllPeers(): Promise<void> {
    if (this.syncing) return;
    this.syncing = true;
    try {
      const peers = await this.transport.getPeers();
      this.lastPeerCount = peers.length;
      for (const peer of peers) {
        await this.syncWithPeer(peer).catch(() => {});
      }
    } catch {
      // Discovery failure — ignore
    } finally {
      this.syncing = false;
    }
  }

  private async syncWithPeer(peer: PeerInfo): Promise<void> {
    const theirDocs = await this.transport.fetchPeerDocs(peer.base_url);
    let changed = false;

    for (const doc of theirDocs) {
      await this.adapter.applyRemoteDoc(doc);
      changed = true;
    }

    const ourDocs = await this.adapter.getAllCRDTDocs();
    await this.transport.pushToPeer(peer.base_url, ourDocs);
    this.lastSyncAt = Date.now();

    if (changed) await this.onSync?.();
  }
}
