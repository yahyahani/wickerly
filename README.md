<div align="center">
  <img src="assets/wickerly-logo.svg" alt="Wickerly" width="72" />
  <h1>Wickerly</h1>
  <p>A local-first note-taking app with a handbuilt CRDT sync engine.<br/>No server. No cloud. Notes sync directly between your devices over your local network.</p>

  <p>
    <img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="MIT License" />
    <img src="https://img.shields.io/badge/platform-macOS-0ea5e9?style=flat-square" alt="macOS" />
    <img src="https://img.shields.io/badge/local--first-no%20telemetry-6366f1?style=flat-square" alt="Local-first, no telemetry" />
    <img src="https://img.shields.io/badge/built%20with-Tauri%202-fbbf24?style=flat-square" alt="Built with Tauri 2" />
  </p>
</div>

---

## What is Wickerly?

Wickerly is a desktop note-taking app for macOS that takes local-first seriously. Your notes live in IndexedDB on your device — no account required, no data leaves your machine unless you want it to.

When you have multiple devices on the same network, Wickerly discovers them automatically via mDNS and syncs notes directly, peer-to-peer. The sync engine is a from-scratch implementation of a **Last-Write-Wins Map CRDT** — each field of every note carries its own Lamport timestamp, so concurrent edits on different devices converge correctly without a central authority deciding who wins.

---

## Features

### Notes & editing
- **Rich Markdown editor** powered by CodeMirror 6, with a live split-preview toggle
- **`[[Note links]]`** — wiki-style backlinks between notes, with a backlinks panel
- **Full-text search** via Lunr.js, across all note content and titles
- **Folders** — nested folder tree with CRUD
- **Tags** — chip-style tag input and sidebar tag filter
- **Pin & archive** — pin notes to the top of the list; archive without deleting
- **Sort order** — sort by last edited, created date, or title A→Z / Z→A
- **Note templates** — create new notes from built-in templates (daily journal, meeting notes, and more)
- **Export to `.md`** — export any note as a plain Markdown file to your Downloads folder
- **Word count & reading time** — live in the editor toolbar

### Organisation & navigation
- **Command palette** (`⌘K`) — jump to any note, create notes, switch views, open templates
- **Dashboard** — stats overview with a writing heatmap, tag cloud, word count chart, and recent notes list
- **Undo delete** — 5-second grace period with an undo toast after deleting a note

### Sync
- **Peer-to-peer LAN sync** — automatic device discovery via mDNS (`_wickerly._tcp.local.`)
- **Handbuilt LWW Map CRDT** — per-field conflict resolution; concurrent edits converge without data loss
- **No server required** — a Rust/axum HTTP server runs locally on each device; peers push and pull directly
- **Sync status indicator** — a live dot in the sidebar shows peer count and last sync time
- **Offline-safe** — offline writes are tracked with Lamport timestamps and merge correctly on reconnect

### App
- **Light & dark mode** — system-aware, toggleable in the sidebar
- **Fully offline** — the app works without any network connection; sync is additive, not required
- **No telemetry** — no analytics, no crash reporting, no network calls except peer-to-peer sync on your LAN

---

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri 2](https://tauri.app) (Rust) |
| UI framework | React 19 + TypeScript |
| Build tool | Vite 7 |
| Editor | CodeMirror 6 |
| Local storage | Dexie 4 (IndexedDB) |
| Search | Lunr.js |
| HTTP sync server | axum 0.7 (Rust, embedded) |
| Peer discovery | mdns-sd 0.11 (Rust) |
| HTTP client | reqwest 0.12 (Rust) |
| CRDT engine | Custom LWW Map implementation (`src/crdt/`) |

---

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org) ≥ 20
- [Rust](https://rustup.rs) (stable toolchain)
- Xcode Command Line Tools (`xcode-select --install`)

### Run in development

```bash
git clone https://github.com/yahyahani/wickerly.git
cd wickerly
npm install
npm run tauri dev
```

The app opens in a native window. The Vite dev server and Rust backend start together; hot-reload works for frontend changes.

### Build a standalone app

```bash
npm run tauri build
```

Output:
- `src-tauri/target/release/bundle/macos/Wickerly.app` — drag to `/Applications`
- `src-tauri/target/release/bundle/dmg/Wickerly_*.dmg` — distributable installer

### Run the tests

```bash
npm test
```

45 tests covering CRDT properties (commutativity, idempotency, associativity, conflict resolution), StorageAdapter integration (Dexie + CRDT), and SyncManager behaviour (incoming docs, peer sync, offline handling).

---

## Architecture

Wickerly is structured in three layers:

```
UI (React)  →  StorageAdapter (TypeScript)  →  Dexie / IndexedDB
                       ↕
               SyncManager (TypeScript)
                       ↕
           TauriSyncTransport  →  Rust (axum + mDNS + reqwest)
```

For a full breakdown of the module structure, data flow, and design decisions:

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — layer overview, module map, and the StorageAdapter seam that keeps sync decoupled from storage
- **[docs/CRDT_DESIGN.md](docs/CRDT_DESIGN.md)** — why LWW Map, how Lamport timestamps work, the proven CRDT properties, and known limitations (no tombstones, atomic content fields, no auth)

---

## Roadmap

See **[docs/ROADMAP.md](docs/ROADMAP.md)** for planned features, including character-level CRDT for concurrent text editing (RGA/LSEQ), OR-Set for tags, and WebRTC transport for sync across networks.

---

## License

[MIT](LICENSE) © 2026 Yahia Hani
