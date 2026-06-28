# Wickerly — Architecture

> Last updated: 2026-06-28

## Vision

Wickerly is a **local-first** note-taking and knowledge base application. "Local-first" means:
- Data lives on your device by default.
- The app works fully offline.
- Sync (when added) is an enhancement, not a dependency.

This document describes the current architecture (Phase 1) and the design decisions that keep Phase 2 (CRDT-based sync) possible without rewriting the app.

---

## Layer overview

```
┌─────────────────────────────────────────────────────┐
│                      UI (React)                      │
│  /editor   /dashboard   /components   /hooks        │
├─────────────────────────────────────────────────────┤
│               Search  (Lunr.js)                      │
│  /search/SearchIndex.ts                              │
├─────────────────────────────────────────────────────┤
│            StorageAdapter  (interface)               │
│  /storage/StorageAdapter.ts  ← THE SEAM             │
├──────────────────────┬──────────────────────────────┤
│  DexieStorageAdapter │  (future) CrdtStorageAdapter │
│  IndexedDB via Dexie │  Automerge / Yjs + sync      │
└──────────────────────┴──────────────────────────────┘
        ↕                           ↕
  Local IndexedDB           P2P / server relay
```

---

## Key design decisions

### 1. StorageAdapter — the single seam

`src/storage/StorageAdapter.ts` is an interface, not a class. No module in the
app ever imports a concrete adapter directly; they call `useStorage()` which
returns whatever adapter was provided via `<StorageProvider>`.

**Why this matters for sync:** When you add a CRDT engine (e.g. Automerge or
Yjs), you write a new `CrdtStorageAdapter implements StorageAdapter` and swap
it at the provider level. The editor, dashboard, and search layers see no
difference.

Invariants every adapter must uphold:
- `create*` assigns a new UUID and sets `createdAt`/`updatedAt` to `Date.now()`.
- `update*` bumps `updatedAt`; never touches `createdAt`.
- All methods are `async` so a network adapter fits without refactoring callsites.

### 2. Data model

```ts
interface Note {
  id: string;         // UUID v4
  title: string;
  content: string;    // raw markdown
  tags: string[];
  folderId: string | null;
  createdAt: number;  // unix ms
  updatedAt: number;  // unix ms
}
```

`updatedAt` is the primary sort key. In a CRDT world this becomes a logical
clock or vector clock, but the field name stays the same.

### 3. IndexedDB schema (Dexie v4)

Schema lives in `src/storage/db.ts`. Only indexed fields are declared;
non-indexed fields are stored but not listed. Current indexes:

| Table   | Indexes                        |
|---------|-------------------------------|
| notes   | id (pk), folderId, updatedAt, createdAt, *tags (multi-entry) |
| folders | id (pk), parentId, updatedAt  |

Multi-entry `*tags` makes tag-based filtering a single Dexie query.

### 4. Search (Lunr.js)

`globalSearchIndex` in `src/search/SearchIndex.ts` is rebuilt on every data
mutation. This is O(n) in note count but negligible for < 10 000 notes. The
rebuild happens inside React's effect system so it's always consistent with the
current `notes` array.

Replacement path: swap `SearchIndex` for a WASM-based engine (e.g.
`minisearch`, `stork`, or a Rust-compiled engine exposed via Tauri command)
without touching `useSearch.ts`.

### 5. Editor (CodeMirror 6)

`src/editor/MarkdownEditor.tsx` wraps `@uiw/react-codemirror`. CodeMirror 6 is
modular and extensible — we can add:
- VIM / Emacs keybindings
- Custom syntax highlighting for `[[wiki-links]]`
- Collaborative cursors (Phase 2) via a CM6 plugin

`MarkdownPreview.tsx` uses a minimal hand-rolled renderer for Phase 1. Replace
with `remark`/`rehype` when you need GFM tables, footnotes, or custom directives.

### 6. Dashboard (Recharts)

`src/dashboard/useDashboardStats.ts` derives all stats from the `notes` array
via `useMemo`. No secondary database queries. This keeps the dashboard always
in sync with local state and makes it trivially testable.

---

## Directory map

```
src/
  editor/           CodeMirror editor + preview + NoteEditor wrapper
  dashboard/        Stats computation + Recharts charts + heatmap
  storage/          StorageAdapter interface, Dexie implementation, React context
  search/           Lunr index + useSearch hook
  components/       Shared UI: Sidebar, NoteList
  hooks/            Cross-cutting hooks: useNotes

src-tauri/          Rust/Tauri backend (currently thin; will grow in Phase 2)
docs/               Architecture and roadmap
```

---

## Runtime data flow

```
User types in editor
  → NoteEditor schedules autosave (1 s debounce)
    → useNotes.updateNote()
      → StorageAdapter.updateNote()        (writes to IndexedDB)
        → useNotes.refresh()               (reads all notes back)
          → useSearch rebuilds Lunr index  (O(n) in background)
            → Dashboard stats recomputed   (useMemo, free)
```

---

## What NOT to put in the Rust layer (yet)

Tauri's Rust backend is intentionally thin in Phase 1. The only Rust code is
the boilerplate `run()` and a placeholder `greet` command. Reasons:

1. All storage is IndexedDB (browser-side) — no file I/O needed yet.
2. Adding Rust commands too early locks you into an API surface before the
   data model is stable.

Phase 2 candidates for Rust: file export/import, OS-level keychain access for
sync credentials, background sync daemon.

---

## Phase 2 — CRDT sync (future)

The plan is to introduce Automerge or Yjs as the backing CRDT engine:

1. Write `CrdtStorageAdapter implements StorageAdapter`.
2. Replace `<StorageProvider adapter={new DexieStorageAdapter()}>` with
   `<StorageProvider adapter={new CrdtStorageAdapter(serverUrl)}>`.
3. The CRDT adapter serialises every mutation as an operation and syncs via
   WebSocket or a custom relay.
4. Conflict resolution is handled by the CRDT engine — the UI never sees
   conflicts.

See `ROADMAP.md` for the full feature timeline.
