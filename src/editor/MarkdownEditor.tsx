import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useTheme } from '../hooks/useTheme';
import { warmLightTheme } from './warmLightTheme';

interface Props {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}

const sharedExtensions = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  EditorView.lineWrapping,
];

// Dark-mode base overrides that complement oneDark
const darkBase = EditorView.theme({
  '&': { height: '100%', fontSize: '14px' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
  '.cm-content': { padding: '12px 16px' },
});

export function MarkdownEditor({ value, onChange, readOnly = false }: Props) {
  const { theme } = useTheme();

  const extensions = [
    ...sharedExtensions,
    ...(theme === 'dark' ? [darkBase] : []),
    ...(readOnly ? [EditorView.editable.of(false)] : []),
  ];

  return (
    <CodeMirror
      value={value}
      extensions={extensions}
      theme={theme === 'dark' ? oneDark : warmLightTheme}
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
