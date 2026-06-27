import type { ActivityCell } from './useDashboardStats';
import './ActivityHeatmap.css';

interface Props {
  cells: ActivityCell[];
}

function intensityClass(count: number): string {
  if (count === 0) return 'heat-0';
  if (count === 1) return 'heat-1';
  if (count <= 3) return 'heat-2';
  if (count <= 6) return 'heat-3';
  return 'heat-4';
}

export function ActivityHeatmap({ cells }: Props) {
  return (
    <div className="heatmap">
      {cells.map((cell) => (
        <div
          key={cell.date}
          className={`heatmap__cell ${intensityClass(cell.count)}`}
          title={`${cell.date}: ${cell.count} edits`}
        />
      ))}
    </div>
  );
}
