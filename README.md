# Wickerly

A local-first note-taking and knowledge base application built with Tauri + React.

**Status:** Phase 1 — local foundation

---

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2 (Rust) |
| UI | React 19 + TypeScript |
| Build | Vite 7 |
| Editor | CodeMirror 6 (via @uiw/react-codemirror) |
| Storage | IndexedDB via Dexie 4 |
| Search | Lunr.js |
| Charts | Recharts |

## Getting started

```bash
# Install dependencies
npm install

# Run in dev mode (opens the Tauri window with hot reload)
npm run tauri dev

# Build a distributable
npm run tauri build
```

**Prerequisites:** Node 18+, Rust 1.70+ (`rustup` recommended)

## Project structure

```
src/
  editor/       CodeMirror editor, markdown preview, NoteEditor component
  dashboard/    Stats computation + Recharts charts
  storage/      StorageAdapter interface + Dexie implementation
  search/       Lunr full-text index + useSearch hook
  components/   Sidebar, NoteList
  hooks/        useNotes

src-tauri/      Rust/Tauri backend
docs/
  ARCHITECTURE.md   Layer design and key decisions
  ROADMAP.md        Feature timeline through Phase 4
```

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a full description of
the layer design, the `StorageAdapter` seam, and how the CRDT sync engine will
plug in during Phase 2.

## License

MIT
