import { useState, useMemo } from 'react';
import { StorageProvider } from './storage/StorageContext';
import { useNotes } from './hooks/useNotes';
import { useSearch } from './search/useSearch';
import { NoteList } from './components/NoteList';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './editor/NoteEditor';
import { Dashboard } from './dashboard/Dashboard';
import './App.css';

type View = 'notes' | 'dashboard';

function AppInner() {
  const { notes, loading, createNote, updateNote, deleteNote } = useNotes();
  const { query, results, search } = useSearch(notes);
  const [activeView, setActiveView] = useState<View>('notes');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  const displayedNotes = useMemo(() => {
    if (!query.trim()) return notes;
    const ids = new Set(results.map((r) => r.noteId));
    return notes.filter((n) => ids.has(n.id));
  }, [notes, query, results]);

  const activeNote = useMemo(
    () => notes.find((n) => n.id === activeNoteId) ?? null,
    [notes, activeNoteId],
  );

  async function handleCreateNote() {
    const note = await createNote({
      title: '',
      content: '',
      tags: [],
      folderId: null,
    });
    setActiveNoteId(note.id);
    setActiveView('notes');
  }

  async function handleDeleteNote(id: string) {
    await deleteNote(id);
    if (activeNoteId === id) setActiveNoteId(null);
  }

  if (loading) {
    return <div className="app-loading">Loading Wickerly…</div>;
  }

  return (
    <div className="app">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />

      {activeView === 'notes' && (
        <>
          <NoteList
            notes={displayedNotes}
            activeNoteId={activeNoteId}
            searchQuery={query}
            onSelectNote={setActiveNoteId}
            onCreateNote={handleCreateNote}
            onDeleteNote={handleDeleteNote}
            onSearchChange={search}
          />
          <main className="app__main">
            {activeNote ? (
              <NoteEditor
                note={activeNote}
                onSave={(id, input) => updateNote(id, input)}
              />
            ) : (
              <div className="app__empty">
                <p>Select a note or create a new one</p>
                <button className="app__empty-btn" onClick={handleCreateNote}>
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
            onSelectNote={(id) => {
              setActiveNoteId(id);
              setActiveView('notes');
            }}
          />
        </main>
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
