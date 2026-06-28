import {
  FileText,
  BarChart2,
  Sun,
  Moon,
  Command,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import type { SyncStatus } from '../sync/useSyncManager';
import './Sidebar.css';

type View = 'notes' | 'dashboard';

interface Props {
  activeView: View;
  onViewChange: (v: View) => void;
  onOpenPalette: () => void;
  syncStatus?: SyncStatus;
}

function syncTooltip(s: SyncStatus): string {
  if (!s.available) return 'Sync not available';
  const peers = s.peerCount === 1 ? '1 peer' : `${s.peerCount} peers`;
  const time = s.lastSyncAt
    ? `· synced ${new Date(s.lastSyncAt).toLocaleTimeString()}`
    : '· not yet synced';
  return s.peerCount === 0 ? 'Searching for peers…' : `${peers} ${time}`;
}

export function Sidebar({ activeView, onViewChange, onOpenPalette, syncStatus }: Props) {
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

      {syncStatus?.available && (
        <div className="sidebar__sync" title={syncTooltip(syncStatus)}>
          <span className={`sidebar__sync-dot${syncStatus.peerCount > 0 ? ' connected' : ''}`} />
        </div>
      )}

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
