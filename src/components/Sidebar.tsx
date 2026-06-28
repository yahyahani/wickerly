import './Sidebar.css';

type View = 'notes' | 'dashboard';

interface Props {
  activeView: View;
  onViewChange: (v: View) => void;
  onOpenPalette: () => void;
}

export function Sidebar({ activeView, onViewChange, onOpenPalette }: Props) {
  return (
    <nav className="sidebar">
      <div className="sidebar__logo">W</div>
      <button
        className={`sidebar__btn ${activeView === 'notes' ? 'active' : ''}`}
        onClick={() => onViewChange('notes')}
        title="Notes"
      >
        ✏️
      </button>
      <button
        className={`sidebar__btn ${activeView === 'dashboard' ? 'active' : ''}`}
        onClick={() => onViewChange('dashboard')}
        title="Dashboard"
      >
        📊
      </button>
      <div className="sidebar__spacer" />
      <button
        className="sidebar__btn"
        onClick={onOpenPalette}
        title="Command palette (⌘K)"
      >
        ⌘
      </button>
    </nav>
  );
}
