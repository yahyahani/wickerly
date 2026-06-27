import { useState, useEffect, useCallback, useRef } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownPreview } from './MarkdownPreview';
import type { Note, NoteUpdateInput } from '../storage/types';
import './NoteEditor.css';

interface Props {
  note: Note;
  onSave: (id: string, input: NoteUpdateInput) => Promise<unknown>;
}

const AUTOSAVE_DELAY_MS = 1000;

export function NoteEditor({ note, onSave }: Props) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState(note.tags.join(', '));
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when a different note is selected
  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags.join(', '));
  }, [note.id]);

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
    scheduleSave({ title: e.target.value, content, tags: parseTags(tags) });
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    scheduleSave({ title, content: value, tags: parseTags(tags) });
  };

  const handleTagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTags(e.target.value);
    scheduleSave({ title, content, tags: parseTags(e.target.value) });
  };

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
          <input
            className="note-editor__tags"
            value={tags}
            onChange={handleTagsChange}
            placeholder="Tags (komma-separated)"
          />
          <button
            className={`note-editor__preview-btn ${preview ? 'active' : ''}`}
            onClick={() => setPreview((p) => !p)}
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
          {saving && <span className="note-editor__saving">Saving…</span>}
        </div>
      </div>
      <div className="note-editor__body">
        {preview ? (
          <MarkdownPreview content={content} />
        ) : (
          <MarkdownEditor value={content} onChange={handleContentChange} />
        )}
      </div>
    </div>
  );
}

function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}
