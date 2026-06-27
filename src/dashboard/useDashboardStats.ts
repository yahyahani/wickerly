import { useMemo } from 'react';
import { format, eachDayOfInterval, subDays, startOfDay } from 'date-fns';
import type { Note } from '../storage/types';

export interface DailyCount {
  date: string;   // 'yyyy-MM-dd'
  created: number;
  edited: number;
}

export interface TagCount {
  tag: string;
  count: number;
}

export interface ActivityCell {
  date: string;
  count: number;
}

export function useDashboardStats(notes: Note[]) {
  return useMemo(() => {
    const now = Date.now();
    const today = startOfDay(now);
    const days90 = subDays(today, 89);

    // ── Notes created per day (last 30 days) ──────────────────────────────
    const last30days = eachDayOfInterval({ start: subDays(today, 29), end: today });
    const dailyCounts: DailyCount[] = last30days.map((day) => {
      const dayStart = day.getTime();
      const dayEnd = dayStart + 86_400_000;
      return {
        date: format(day, 'MMM d'),
        created: notes.filter((n) => n.createdAt >= dayStart && n.createdAt < dayEnd).length,
        edited: notes.filter((n) => n.updatedAt >= dayStart && n.updatedAt < dayEnd && n.createdAt < dayStart).length,
      };
    });

    // ── Tag cloud ──────────────────────────────────────────────────────────
    const tagMap = new Map<string, number>();
    for (const note of notes) {
      for (const tag of note.tags) {
        tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
      }
    }
    const tagCounts: TagCount[] = [...tagMap.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);

    // ── Activity heatmap (90 days) ─────────────────────────────────────────
    const activityMap = new Map<string, number>();
    for (const note of notes) {
      const key = format(note.updatedAt, 'yyyy-MM-dd');
      activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
    }
    const activityCells: ActivityCell[] = eachDayOfInterval({
      start: days90,
      end: today,
    }).map((day) => {
      const key = format(day, 'yyyy-MM-dd');
      return { date: key, count: activityMap.get(key) ?? 0 };
    });

    // ── Recently edited ────────────────────────────────────────────────────
    const recentNotes = [...notes]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);

    return {
      totalNotes: notes.length,
      dailyCounts,
      tagCounts,
      activityCells,
      recentNotes,
    };
  }, [notes]);
}
