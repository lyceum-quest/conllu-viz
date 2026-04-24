# conllu-viz

Interactive visualizer for [CoNLL-U](https://universaldependencies.org/format.html) dependency trees, built for Ancient Greek language learning.

## Features

- **Dependency tree view** — Pan/zoom SVG trees with color-coded POS tags and dependency relations. Click any node for full morphology analysis.
- **Reader mode** — Flowing prose display with progressive layers (lemmas, glosses, morphology, translations) toggled on/off.
- **SRS study** — Anki-style spaced repetition (SM-2) for vocabulary review with Again/Hard/Good/Easy grading.
- **Greek word segmentation** — Morpheme-level color highlighting in word cards.
- **Multi-sentence navigation** — Sidebar with sentence list, arrow key navigation.
- **Import & persistence** — Load `.conllu` files via drag-and-drop or file picker; data saved to IndexedDB. Bulk import via CLI with SQLite backend.
- **SVG export** — Save trees as `.svg` files.

## Quick Start

```bash
npm install
npm run dev       # → http://localhost:3000
```

Drop a `.conllu` file onto the page, or click **Open**. Sample files are in `test-data/`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run deploy` | rsync `dist/` to server (requires `.env`) |
| `npm run import` | Bulk-import `.conllu` files into SQLite |

## Bulk Import

The import script reads `.conllu` files into a SQLite database for server-side use.

```bash
CONLLU_DB_PATH=./data.db npm run import -- --dir ./test-data
```

See `.env.example` for all configuration options.

## Project Structure

```
src/
  main.ts       Entry point, router, tree view logic
  browser.ts    File browser page
  reader.ts     Reader mode
  study.ts      SRS study session
  srs.ts        SM-2 spaced repetition algorithm
  store.ts      IndexedDB persistence
  importer.ts   Server-side bulk import
  db-schema.ts  SQLite migrations
  layout.ts     Tree layout engine
  renderer.ts   SVG rendering + pan/zoom
  morpho.ts     Morphology analysis HTML
  segment.ts    Greek word segmentation
  types.ts      CoNLL-U parser + types
  router.ts     Hash-based routing
  styles/       CSS
test-data/      Sample CoNLL-U files (Aesop, Xenophon)
```

## License

Private
