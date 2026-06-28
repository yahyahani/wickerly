import type {
  Note,
  Folder,
  NoteCreateInput,
  NoteUpdateInput,
  FolderCreateInput,
  FolderUpdateInput,
} from './types';
import type { LWWDoc } from '../crdt';

/**
 * StorageAdapter — the single seam between the app and its persistence layer.
 *
 * Every implementation (IndexedDB today, CRDT-backed sync tomorrow) must
 * satisfy this interface. The app never imports a concrete adapter directly;
 * it receives one via StorageContext. Swap the adapter → everything else stays.
 *
 * Invariants all implementations must uphold:
 *  - `create*` assigns a unique id and sets createdAt/updatedAt to Date.now().
 *  - `update*` always bumps updatedAt; it never touches createdAt.
 *  - Deleting a note removes it permanently (no soft-delete at this layer).
 *  - Methods are async so a network-backed CRDT adapter fits without refactoring.
 */
export interface StorageAdapter {
  // ── Notes ──────────────────────────────────────────────────────────────────
  getNotes(): Promise<Note[]>;
  getNoteById(id: string): Promise<Note | undefined>;
  createNote(input: NoteCreateInput): Promise<Note>;
  updateNote(id: string, input: NoteUpdateInput): Promise<Note>;
  deleteNote(id: string): Promise<void>;

  // ── Folders ────────────────────────────────────────────────────────────────
  getFolders(): Promise<Folder[]>;
  getFolderById(id: string): Promise<Folder | undefined>;
  createFolder(input: FolderCreateInput): Promise<Folder>;
  updateFolder(id: string, input: FolderUpdateInput): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;

  // ── CRDT sync surface ──────────────────────────────────────────────────────
  // The UI never calls these; they are the contract for the sync transport layer.
  getPeerId(): Promise<string>;
  getCRDTDoc(noteId: string): Promise<LWWDoc | undefined>;
  getAllCRDTDocs(): Promise<LWWDoc[]>;
  applyRemoteDoc(incoming: LWWDoc): Promise<Note>;
}
