import type { LWWDoc } from '../crdt';

export interface PeerInfo {
  peer_id: string;
  base_url: string;
}

/**
 * Abstract transport layer for CRDT state exchange.
 *
 * The concrete `TauriSyncTransport` delegates to Rust via `invoke`.
 * Tests and non-Tauri environments use `MockSyncTransport`.
 */
export interface SyncTransport {
  /** Start the local HTTP sync server. Returns the port it bound to. */
  start(peerId: string, initialDocs: LWWDoc[]): Promise<number>;
  /** Stop the server and unregister mDNS. */
  stop(): Promise<void>;
  /** Replace the full doc cache served to remote peers. */
  setDocs(docs: LWWDoc[]): Promise<void>;
  /** Return all currently-discovered LAN peers. */
  getPeers(): Promise<PeerInfo[]>;
  /** Fetch all CRDT docs from a remote peer. */
  fetchPeerDocs(baseUrl: string): Promise<LWWDoc[]>;
  /** Push our CRDT docs to a remote peer. */
  pushToPeer(baseUrl: string, docs: LWWDoc[]): Promise<void>;
  /**
   * Register a callback for docs pushed to us by remote peers.
   * Returns an unlisten function.
   */
  onIncomingDocs(handler: (docs: LWWDoc[]) => void): Promise<() => void>;
}
