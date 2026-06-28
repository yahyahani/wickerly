import { useState, useRef, KeyboardEvent } from 'react';
import './TagChipInput.css';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagChipInput({ value, onChange, placeholder = 'Add tag…' }: Props) {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setInputText('');
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputText);
    } else if (e.key === 'Backspace' && inputText === '' && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  }

  function handleBlur() {
    if (inputText.trim()) addTag(inputText);
  }

  return (
    <div className="tag-chip-input" onClick={() => inputRef.current?.focus()}>
      {value.map((tag) => (
        <span key={tag} className="tag-chip-input__chip">
          {tag}
          <button
            className="tag-chip-input__remove"
            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
            tabIndex={-1}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        className="tag-chip-input__input"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : ''}
        size={Math.max(inputText.length + 2, placeholder.length)}
      />
    </div>
  );
}
