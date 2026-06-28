export interface Note {
  id: string;
  title: string;
  content: string;       // raw markdown
  tags: string[];
  folderId: string | null;
  pinned?: boolean;      // undefined → false; pinned notes appear at top of list
  archived?: boolean;    // undefined → false; archived notes hidden from main view
  createdAt: number;     // unix ms
  updatedAt: number;     // unix ms
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export type NoteCreateInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>;
export type NoteUpdateInput = Partial<Omit<Note, 'id' | 'createdAt'>>;

export type FolderCreateInput = Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>;
export type FolderUpdateInput = Partial<Omit<Folder, 'id' | 'createdAt'>>;
