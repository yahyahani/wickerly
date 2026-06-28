import { useEffect, useRef } from 'react';
import { useStorage } from '../storage/StorageContext';
import { SyncManager } from './SyncManager';
import { TauriSyncTransport } from './TauriSyncTransport';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Creates a stable SyncManager for the app's lifetime.
 * Returns a `notifySync` callback to call after each local write.
 */
export function useSyncManager(onSync: () => Promise<void>): {
  notifySync: () => void;
} {
  const adapter = useStorage();
  const managerRef = useRef<SyncManager | null>(null);

  if (!managerRef.current && isTauri) {
    managerRef.current = new SyncManager(adapter, new TauriSyncTransport());
  }

  useEffect(() => {
    if (!managerRef.current) return;
    void managerRef.current.start(onSync);
    return () => {
      void managerRef.current?.stop();
    };
    // onSync identity is stable (wrapped in useCallback in App.tsx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    notifySync: () =>
      void managerRef.current?.notifyDocsChanged().catch(() => {}),
  };
}
