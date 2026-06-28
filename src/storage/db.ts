import Dexie, { type Table } from 'dexie';
import type { Note, Folder } from './types';
import type { LWWDoc } from '../crdt';

export interface MetaEntry {
  key: string;
  value: string | number;
}

export class WickerlyDB extends Dexie {
  notes!: Table<Note, string>;
  folders!: Table<Folder, string>;
  crdt_docs!: Table<LWWDoc, string>;
  meta!: Table<MetaEntry, string>;

  constructor(name = 'wickerly') {
    super(name);

    this.version(1).stores({
      notes: 'id, folderId, updatedAt, createdAt, *tags',
      folders: 'id, parentId, updatedAt',
    });

    this.version(2).stores({
      notes: 'id, folderId, updatedAt, createdAt, pinned, archived, *tags',
      folders: 'id, parentId, updatedAt',
    });

    this.version(3).stores({
      notes: 'id, folderId, updatedAt, createdAt, pinned, archived, *tags',
      folders: 'id, parentId, updatedAt',
      crdt_docs: 'id',
      meta: 'key',
    });
  }
}

export const db = new WickerlyDB();
