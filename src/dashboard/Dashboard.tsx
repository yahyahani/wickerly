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
import { useTheme } from '../hooks/useTheme';
import './Dashboard.css';

interface Props {
  notes: Note[];
  onSelectNote: (id: string) => void;
}

export function Dashboard({ notes, onSelectNote }: Props) {
  const { totalNotes, dailyCounts, tagCounts, activityCells, recentNotes } =
    useDashboardStats(notes);
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const c = {
    created:    dark ? '#5EA07E' : '#4A7C64',
    edited:     dark ? '#C47E58' : '#B26A44',
    axis:       dark ? '#786858' : '#907C6A',
    tooltipBg:  dark ? '#221B14' : '#F4EFE6',
    tooltipBdr: dark ? '#3A2E1E' : '#CFC5B2',
    tooltipLbl: dark ? '#EDE6D2' : '#1C1610',
    tooltipItm: dark ? '#A89880' : '#5A4E3E',
  };

  return (
    <div className="dashboard">
      <h1 className="dashboard__title">Dashboard</h1>

      <div className="dashboard__stats">
        <StatCard label="Total notes"  value={totalNotes} />
        <StatCard label="Tags in use"  value={tagCounts.length} />
        <StatCard
          label="Last edited"
          value={recentNotes[0] ? format(recentNotes[0].updatedAt, 'd MMM yyyy') : '—'}
        />
      </div>

      <section className="dashboard__section">
        <h2>Activity — last 30 days</h2>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={dailyCounts} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
            <XAxis
              dataKey="date"
              tick={{ fill: c.axis, fontSize: 10, fontFamily: 'var(--font-ui)' }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fill: c.axis, fontSize: 10, fontFamily: 'var(--font-ui)' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
              contentStyle={{
                background: c.tooltipBg,
                border: `1px solid ${c.tooltipBdr}`,
                borderRadius: 8,
                fontFamily: 'var(--font-ui)',
              }}
              labelStyle={{ color: c.tooltipLbl, fontWeight: 500 }}
              itemStyle={{ color: c.tooltipItm }}
            />
            <Bar dataKey="created" name="Created" fill={c.created} radius={[4, 4, 0, 0]} />
            <Bar dataKey="edited"  name="Edited"  fill={c.edited}  radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="dashboard__section">
        <h2>Edit heatmap — last 90 days</h2>
        <ActivityHeatmap cells={activityCells} />
      </section>

      <div className="dashboard__columns">
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
                  style={{ fontSize: `${Math.max(0.75, Math.min(1.7, 0.78 + count * 0.14))}rem` }}
                >
                  {tag}<sup>{count}</sup>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="dashboard__section">
          <h2>Recently edited</h2>
          <ul className="recent-list">
            {recentNotes.map((note) => (
              <li key={note.id} className="recent-list__item" onClick={() => onSelectNote(note.id)}>
                <span className="recent-list__title">{note.title || 'Untitled'}</span>
                <span className="recent-list__date">{format(note.updatedAt, 'd MMM')}</span>
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
