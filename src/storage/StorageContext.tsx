import { createContext, useContext, type ReactNode } from 'react';
import type { StorageAdapter } from './StorageAdapter';
import { DexieStorageAdapter } from './DexieStorageAdapter';

const defaultAdapter = new DexieStorageAdapter();

const StorageContext = createContext<StorageAdapter>(defaultAdapter);

export function StorageProvider({
  children,
  adapter = defaultAdapter,
}: {
  children: ReactNode;
  adapter?: StorageAdapter;
}) {
  return (
    <StorageContext.Provider value={adapter}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage(): StorageAdapter {
  return useContext(StorageContext);
}
