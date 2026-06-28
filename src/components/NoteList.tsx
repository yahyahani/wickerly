import { format } from 'date-fns';
import type { Note, Folder } from '../storage/types';
import './NoteList.css';

interface Props {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
}

export function NoteList({ notes, folders, activeNoteId, onSelectNote, onDeleteNote }: Props) {
  const folderMap = new Map(folders.map((f) => [f.id, f.name]));

  return (
    <ul className="note-list">
      {notes.length === 0 && (
        <li className="note-list__empty">No notes</li>
      )}
      {notes.map((note) => (
        <li
          key={note.id}
          className={`note-list__item ${note.id === activeNoteId ? 'active' : ''}`}
          onClick={() => onSelectNote(note.id)}
        >
          <div className="note-list__item-row">
            <span className="note-list__item-title">{note.title || 'Untitled'}</span>
            <span className="note-list__item-date">{format(note.updatedAt, 'd MMM')}</span>
          </div>
          {note.folderId && (
            <span className="note-list__item-folder">📁 {folderMap.get(note.folderId) ?? '—'}</span>
          )}
          {note.tags.length > 0 && (
            <div className="note-list__item-tags">
              {note.tags.slice(0, 4).map((t) => (
                <span key={t} className="note-list__tag">{t}</span>
              ))}
            </div>
          )}
          <button
            className="note-list__delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${note.title || 'Untitled'}"?`)) onDeleteNote(note.id);
            }}
            title="Delete note"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}
