import Dexie, { type Table } from 'dexie';
import type { Note, Folder } from './types';

export class WickerlyDB extends Dexie {
  notes!: Table<Note, string>;
  folders!: Table<Folder, string>;

  constructor() {
    super('wickerly');

    this.version(1).stores({
      notes: 'id, folderId, updatedAt, createdAt, *tags',
      folders: 'id, parentId, updatedAt',
    });

    this.version(2).stores({
      notes: 'id, folderId, updatedAt, createdAt, pinned, archived, *tags',
      folders: 'id, parentId, updatedAt',
    });
  }
}

export const db = new WickerlyDB();
