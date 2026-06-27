import { useState, useEffect, useCallback } from 'react';
import { useStorage } from '../storage/StorageContext';
import type { Note, NoteCreateInput, NoteUpdateInput } from '../storage/types';

export function useNotes() {
  const storage = useStorage();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setNotes(await storage.getNotes());
  }, [storage]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const createNote = useCallback(
    async (input: NoteCreateInput) => {
      const note = await storage.createNote(input);
      await refresh();
      return note;
    },
    [storage, refresh],
  );

  const updateNote = useCallback(
    async (id: string, input: NoteUpdateInput) => {
      const note = await storage.updateNote(id, input);
      await refresh();
      return note;
    },
    [storage, refresh],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      await storage.deleteNote(id);
      await refresh();
    },
    [storage, refresh],
  );

  return { notes, loading, createNote, updateNote, deleteNote, refresh };
}
