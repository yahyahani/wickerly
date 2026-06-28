import './TagFilter.css';

interface Props {
  allTags: string[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onClear: () => void;
}

export function TagFilter({ allTags, activeTags, onToggleTag, onClear }: Props) {
  if (allTags.length === 0) return null;

  return (
    <div className="tag-filter">
      <div className="tag-filter__header">
        <span className="tag-filter__title">Tags</span>
        {activeTags.length > 0 && (
          <button className="tag-filter__clear" onClick={onClear}>Clear</button>
        )}
      </div>
      <div className="tag-filter__chips">
        {allTags.map((tag) => (
          <button
            key={tag}
            className={`tag-filter__chip ${activeTags.includes(tag) ? 'active' : ''}`}
            onClick={() => onToggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
