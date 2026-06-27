import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

interface Props {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const baseTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
  '.cm-content': { padding: '12px 16px' },
});

export function MarkdownEditor({ value, onChange, readOnly = false }: Props) {
  const extensions = [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    baseTheme,
    EditorView.lineWrapping,
    ...(readOnly ? [EditorView.editable.of(false)] : []),
  ];

  return (
    <CodeMirror
      value={value}
      extensions={extensions}
      theme={oneDark}
      onChange={onChange}
      style={{ height: '100%' }}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: true,
        autocompletion: false,
      }}
    />
  );
}
