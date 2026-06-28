import { useState, useRef } from 'react';
import {
  ChevronRight,
  Folder as FolderIcon,
  FolderOpen,
  Library,
  FilePlus,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Folder, Note, FolderCreateInput, FolderUpdateInput } from '../storage/types';
import './FolderTree.css';

type FolderNode = Folder & { children: FolderNode[]; noteCount: number };

function buildTree(folders: Folder[], notes: Note[], parentId: string | null): FolderNode[] {
  return folders
    .filter((f) => f.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => ({
      ...f,
      children: buildTree(folders, notes, f.id),
      noteCount: notes.filter((n) => n.folderId === f.id).length,
    }));
}

interface Props {
  folders: Folder[];
  notes: Note[];
  activeFolderId: string | null;   // null = "All notes" (no folder filter)
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (input: FolderCreateInput) => Promise<Folder>;
  onUpdateFolder: (id: string, input: FolderUpdateInput) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onCreateNoteInFolder: (folderId: string | null) => void;
}

export function FolderTree({
  folders,
  notes,
  activeFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onCreateNoteInFolder,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const tree = buildTree(folders, notes, null);

  function toggleExpand(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startEdit(folder: Folder, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(folder.id);
    setEditingName(folder.name);
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 0);
  }

  async function commitEdit() {
    if (!editingId) return;
    const name = editingName.trim();
    if (name) await onUpdateFolder(editingId, { name });
    setEditingId(null);
  }

  async function handleCreateFolder(parentId: string | null, e: React.MouseEvent) {
    e.stopPropagation();
    const folder = await onCreateFolder({ name: 'New folder', parentId });
    if (parentId) setExpandedIds((prev) => new Set([...prev, parentId]));
    setEditingId(folder.id);
    setEditingName('New folder');
    setTimeout(() => { editRef.current?.focus(); editRef.current?.select(); }, 0);
  }

  async function handleDelete(id: string, name: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete folder "${name}"?\nNotes inside will be moved to root.`)) return;
    await onDeleteFolder(id);
    if (activeFolderId === id) onSelectFolder(null);
  }

  function renderNode(node: FolderNode, depth: number) {
    const isExpanded = expandedIds.has(node.id);
    const isActive = activeFolderId === node.id;
    const isEditing = editingId === node.id;
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={`folder-node ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
          onClick={() => onSelectFolder(node.id)}
        >
          <button
            className="folder-node__chevron"
            onClick={(e) => toggleExpand(node.id, e)}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          >
            <ChevronRight
              size={11}
              strokeWidth={2.2}
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}
            />
          </button>
          <span className="folder-node__icon">
            {isExpanded && hasChildren
              ? <FolderOpen size={13} strokeWidth={1.6} />
              : <FolderIcon size={13} strokeWidth={1.6} />}
          </span>
          {isEditing ? (
            <input
              ref={editRef}
              className="folder-node__rename"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditingId(null);
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="folder-node__name" onDoubleClick={(e) => startEdit(node, e)}>
              {node.name}
            </span>
          )}
          <span className="folder-node__count">{node.noteCount}</span>
          <span className="folder-node__actions">
            <button title="New note here" onClick={(e) => { e.stopPropagation(); onCreateNoteInFolder(node.id); }}>
              <FilePlus size={12} strokeWidth={1.8} />
            </button>
            <button title="New subfolder" onClick={(e) => handleCreateFolder(node.id, e)}>
              <FolderPlus size={12} strokeWidth={1.8} />
            </button>
            <button title="Rename" onClick={(e) => startEdit(node, e)}>
              <Pencil size={11} strokeWidth={1.8} />
            </button>
            <button title="Delete folder" className="folder-node__action-delete" onClick={(e) => handleDelete(node.id, node.name, e)}>
              <Trash2 size={11} strokeWidth={1.8} />
            </button>
          </span>
        </div>
        {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="folder-tree">
      <div className="folder-tree__header">
        <span className="folder-tree__title">Folders</span>
        <button className="folder-tree__add" title="New folder" onClick={(e) => handleCreateFolder(null, e)}>
          <FolderPlus size={13} strokeWidth={1.8} />
        </button>
      </div>

      {/* "All notes" row */}
      <div
        className={`folder-node ${activeFolderId === null ? 'active' : ''}`}
        style={{ paddingLeft: '8px' }}
        onClick={() => onSelectFolder(null)}
      >
        <span className="folder-node__chevron" style={{ visibility: 'hidden' }}>
          <ChevronRight size={11} strokeWidth={2.2} />
        </span>
        <span className="folder-node__icon">
          <Library size={13} strokeWidth={1.6} />
        </span>
        <span className="folder-node__name">All notes</span>
        <span className="folder-node__count">{notes.length}</span>
      </div>

      {tree.map((node) => renderNode(node, 0))}
    </div>
  );
}
