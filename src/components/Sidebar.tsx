import {
  FileText,
  BarChart2,
  Sun,
  Moon,
  Command,
} from 'lucide-react';
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
        <FileText size={17} strokeWidth={1.7} />
      </button>

      <button
        className={`sidebar__btn ${activeView === 'dashboard' ? 'active' : ''}`}
        onClick={() => onViewChange('dashboard')}
        title="Dashboard"
      >
        <BarChart2 size={17} strokeWidth={1.7} />
      </button>

      <div className="sidebar__spacer" />

      <button
        className="sidebar__btn"
        onClick={toggle}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark'
          ? <Sun size={16} strokeWidth={1.6} />
          : <Moon size={16} strokeWidth={1.6} />}
      </button>

      <button
        className="sidebar__btn"
        onClick={onOpenPalette}
        title="Command palette (⌘K)"
      >
        <Command size={15} strokeWidth={1.6} />
      </button>
    </nav>
  );
}
