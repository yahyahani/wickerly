import { useState, useEffect, useCallback, useRef } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownPreview } from './MarkdownPreview';
import type { Note, Folder, NoteUpdateInput } from '../storage/types';
import { TagChipInput } from '../components/TagChipInput';
import './NoteEditor.css';

interface Props {
  note: Note;
  folders: Folder[];
  onSave: (id: string, input: NoteUpdateInput) => Promise<unknown>;
}

const AUTOSAVE_DELAY_MS = 1000;

export function NoteEditor({ note, folders, onSave }: Props) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags);
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
            <button
              className={`note-editor__preview-btn ${preview ? 'active' : ''}`}
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? 'Edit' : 'Preview'}
            </button>
            {saving && <span className="note-editor__saving">Saving…</span>}
          </div>
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
