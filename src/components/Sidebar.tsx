import { useTheme } from '../hooks/useTheme';
import './Sidebar.css';

type View = 'notes' | 'dashboard';

interface Props {
  activeView: View;
  onViewChange: (v: View) => void;
  onOpenPalette: () => void;
}

export function Sidebar({ activeView, onViewChange, onOpenPalette }: Props) {
  const { theme, toggle } = useTheme();

  return (
    <nav className="sidebar">
      <div className="sidebar__logo">W</div>

      <button
        className={`sidebar__btn ${activeView === 'notes' ? 'active' : ''}`}
        onClick={() => onViewChange('notes')}
        title="Notes"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 3h10M3 6h10M3 9h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M9 11.5l2-2 2.5 2.5-2 2L9 11.5z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <button
        className={`sidebar__btn ${activeView === 'dashboard' ? 'active' : ''}`}
        onClick={() => onViewChange('dashboard')}
        title="Dashboard"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="8" width="3" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="6.5" y="5" width="3" height="9" rx="1" stroke="currentColor" strokeWidth="1.5"/>
          <rect x="11" y="2" width="3" height="12" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        </svg>
      </button>

      <div className="sidebar__spacer" />

      <button
        className="sidebar__btn"
        onClick={toggle}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M7.5 1v1.5M7.5 12.5V14M1 7.5h1.5M12.5 7.5H14M3.05 3.05l1.06 1.06M10.9 10.9l1.05 1.05M10.9 4.1l1.05-1.05M3.05 11.95l1.06-1.06" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M13 8.5A5.5 5.5 0 1 1 6.5 2c-.3 2.8 1.8 5.2 4.2 6A5.4 5.4 0 0 0 13 8.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      <button
        className="sidebar__btn"
        onClick={onOpenPalette}
        title="Command palette (⌘K)"
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M4.5 3.5A1 1 0 0 0 3.5 4.5v1a1 1 0 0 1-1 1H2M4.5 3.5A1 1 0 0 1 5.5 4.5v1a1 1 0 0 0 1 1H7M4.5 3.5v-1A1 1 0 0 0 3.5 1.5H2.5A1 1 0 0 0 1.5 2.5v1a1 1 0 0 0 1 1H3.5M10.5 3.5A1 1 0 0 1 11.5 4.5v1a1 1 0 0 0 1 1H13M10.5 3.5A1 1 0 0 0 9.5 4.5v1a1 1 0 0 1-1 1H8M10.5 3.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1M5 9l2 2 3-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </nav>
  );
}
