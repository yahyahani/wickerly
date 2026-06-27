import { useState, useCallback, useEffect } from 'react';
import type { Note } from '../storage/types';
import { globalSearchIndex, type SearchResult } from './SearchIndex';

export function useSearch(notes: Note[]) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    globalSearchIndex.build(notes);
    if (query) setResults(globalSearchIndex.search(query));
  }, [notes, query]);

  const search = useCallback((q: string) => {
    setQuery(q);
    setResults(q.trim() ? globalSearchIndex.search(q) : []);
  }, []);

  return { query, results, search };
}
