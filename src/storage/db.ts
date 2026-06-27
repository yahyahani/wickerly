import Dexie, { type Table } from 'dexie';
import type { Note, Folder } from './types';

export class WickerlyDB extends Dexie {
  notes!: Table<Note, string>;
  folders!: Table<Folder, string>;

  constructor() {
    super('wickerly');

    this.version(1).stores({
      // Only indexed fields go here. 'id' is the primary key (++id for auto,
      // 'id' for manual). We index updatedAt for dashboard queries and tags
      // for tag-cloud lookups.
      notes: 'id, folderId, updatedAt, createdAt, *tags',
      folders: 'id, parentId, updatedAt',
    });
  }
}

export const db = new WickerlyDB();
