<p align="center">
  <img src="assets/wickerly-logo.svg" alt="Wickerly logo" width="480" />
</p>

<p align="center">
  <strong>Lokale-eerste notities en kennisbank — op weg naar een eigen CRDT-sync-engine.</strong>
</p>

---

Wickerly is een desktop-app om notities bij te houden en kennis op te bouwen — volledig offline bruikbaar, met een ingebouwd dashboard en een architectuur die klaar is om later een eigen CRDT-gebaseerde sync-engine te krijgen zonder dat de rest van de app gesloopt hoeft te worden.

## Features (Fase 1)

- **Markdown editor** met live-preview-toggle (CodeMirror 6)
- **Mappen** — notities in een boomstructuur plaatsen, hernoemen, verplaatsen
- **Tags** — chip-invoer per notitie, filter op tag in de sidebar
- **Full-text search** — razendsnel zoeken op titel, tags en inhoud (Lunr.js)
- **⌘K command palette** — spring naar een notitie of voer een actie uit zonder muis
- **Dashboard** — activiteitsgrafieken, edit-heatmap (90 dagen), tag-cloud, recente notities
- **Autosave** — 1 seconde na de laatste toetsaanslag

## Tech stack

| Laag | Technologie |
|------|------------|
| Desktop shell | Tauri 2 (Rust) |
| UI | React 19 + TypeScript |
| Build | Vite 7 |
| Editor | CodeMirror 6 (`@uiw/react-codemirror`) |
| Opslag | IndexedDB via Dexie 4 — achter een `StorageAdapter` interface |
| Zoeken | Lunr.js |
| Grafieken | Recharts 3 |
| Datumlogica | date-fns 4 |

## Lokaal draaien

**Vereisten:** Node 18+, Rust 1.70+ (via [rustup](https://rustup.rs))

```bash
# 1. Dependencies installeren
npm install

# 2. App starten met hot reload
npm run tauri dev

# 3. Distribueerbaar pakket bouwen
npm run tauri build
```

> Als Rust niet in je PATH staat (macOS): voeg `export PATH="$HOME/.cargo/bin:$PATH"` toe aan je shell-profiel.

## Projectstructuur

```
src/
  editor/        CodeMirror editor, markdown-preview, NoteEditor (autosave)
  dashboard/     Statistieken + Recharts-grafieken + activiteitsheatmap
  storage/       StorageAdapter interface + Dexie-implementatie + React-context
  search/        Lunr full-text index + useSearch hook
  components/    Sidebar, FolderTree, TagFilter, NoteList, TagChipInput, CommandPalette
  hooks/         useNotes, useFolders

src-tauri/       Rust/Tauri backend (bewust minimaal; groeit in Fase 2)
assets/          Logo en statische bestanden
docs/
  ARCHITECTURE.md   Lagenontwerp, de StorageAdapter-naad, toekomstige CRDT-swap
  ROADMAP.md        Featuretijdlijn van Fase 1 t/m Fase 4
```

## Architectuur in één zin

Alle persistentie loopt via `src/storage/StorageAdapter.ts` — een TypeScript-interface. Vandaag zit daar een Dexie/IndexedDB-implementatie achter; morgen een CRDT-adapter. Zie [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) voor de volledige uitleg.

## Roadmap

| Fase | Inhoud |
|------|--------|
| **1 — Lokale basis** (nu) | CRUD, editor, mappen, tags, search, dashboard, ⌘K palette |
| **2 — CRDT-sync** | `CrdtStorageAdapter`, P2P/relay sync, end-to-end encryptie |
| **3 — Kennisgraaf** | `[[wiki-links]]`, backlinks, graafview, transclusion |
| **4 — AI-features** | Lokale samenvatting (Ollama), semantisch zoeken, slimme tags |

## Licentie

MIT
