import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { FilePlus, Search, Archive } from 'lucide-react';
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
import { TEMPLATES } from './editor/templates';
import './App.css';

type View   = 'notes' | 'dashboard';
type SortBy = 'updated' | 'created' | 'title-asc' | 'title-desc';

function AppInner() {
  const { notes, loading: notesLoading, createNote, updateNote, deleteNote } = useNotes();
  const { folders, loading: foldersLoading, createFolder, updateFolder, deleteFolder } = useFolders();
  const { query, results, search } = useSearch(notes);

  const [activeView, setActiveView]         = useState<View>('notes');
  const [activeNoteId, setActiveNoteId]     = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeTags, setActiveTags]         = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen]       = useState(false);
  const [sortBy, setSortBy]                 = useState<SortBy>('updated');
  const [showArchived, setShowArchived]     = useState(false);

  // ── Stable ref so keyboard handler always calls latest handleCreateNote ────
  const handleCreateNote = useCallback(
    async (folderId: string | null = activeFolderId) => {
      const note = await createNote({ title: '', content: '', tags: [], folderId });
      setActiveNoteId(note.id);
      setActiveView('notes');
      setShowArchived(false);
    },
    [activeFolderId, createNote],
  );
  const handleCreateNoteRef = useRef(handleCreateNote);
  handleCreateNoteRef.current = handleCreateNote;

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        handleCreateNoteRef.current();
      }
      if (e.key === 'Escape' && paletteOpen) setPaletteOpen(false);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paletteOpen]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) if (!n.archived) for (const t of n.tags) set.add(t);
    return [...set].sort();
  }, [notes]);

  const archivedCount = useMemo(
    () => notes.filter((n) => n.archived).length,
    [notes],
  );

  const displayedNotes = useMemo(() => {
    let filtered = showArchived
      ? notes.filter((n) => n.archived)
      : notes.filter((n) => !n.archived);

    if (!showArchived && activeFolderId !== null) {
      filtered = filtered.filter((n) => n.folderId === activeFolderId);
    }

    if (activeTags.length > 0) {
      filtered = filtered.filter((n) => activeTags.some((t) => n.tags.includes(t)));
    }

    if (query.trim()) {
      const ids = new Set(results.map((r) => r.noteId));
      filtered = filtered.filter((n) => ids.has(n.id));
    }

    const sorted = [...filtered];
    switch (sortBy) {
      case 'updated':    sorted.sort((a, b) => b.updatedAt - a.updatedAt); break;
      case 'created':    sorted.sort((a, b) => b.createdAt - a.createdAt); break;
      case 'title-asc':  sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
      case 'title-desc': sorted.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
    }
    return sorted;
  }, [notes, showArchived, activeFolderId, activeTags, query, results, sortBy]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDeleteNote = useCallback(
    async (id: string) => {
      await deleteNote(id);
      if (activeNoteId === id) setActiveNoteId(null);
    },
    [deleteNote, activeNoteId],
  );

  const handleTogglePin = useCallback(
    async (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (note) await updateNote(id, { pinned: !note.pinned });
    },
    [notes, updateNote],
  );

  const handleToggleArchive = useCallback(
    async (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      await updateNote(id, { archived: !note.archived });
      if (activeNoteId === id) setActiveNoteId(null);
    },
    [notes, updateNote, activeNoteId],
  );

  const handleNewFromTemplate = useCallback(
    async (templateId: string) => {
      const tpl = TEMPLATES.find((t) => t.id === templateId);
      if (!tpl) return;
      const today   = format(new Date(), 'd MMMM yyyy');
      const content = tpl.content.replace(/\{\{date\}\}/g, today);
      const title   = tpl.defaultTitle.replace(/\{\{date\}\}/g, today);
      const note = await createNote({ title, content, tags: [], folderId: activeFolderId });
      setActiveNoteId(note.id);
      setActiveView('notes');
      setShowArchived(false);
    },
    [activeFolderId, createNote],
  );

  function handleToggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function handleSelectFolder(id: string | null) {
    setActiveFolderId(id);
    setActiveTags([]);
    setShowArchived(false);
  }

  function handleToggleArchiveView() {
    setShowArchived((v) => !v);
    setActiveFolderId(null);
    setActiveTags([]);
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
                <FilePlus size={14} strokeWidth={1.8} />
                New note
              </button>
              <div className="panel-search-wrap">
                <Search size={13} strokeWidth={1.7} className="panel-search-icon" />
                <input
                  className="panel-search"
                  placeholder="Search…"
                  value={query}
                  onChange={(e) => search(e.target.value)}
                />
              </div>
              <select
                className="panel-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option value="updated">Nieuwst bewerkt</option>
                <option value="created">Nieuwst aangemaakt</option>
                <option value="title-asc">Titel A → Z</option>
                <option value="title-desc">Titel Z → A</option>
              </select>
            </div>

            <FolderTree
              folders={folders}
              notes={notes.filter((n) => !n.archived)}
              activeFolderId={activeFolderId}
              onSelectFolder={handleSelectFolder}
              onCreateFolder={createFolder}
              onUpdateFolder={(id, input) => updateFolder(id, input).then(() => {})}
              onDeleteFolder={deleteFolder}
              onCreateNoteInFolder={handleCreateNote}
            />

            <button
              className={`archive-row${showArchived ? ' active' : ''}`}
              onClick={handleToggleArchiveView}
            >
              <Archive size={13} strokeWidth={1.6} />
              <span className="archive-row__label">Archive</span>
              {archivedCount > 0 && (
                <span className="archive-row__count">{archivedCount}</span>
              )}
            </button>

            {!showArchived && (
              <TagFilter
                allTags={allTags}
                activeTags={activeTags}
                onToggleTag={handleToggleTag}
                onClear={() => setActiveTags([])}
              />
            )}

            <NoteList
              notes={displayedNotes}
              folders={folders}
              activeNoteId={activeNoteId}
              showArchived={showArchived}
              onSelectNote={setActiveNoteId}
              onDeleteNote={handleDeleteNote}
              onTogglePin={handleTogglePin}
              onToggleArchive={handleToggleArchive}
            />
          </div>

          {/* ── Editor ───────────────────────────────────────────────────── */}
          <main className="app__main">
            {activeNote ? (
              <NoteEditor
                note={activeNote}
                notes={notes.filter((n) => !n.archived)}
                folders={folders}
                onSave={(id, input) => updateNote(id, input)}
                onSelectNote={setActiveNoteId}
                onTogglePin={() => handleTogglePin(activeNote.id)}
                onToggleArchive={() => handleToggleArchive(activeNote.id)}
              />
            ) : (
              <div className="app__empty">
                <p>Select a note or create a new one</p>
                <button className="app__empty-btn" onClick={() => handleCreateNote()}>
                  <FilePlus size={14} strokeWidth={1.8} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  New note
                </button>
              </div>
            )}
          </main>
        </>
      )}

      {activeView === 'dashboard' && (
        <main className="app__main">
          <Dashboard
            notes={notes.filter((n) => !n.archived)}
            onSelectNote={(id) => { setActiveNoteId(id); setActiveView('notes'); }}
          />
        </main>
      )}

      {paletteOpen && (
        <CommandPalette
          notes={notes.filter((n) => !n.archived)}
          onClose={() => setPaletteOpen(false)}
          onSelectNote={(id) => { setActiveNoteId(id); setActiveView('notes'); }}
          onNewNote={() => handleCreateNote()}
          onViewChange={setActiveView}
          onNewFromTemplate={handleNewFromTemplate}
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
