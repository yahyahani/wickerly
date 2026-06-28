import { useMemo } from 'react';
import type { Note } from '../storage/types';

interface Props {
  content: string;
  notes?: Note[];
  onSelectNote?: (id: string) => void;
  onToggleCheckbox?: (index: number, checked: boolean) => void;
}

function renderMarkdown(md: string, notes?: Note[]): string {
  // Checkboxes FIRST — before the generic list-item replacement
  let cbIdx = 0;
  const withCheckboxes = md.replace(
    /^- \[(x| )\] (.+)$/gim,
    (_, state, text) => {
      const idx = cbIdx++;
      const checked = state === 'x';
      return `<li class="task-item"><input type="checkbox" class="task-checkbox" data-idx="${idx}"${checked ? ' checked' : ''}><span class="task-text">${text}</span></li>`;
    },
  );

  return withCheckboxes
    // [[note-links]] before paragraph wrapping
    .replace(/\[\[(.+?)\]\]/g, (_m, raw: string) => {
      const title = raw.trim();
      const found = notes?.find(
        (n) => n.title.toLowerCase() === title.toLowerCase(),
      );
      if (found) {
        return `<span class="note-link" data-noteid="${found.id}">${title}</span>`;
      }
      return `<span class="note-link note-link--broken">${title}</span>`;
    })
    // headings
    .replace(/^#{6}\s(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#{5}\s(.+)$/gm, '<h5>$1</h5>')
    .replace(/^#{4}\s(.+)$/gm, '<h4>$1</h4>')
    .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    // bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // blockquote
    .replace(/^>\s(.+)$/gm, '<blockquote>$1</blockquote>')
    // unordered list items (not task items — already replaced above)
    .replace(/^[-*+]\s(.+)$/gm, '<li>$1</li>')
    // ordered list items
    .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
    // horizontal rule
    .replace(/^---$/gm, '<hr />')
    // links
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    // paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[houlbp])(.+)$/gm, '$1')
    .replace(/^(.+)$/gm, (line) =>
      /^<[houlbphi]|^$/.test(line.trim()) ? line : `<p>${line}</p>`,
    )
    .trim();
}

export function MarkdownPreview({
  content, notes, onSelectNote, onToggleCheckbox,
}: Props) {
  const html = useMemo(() => renderMarkdown(content, notes), [content, notes]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;

    // Checkbox toggle
    if (target.classList.contains('task-checkbox')) {
      e.preventDefault();
      const cb = target as HTMLInputElement;
      const idx = parseInt(cb.dataset.idx ?? '0', 10);
      if (onToggleCheckbox) onToggleCheckbox(idx, !cb.checked);
      return;
    }

    // [[note-link]] click
    const noteId = target.dataset.noteid;
    if (noteId && onSelectNote) onSelectNote(noteId);
  }

  return (
    <div
      className="markdown-preview"
      onClick={handleClick}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
