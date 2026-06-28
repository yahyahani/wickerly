import { useEffect, useRef, useState } from 'react';
import { useStorage } from '../storage/StorageContext';
import { SyncManager } from './SyncManager';
import { TauriSyncTransport } from './TauriSyncTransport';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export interface SyncStatus {
  available: boolean;
  peerCount: number;
  lastSyncAt: number | null;
}

export function useSyncManager(onSync: () => Promise<void>): {
  notifySync: () => void;
  syncStatus: SyncStatus;
} {
  const adapter = useStorage();
  const managerRef = useRef<SyncManager | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    available: isTauri,
    peerCount: 0,
    lastSyncAt: null,
  });

  if (!managerRef.current && isTauri) {
    managerRef.current = new SyncManager(adapter, new TauriSyncTransport());
  }

  useEffect(() => {
    if (!managerRef.current) return;
    void managerRef.current.start(onSync);
    return () => {
      void managerRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isTauri) return;
    const id = setInterval(() => {
      const s = managerRef.current?.getStatus();
      if (s) setSyncStatus({ available: true, ...s });
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  return {
    notifySync: () =>
      void managerRef.current?.notifyDocsChanged().catch(() => {}),
    syncStatus,
  };
}
