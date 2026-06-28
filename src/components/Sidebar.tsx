import './Sidebar.css';

type View = 'notes' | 'dashboard';

interface Props {
  activeView: View;
  onViewChange: (v: View) => void;
}

export function Sidebar({ activeView, onViewChange }: Props) {
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
    </nav>
  );
}
