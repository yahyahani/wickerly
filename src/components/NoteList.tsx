import { format } from 'date-fns';
import {
  Folder as FolderIcon, Tag, Trash2,
  Pin, PinOff, Archive, ArchiveRestore,
  FilePlus, Search,
} from 'lucide-react';
import type { Note, Folder } from '../storage/types';
import './NoteList.css';

interface Props {
  notes: Note[];
  folders: Folder[];
  activeNoteId: string | null;
  showArchived: boolean;
  hasSearchQuery: boolean;
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onCreateNote?: () => void;
  onClearSearch?: () => void;
}

function EmptyState({ icon, message, action }: {
  icon: React.ReactNode;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <li className="note-list__empty-state">
      <div className="note-list__empty-icon">{icon}</div>
      <p className="note-list__empty-msg">{message}</p>
      {action && (
        <button className="note-list__empty-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </li>
  );
}

export function NoteList({
  notes, folders, activeNoteId,
  showArchived, hasSearchQuery,
  onSelectNote, onDeleteNote, onTogglePin, onToggleArchive,
  onCreateNote, onClearSearch,
}: Props) {
  const folderMap = new Map(folders.map((f) => [f.id, f.name]));
  const pinned  = showArchived ? [] : notes.filter((n) => n.pinned);
  const regular = showArchived ? notes : notes.filter((n) => !n.pinned);

  function renderItem(note: Note) {
    const isActive = note.id === activeNoteId;
    return (
      <li
        key={note.id}
        className={`note-list__item${isActive ? ' active' : ''}`}
        onClick={() => onSelectNote(note.id)}
      >
        <div className="note-list__item-row">
          <span className="note-list__item-title">{note.title || 'Untitled'}</span>
          <span className="note-list__item-date">{format(note.updatedAt, 'd MMM')}</span>
        </div>

        {note.folderId && (
          <span className="note-list__item-folder">
            <FolderIcon size={10} strokeWidth={1.8} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            {folderMap.get(note.folderId) ?? '—'}
          </span>
        )}

        {note.tags.length > 0 && (
          <div className="note-list__item-tags">
            <Tag size={10} strokeWidth={1.8} className="note-list__tag-icon" />
            {note.tags.slice(0, 4).map((t) => (
              <span key={t} className="note-list__tag">{t}</span>
            ))}
          </div>
        )}

        <div className="note-list__actions">
          {!showArchived && (
            <button
              className={`note-list__action-btn${note.pinned ? ' active' : ''}`}
              title={note.pinned ? 'Unpin' : 'Pin'}
              onClick={(e) => { e.stopPropagation(); onTogglePin(note.id); }}
            >
              {note.pinned
                ? <PinOff size={11} strokeWidth={1.8} />
                : <Pin size={11} strokeWidth={1.8} />}
            </button>
          )}
          <button
            className="note-list__action-btn"
            title={showArchived ? 'Unarchive' : 'Archive'}
            onClick={(e) => { e.stopPropagation(); onToggleArchive(note.id); }}
          >
            {showArchived
              ? <ArchiveRestore size={11} strokeWidth={1.8} />
              : <Archive size={11} strokeWidth={1.8} />}
          </button>
          <button
            className="note-list__action-btn note-list__action-btn--delete"
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
          >
            <Trash2 size={11} strokeWidth={1.8} />
          </button>
        </div>
      </li>
    );
  }

  if (notes.length === 0) {
    return (
      <ul className="note-list">
        {showArchived ? (
          <EmptyState
            icon={<Archive size={28} strokeWidth={1.4} />}
            message="Archief is leeg"
          />
        ) : hasSearchQuery ? (
          <EmptyState
            icon={<Search size={28} strokeWidth={1.4} />}
            message="Geen resultaten"
            action={onClearSearch ? { label: 'Zoekopdracht wissen', onClick: onClearSearch } : undefined}
          />
        ) : (
          <EmptyState
            icon={<FilePlus size={28} strokeWidth={1.4} />}
            message="Nog geen notities"
            action={onCreateNote ? { label: 'Nieuwe notitie', onClick: onCreateNote } : undefined}
          />
        )}
      </ul>
    );
  }

  return (
    <ul className="note-list">
      {pinned.length > 0 && (
        <>
          <li className="note-list__section-header">Pinned</li>
          {pinned.map(renderItem)}
          {regular.length > 0 && <li className="note-list__section-divider" />}
        </>
      )}
      {regular.map(renderItem)}
    </ul>
  );
}
