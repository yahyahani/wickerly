import { useState, useEffect, useRef, useMemo } from 'react';
import { FilePlus, FileText, LayoutDashboard, Search, LayoutTemplate } from 'lucide-react';
import { TEMPLATES } from '../editor/templates';
import type { Note } from '../storage/types';
import './CommandPalette.css';

type View = 'notes' | 'dashboard';

interface Action {
  kind: 'action';
  id: string;
  label: string;
  description: string;
}

interface NoteItem {
  kind: 'note';
  note: Note;
}

type PaletteItem = Action | NoteItem;

interface Props {
  notes: Note[];
  onClose: () => void;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onViewChange: (v: View) => void;
  onNewFromTemplate: (templateId: string) => void;
}

const STATIC_ACTIONS: Action[] = [
  { kind: 'action', id: 'new-note',   label: 'New note',        description: 'Create a new empty note' },
  { kind: 'action', id: 'notes',      label: 'Go to Notes',     description: 'Switch to the notes view' },
  { kind: 'action', id: 'dashboard',  label: 'Go to Dashboard', description: 'Switch to the dashboard view' },
  ...TEMPLATES.map((t) => ({
    kind: 'action' as const,
    id: `template:${t.id}`,
    label: `New: ${t.label}`,
    description: 'Create note from template',
  })),
];

function ActionIcon({ id }: { id: string }) {
  if (id === 'new-note')           return <FilePlus size={15} strokeWidth={1.7} />;
  if (id === 'notes')              return <FileText size={15} strokeWidth={1.7} />;
  if (id === 'dashboard')          return <LayoutDashboard size={15} strokeWidth={1.7} />;
  if (id.startsWith('template:'))  return <LayoutTemplate size={15} strokeWidth={1.7} />;
  return null;
}

function scoreMatch(label: string, query: string): number {
  const l = label.toLowerCase();
  const q = query.toLowerCase();
  if (l === q) return 3;
  if (l.startsWith(q)) return 2;
  if (l.includes(q)) return 1;
  return 0;
}

export function CommandPalette({
  notes, onClose, onSelectNote, onNewNote, onViewChange, onNewFromTemplate,
}: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      const recentNotes: NoteItem[] = [...notes]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 7)
        .map((note) => ({ kind: 'note', note }));
      return [...STATIC_ACTIONS, ...recentNotes];
    }

    const matchedActions: Action[] = STATIC_ACTIONS
      .map((a) => ({ action: a, score: scoreMatch(a.label, q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ action }) => action);

    const matchedNotes: NoteItem[] = notes
      .map((note) => ({ note, score: scoreMatch(note.title || 'Untitled', q) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt)
      .slice(0, 8)
      .map(({ note }) => ({ kind: 'note' as const, note }));

    return [...matchedActions, ...matchedNotes];
  }, [query, notes]);

  useEffect(() => { setIndex(0); }, [items]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => Math.min(i + 1, items.length - 1)); return; }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); selectItem(items[index]); return; }
  }

  function selectItem(item: PaletteItem | undefined) {
    if (!item) return;
    if (item.kind === 'note') {
      onSelectNote(item.note.id);
    } else {
      if (item.id === 'new-note')  onNewNote();
      if (item.id === 'notes')     onViewChange('notes');
      if (item.id === 'dashboard') onViewChange('dashboard');
      if (item.id.startsWith('template:')) onNewFromTemplate(item.id.replace('template:', ''));
    }
    onClose();
  }

  useEffect(() => {
    const el = listRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="palette__input-wrap">
          <Search size={15} strokeWidth={1.7} className="palette__icon" />
          <input
            ref={inputRef}
            className="palette__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes or run a command…"
          />
          <kbd className="palette__esc" onClick={onClose}>esc</kbd>
        </div>
        <ul ref={listRef} className="palette__list">
          {items.length === 0 && (
            <li className="palette__empty">No results for "{query}"</li>
          )}
          {items.map((item, i) => {
            const isActive = i === index;
            if (item.kind === 'action') {
              return (
                <li
                  key={item.id}
                  className={`palette__item ${isActive ? 'active' : ''}`}
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setIndex(i)}
                >
                  <span className="palette__item-icon"><ActionIcon id={item.id} /></span>
                  <span className="palette__item-label">{item.label}</span>
                  <span className="palette__item-description">{item.description}</span>
                </li>
              );
            }
            return (
              <li
                key={item.note.id}
                className={`palette__item ${isActive ? 'active' : ''}`}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setIndex(i)}
              >
                <span className="palette__item-icon"><FileText size={14} strokeWidth={1.6} /></span>
                <span className="palette__item-label">{item.note.title || 'Untitled'}</span>
                {item.note.tags.length > 0 && (
                  <span className="palette__item-tags">
                    {item.note.tags.slice(0, 3).map((t) => (
                      <span key={t} className="palette__tag">{t}</span>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {items.length > 0 && (
          <div className="palette__footer">
            <span>↑↓ navigate</span><span>↵ select</span><span>esc close</span>
          </div>
        )}
      </div>
    </div>
  );
}
