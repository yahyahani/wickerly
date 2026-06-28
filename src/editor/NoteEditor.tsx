import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Pin, PinOff, Archive, ArchiveRestore, Download } from 'lucide-react';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownPreview } from './MarkdownPreview';
import type { Note, Folder, NoteUpdateInput } from '../storage/types';
import { TagChipInput } from '../components/TagChipInput';
import './NoteEditor.css';

interface Props {
  note: Note;
  notes: Note[];
  folders: Folder[];
  onSave: (id: string, input: NoteUpdateInput) => Promise<unknown>;
  onSelectNote: (id: string) => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
}

const AUTOSAVE_DELAY_MS = 1000;

export function NoteEditor({
  note, notes, folders, onSave, onSelectNote, onTogglePin, onToggleArchive,
}: Props) {
  const [title, setTitle]         = useState(note.title);
  const [content, setContent]     = useState(note.content);
  const [tags, setTags]           = useState<string[]>(note.tags);
  const [preview, setPreview]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags);
  }, [note.id]);

  const wordCount = useMemo(() => {
    const text = content.trim();
    return text ? text.split(/\s+/).length : 0;
  }, [content]);

  const readingTime = Math.max(1, Math.ceil(wordCount / 238));

  const scheduleSave = useCallback(
    (patch: NoteUpdateInput) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        await onSave(note.id, patch);
        setSaving(false);
      }, AUTOSAVE_DELAY_MS);
    },
    [note.id, onSave],
  );

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    scheduleSave({ title: e.target.value, content, tags });
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    scheduleSave({ title, content: value, tags });
  };

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags);
    scheduleSave({ title, content, tags: newTags });
  };

  const handleFolderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const folderId = e.target.value === '__root__' ? null : e.target.value;
    await onSave(note.id, { folderId });
  };

  const handleExport = async () => {
    try {
      await invoke<string>('export_note', { title: title || 'Untitled', content });
      setExportMsg('Saved to Downloads');
    } catch {
      setExportMsg('Export failed');
    }
    setTimeout(() => setExportMsg(null), 3000);
  };

  const statusText = exportMsg ?? (saving ? 'Saving…' : null);

  return (
    <div className="note-editor">
      <div className="note-editor__header">
        <input
          className="note-editor__title"
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
        />
        <div className="note-editor__meta">
          <TagChipInput value={tags} onChange={handleTagsChange} />
          <div className="note-editor__controls">
            <select
              className="note-editor__folder-select"
              value={note.folderId ?? '__root__'}
              onChange={handleFolderChange}
            >
              <option value="__root__">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

            <div className="note-editor__icon-group">
              <button
                className={`note-editor__icon-btn${note.pinned ? ' active' : ''}`}
                onClick={onTogglePin}
                title={note.pinned ? 'Unpin' : 'Pin note'}
              >
                {note.pinned
                  ? <PinOff size={13} strokeWidth={1.8} />
                  : <Pin size={13} strokeWidth={1.8} />}
              </button>
              <button
                className="note-editor__icon-btn"
                onClick={onToggleArchive}
                title={note.archived ? 'Unarchive' : 'Archive note'}
              >
                {note.archived
                  ? <ArchiveRestore size={13} strokeWidth={1.8} />
                  : <Archive size={13} strokeWidth={1.8} />}
              </button>
              <button
                className="note-editor__icon-btn"
                onClick={handleExport}
                title="Export as .md"
              >
                <Download size={13} strokeWidth={1.8} />
              </button>
            </div>

            <button
              className={`note-editor__preview-btn${preview ? ' active' : ''}`}
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? 'Edit' : 'Preview'}
            </button>

            {statusText && <span className="note-editor__saving">{statusText}</span>}
          </div>
        </div>

        {wordCount > 0 && (
          <div className="note-editor__wordcount">
            {wordCount.toLocaleString()} words · {readingTime} min read
          </div>
        )}
      </div>

      <div className="note-editor__body">
        {preview ? (
          <MarkdownPreview content={content} notes={notes} onSelectNote={onSelectNote} />
        ) : (
          <MarkdownEditor value={content} onChange={handleContentChange} />
        )}
      </div>
    </div>
  );
}
