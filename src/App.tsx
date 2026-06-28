import { useState, useMemo, useEffect, useCallback } from 'react';
import { StorageProvider } from './storage/StorageContext';
import { useNotes } from './hooks/useNotes';
import { useFolders } from './hooks/useFolders';
import { useSearch } from './search/useSearch';
import { FolderTree } from './components/FolderTree';
import { TagFilter } from './components/TagFilter';
import { NoteList } from './components/NoteList';
import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { NoteEditor } from './editor/NoteEditor';
import { Dashboard } from './dashboard/Dashboard';
import './App.css';

type View = 'notes' | 'dashboard';

function AppInner() {
  const { notes, loading: notesLoading, createNote, updateNote, deleteNote } = useNotes();
  const { folders, loading: foldersLoading, createFolder, updateFolder, deleteFolder } = useFolders();
  const { query, results, search } = useSearch(notes);

  const [activeView, setActiveView]         = useState<View>('notes');
  const [activeNoteId, setActiveNoteId]     = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null); // null = All notes
  const [activeTags, setActiveTags]         = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen]       = useState(false);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && paletteOpen) setPaletteOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) for (const t of n.tags) set.add(t);
    return [...set].sort();
  }, [notes]);

  const displayedNotes = useMemo(() => {
    let filtered = activeFolderId !== null
      ? notes.filter((n) => n.folderId === activeFolderId)
      : notes;

    if (activeTags.length > 0)
      filtered = filtered.filter((n) => activeTags.some((t) => n.tags.includes(t)));

    if (query.trim()) {
      const ids = new Set(results.map((r) => r.noteId));
      filtered = filtered.filter((n) => ids.has(n.id));
    }
    return filtered;
  }, [notes, activeFolderId, activeTags, query, results]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleCreateNote = useCallback(
    async (folderId: string | null = activeFolderId) => {
      const note = await createNote({ title: '', content: '', tags: [], folderId });
      setActiveNoteId(note.id);
      setActiveView('notes');
    },
    [activeFolderId, createNote],
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote(id);
      if (activeNoteId === id) setActiveNoteId(null);
    },
    [deleteNote, activeNoteId],
  );

  function handleToggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleSelectFolder(id: string | null) {
    setActiveFolderId(id);
    setActiveTags([]);   // clear tag filter when switching folder
  }

  if (notesLoading || foldersLoading) {
    return <div className="app-loading">Loading Wickerly…</div>;
  }

  return (
    <div className="app">
      <Sidebar activeView={activeView} onViewChange={setActiveView} onOpenPalette={() => setPaletteOpen(true)} />

      {activeView === 'notes' && (
        <>
          {/* ── Left panel ───────────────────────────────────────────────── */}
          <div className="left-panel">
            <div className="panel-toolbar">
              <button className="panel-new-btn" onClick={() => handleCreateNote()}>
                + New note
              </button>
              <input
                className="panel-search"
                placeholder="Search…"
                value={query}
                onChange={(e) => search(e.target.value)}
              />
            </div>

            <FolderTree
              folders={folders}
              notes={notes}
              activeFolderId={activeFolderId}
              onSelectFolder={handleSelectFolder}
              onCreateFolder={createFolder}
              onUpdateFolder={(id, input) => updateFolder(id, input).then(() => {})}
              onDeleteFolder={deleteFolder}
              onCreateNoteInFolder={handleCreateNote}
            />

            <TagFilter
              allTags={allTags}
              activeTags={activeTags}
              onToggleTag={handleToggleTag}
              onClear={() => setActiveTags([])}
            />

            <NoteList
              notes={displayedNotes}
              folders={folders}
              activeNoteId={activeNoteId}
              onSelectNote={setActiveNoteId}
              onDeleteNote={handleDeleteNote}
            />
          </div>

          {/* ── Editor ───────────────────────────────────────────────────── */}
          <main className="app__main">
            {activeNote ? (
              <NoteEditor
                note={activeNote}
                folders={folders}
                onSave={(id, input) => updateNote(id, input)}
              />
            ) : (
              <div className="app__empty">
                <p>Select a note or create a new one</p>
                <button className="app__empty-btn" onClick={() => handleCreateNote()}>
                  + New note
                </button>
              </div>
            )}
          </main>
        </>
      )}

      {activeView === 'dashboard' && (
        <main className="app__main">
          <Dashboard
            notes={notes}
            onSelectNote={(id) => { setActiveNoteId(id); setActiveView('notes'); }}
          />
        </main>
      )}

      {paletteOpen && (
        <CommandPalette
          notes={notes}
          onClose={() => setPaletteOpen(false)}
          onSelectNote={(id) => { setActiveNoteId(id); setActiveView('notes'); }}
          onNewNote={() => handleCreateNote()}
          onViewChange={setActiveView}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <StorageProvider>
      <AppInner />
    </StorageProvider>
  );
}
