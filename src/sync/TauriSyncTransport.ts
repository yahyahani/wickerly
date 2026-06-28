import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { SyncTransport, PeerInfo } from './types';
import type { LWWDoc } from '../crdt';

export class TauriSyncTransport implements SyncTransport {
  async start(peerId: string, initialDocs: LWWDoc[]): Promise<number> {
    return invoke<number>('sync_start', {
      peerId,
      docs: JSON.stringify(initialDocs),
    });
  }

  async stop(): Promise<void> {
    await invoke('sync_stop');
  }

  async setDocs(docs: LWWDoc[]): Promise<void> {
    await invoke('sync_set_docs', { docs: JSON.stringify(docs) });
  }

  async getPeers(): Promise<PeerInfo[]> {
    return invoke<PeerInfo[]>('sync_get_peers');
  }

  async fetchPeerDocs(baseUrl: string): Promise<LWWDoc[]> {
    const json = await invoke<string>('sync_fetch_peer_docs', { baseUrl });
    return JSON.parse(json) as LWWDoc[];
  }

  async pushToPeer(baseUrl: string, docs: LWWDoc[]): Promise<void> {
    await invoke('sync_push_to_peer', { baseUrl, docs: JSON.stringify(docs) });
  }

  async onIncomingDocs(handler: (docs: LWWDoc[]) => void): Promise<() => void> {
    return listen<LWWDoc[]>('sync-incoming-docs', (event) => {
      handler(event.payload);
    });
  }
}
