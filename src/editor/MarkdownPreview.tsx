import { useMemo } from 'react';

interface Props {
  content: string;
}

// Minimal markdown renderer — renders the most common constructs without
// pulling in a heavy parser. Replace with remark/rehype if you need tables,
// footnotes, or custom directives later.
function renderMarkdown(md: string): string {
  return md
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
    // unordered list items
    .replace(/^[-*+]\s(.+)$/gm, '<li>$1</li>')
    // ordered list items
    .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
    // horizontal rule
    .replace(/^---$/gm, '<hr />')
    // links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // line breaks → paragraphs (double newline)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[houlbp])(.+)$/gm, '$1')
    // wrap in paragraphs
    .replace(/^(.+)$/gm, (line) =>
      /^<[houlbphi]|^$/.test(line.trim()) ? line : `<p>${line}</p>`,
    )
    .trim();
}

export function MarkdownPreview({ content }: Props) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className="markdown-preview"
      // Content comes from the user's own notes — no external input.
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
