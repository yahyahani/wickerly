import { format } from 'date-fns';
import type { Note } from '../storage/types';
import './NoteList.css';

interface Props {
  notes: Note[];
  activeNoteId: string | null;
  searchQuery: string;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onDeleteNote: (id: string) => void;
  onSearchChange: (q: string) => void;
}

export function NoteList({
  notes,
  activeNoteId,
  searchQuery,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onSearchChange,
}: Props) {
  return (
    <div className="note-list">
      <div className="note-list__header">
        <button className="note-list__new-btn" onClick={onCreateNote}>
          + New note
        </button>
        <input
          className="note-list__search"
          placeholder="Search…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <ul className="note-list__items">
        {notes.length === 0 && (
          <li className="note-list__empty">No notes yet</li>
        )}
        {notes.map((note) => (
          <li
            key={note.id}
            className={`note-list__item ${note.id === activeNoteId ? 'active' : ''}`}
            onClick={() => onSelectNote(note.id)}
          >
            <span className="note-list__item-title">
              {note.title || 'Untitled'}
            </span>
            <span className="note-list__item-date">
              {format(note.updatedAt, 'd MMM')}
            </span>
            {note.tags.length > 0 && (
              <div className="note-list__item-tags">
                {note.tags.slice(0, 3).map((t) => (
                  <span key={t} className="note-list__tag">{t}</span>
                ))}
              </div>
            )}
            <button
              className="note-list__delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${note.title || 'Untitled'}"?`)) {
                  onDeleteNote(note.id);
                }
              }}
              title="Delete note"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
