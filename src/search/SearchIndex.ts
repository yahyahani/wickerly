import lunr from 'lunr';
import type { Note } from '../storage/types';

export interface SearchResult {
  noteId: string;
  score: number;
}

/**
 * In-memory full-text index backed by Lunr.
 *
 * Rebuild strategy: rebuild the whole index on mount and after each mutation.
 * For Phase 1 this is fine (< a few thousand notes). A future phase can swap
 * this for an incremental index or a WASM-based engine without touching
 * the callsites — they only see `search()`.
 */
export class SearchIndex {
  private index: lunr.Index | null = null;
  private noteMap = new Map<string, Note>();

  build(notes: Note[]): void {
    this.noteMap.clear();
    for (const n of notes) this.noteMap.set(n.id, n);

    this.index = lunr(function () {
      this.ref('id');
      this.field('title', { boost: 10 });
      this.field('content');
      this.field('tags', { boost: 5 });

      for (const note of notes) {
        this.add({
          id: note.id,
          title: note.title,
          content: note.content,
          tags: note.tags.join(' '),
        });
      }
    });
  }

  search(query: string): SearchResult[] {
    if (!this.index || !query.trim()) return [];
    try {
      return this.index.search(query).map((r) => ({
        noteId: r.ref,
        score: r.score,
      }));
    } catch {
      // Lunr throws on certain malformed queries; return empty gracefully.
      return [];
    }
  }

  getNote(id: string): Note | undefined {
    return this.noteMap.get(id);
  }
}

export const globalSearchIndex = new SearchIndex();
