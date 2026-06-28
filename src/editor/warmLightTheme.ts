import { EditorView } from '@codemirror/view';
import { type Extension } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

const syntax = HighlightStyle.define([
  { tag: tags.heading1, color: 'var(--text)', fontWeight: '700', fontSize: '1.3em' },
  { tag: tags.heading2, color: 'var(--text)', fontWeight: '650', fontSize: '1.15em' },
  { tag: tags.heading3, color: 'var(--text)', fontWeight: '600', fontSize: '1.05em' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: 'var(--text)', fontWeight: '600' },
  { tag: tags.strong,        color: 'var(--text)',   fontWeight: '700' },
  { tag: tags.emphasis,      color: 'var(--text-2)', fontStyle: 'italic' },
  { tag: tags.strikethrough, color: 'var(--text-muted)', textDecoration: 'line-through' },
  { tag: tags.link,          color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.url,           color: 'var(--accent)' },
  { tag: tags.monospace,     color: 'var(--warm)',   fontFamily: 'var(--font-mono)' },
  { tag: tags.quote,         color: 'var(--text-2)', fontStyle: 'italic' },
  { tag: tags.comment,       color: 'var(--text-muted)' },
  { tag: tags.punctuation,   color: 'var(--text-muted)' },
  { tag: tags.content,       color: 'var(--text)' },
]);

export const warmLightTheme: Extension = [
  EditorView.theme(
    {
      '&': { color: 'var(--text)', backgroundColor: 'transparent', height: '100%', fontSize: '14px' },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
      '.cm-content': { caretColor: 'var(--accent)', padding: '12px 16px' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: 'var(--accent-bg)',
      },
      '::selection': { backgroundColor: 'var(--accent-bg)' },
      '.cm-activeLine': { backgroundColor: 'rgba(74,124,100,0.05)' },
      '.cm-line': { padding: '0 2px' },
    },
    { dark: false },
  ),
  syntaxHighlighting(syntax),
];
