# Wickerly — Roadmap

## Phase 1 — Local foundation (current)

- [x] Project scaffold (Tauri 2 + React 19 + Vite 7)
- [x] `StorageAdapter` interface with Dexie/IndexedDB implementation
- [x] Note CRUD (create, read, update, delete)
- [x] Markdown editor (CodeMirror 6) with live preview toggle
- [x] Tags and folder assignment per note
- [x] Full-text search via Lunr.js (title × 10, tags × 5, content)
- [x] Dashboard: activity bar chart (30 days), edit heatmap (90 days), tag cloud, recently edited
- [x] Autosave (1 s debounce)
- [ ] Folder sidebar (tree view, drag-and-drop)
- [ ] Keyboard shortcuts (⌘K command palette)
- [ ] Note export: Markdown file, PDF
- [ ] Settings page (theme toggle, font size)
- [ ] Onboarding / empty state

## Phase 2 — Sync engine

- [ ] Design CRDT data model (Automerge vs Yjs evaluation)
- [ ] `CrdtStorageAdapter` implementing `StorageAdapter`
- [ ] Local-first conflict resolution (no merge prompts for the user)
- [ ] Sync relay server (minimal WebSocket server or use PartyKit)
- [ ] End-to-end encryption (keys stored in OS keychain via Tauri plugin)
- [ ] Device management UI

## Phase 3 — Knowledge graph

- [ ] `[[wiki-link]]` syntax in editor with backlink index
- [ ] Graph view (force-directed, D3 or Sigma.js)
- [ ] Transclusion (embed blocks from other notes)
- [ ] Daily notes / journal mode

## Phase 4 — AI features

- [ ] Local summarisation (Ollama / llama.cpp via Tauri sidecar)
- [ ] Semantic search (vector embeddings, local FAISS)
- [ ] Smart tagging suggestions

---

## Architecture principles to preserve through all phases

1. **`StorageAdapter` stays the seam** — never bypass it with a direct `db.*` call in UI code.
2. **Search is derived** — always rebuilt from the source-of-truth note list; never a separate write path.
3. **Dashboard is stateless** — all stats are `useMemo` over the notes array; no caching layer.
4. **Rust stays thin** until a feature truly needs it (native IO, crypto, background threads).
