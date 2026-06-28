import { useState, useEffect, useCallback } from 'react';
import { useStorage } from '../storage/StorageContext';
import type { Folder, FolderCreateInput, FolderUpdateInput } from '../storage/types';

export function useFolders() {
  const storage = useStorage();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setFolders(await storage.getFolders());
  }, [storage]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const createFolder = useCallback(
    async (input: FolderCreateInput) => {
      const folder = await storage.createFolder(input);
      await refresh();
      return folder;
    },
    [storage, refresh],
  );

  const updateFolder = useCallback(
    async (id: string, input: FolderUpdateInput) => {
      const folder = await storage.updateFolder(id, input);
      await refresh();
      return folder;
    },
    [storage, refresh],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      await storage.deleteFolder(id);
      await refresh();
    },
    [storage, refresh],
  );

  return { folders, loading, createFolder, updateFolder, deleteFolder, refresh };
}
