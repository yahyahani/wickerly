import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import type { Note } from '../storage/types';
import { useDashboardStats } from './useDashboardStats';
import { ActivityHeatmap } from './ActivityHeatmap';
import './Dashboard.css';

interface Props {
  notes: Note[];
  onSelectNote: (id: string) => void;
}

export function Dashboard({ notes, onSelectNote }: Props) {
  const { totalNotes, dailyCounts, tagCounts, activityCells, recentNotes } =
    useDashboardStats(notes);

  return (
    <div className="dashboard">
      <h1 className="dashboard__title">Dashboard</h1>

      {/* ── Stats strip ─────────────────────────────────────────────────── */}
      <div className="dashboard__stats">
        <StatCard label="Total notes" value={totalNotes} />
        <StatCard label="Tags in use" value={tagCounts.length} />
        <StatCard
          label="Last edited"
          value={
            recentNotes[0]
              ? format(recentNotes[0].updatedAt, 'd MMM yyyy')
              : '—'
          }
        />
      </div>

      {/* ── Notes created / edited over time ────────────────────────────── */}
      <section className="dashboard__section">
        <h2>Activity — last 30 days</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dailyCounts} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: '#585b70', fontSize: 10 }}
              tickLine={false}
              interval={6}
            />
            <YAxis tick={{ fill: '#585b70', fontSize: 10 }} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#181825', border: '1px solid #313244', borderRadius: 6 }}
              labelStyle={{ color: '#cdd6f4' }}
              itemStyle={{ color: '#a6adc8' }}
            />
            <Bar dataKey="created" name="Created" fill="#89b4fa" radius={[3, 3, 0, 0]} />
            <Bar dataKey="edited" name="Edited" fill="#a6e3a1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* ── Activity heatmap ────────────────────────────────────────────── */}
      <section className="dashboard__section">
        <h2>Edit heatmap — last 90 days</h2>
        <ActivityHeatmap cells={activityCells} />
      </section>

      <div className="dashboard__columns">
        {/* ── Tag cloud ──────────────────────────────────────────────────── */}
        <section className="dashboard__section">
          <h2>Tag cloud</h2>
          {tagCounts.length === 0 ? (
            <p className="dashboard__empty">No tags yet</p>
          ) : (
            <div className="tag-cloud">
              {tagCounts.map(({ tag, count }) => (
                <span
                  key={tag}
                  className="tag-cloud__tag"
                  style={{ fontSize: `${Math.max(0.75, Math.min(1.8, 0.75 + count * 0.15))}rem` }}
                >
                  {tag}
                  <sup>{count}</sup>
                </span>
              ))}
            </div>
          )}
        </section>

        {/* ── Recently edited ────────────────────────────────────────────── */}
        <section className="dashboard__section">
          <h2>Recently edited</h2>
          <ul className="recent-list">
            {recentNotes.map((note) => (
              <li key={note.id} className="recent-list__item" onClick={() => onSelectNote(note.id)}>
                <span className="recent-list__title">{note.title || 'Untitled'}</span>
                <span className="recent-list__date">
                  {format(note.updatedAt, 'd MMM')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <span className="stat-card__value">{value}</span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}
