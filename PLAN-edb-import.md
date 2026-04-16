# Plan: Import CoNLL-U Treebank Data into editions.db

## Context

**Source**: `/home/blu/src/ai/conllu-viz/` — TypeScript CoNLL-U parser in `src/types.ts` producing typed `Token[]`/`Sentence[]`/`Treebank`.

**Target**: `/home/blu/src/greek/lyceum/reader/data/editions.db` — SQLite db with authors → works → editions → segments, plus aligned_segments/aligned_words, text_metadata.

**Lyceum ecosystem**: orchestrator (Go) processes texts; texts repo has published `.conllu` files in `interlinear/`. The orchestrator does **not** persist treebank data in editions.db.

## Problem

Treebank data (dependency graph, feats, deps, xpos) lives in `.conllu` files but is not in editions.db. The `aligned_words` table stores a flat subset (lemma, pos, morphology blob) but loses the structured tree.

## Goal

Node.js tool that:
1. Parses `.conllu` files → structured data
2. Extends editions.db schema for treebank tokens
3. Imports conllu data with proper edition linking
4. Idempotent — safe to re-run
5. Eventually becomes a step in the orchestrator's ship pipeline

## Decisions

1. **URN Mapping**: Use a JSON config `conllu-edition-map.json` mapping conllu file paths/names → edition URNs.
2. **Auto-create hierarchy**: If author/work/edition doesn't exist, create it.
3. **Translations**: Prose translations from conllu → `aligned_segments.greek` (Greek text). Add `literal_translation` column to `aligned_segments`. Literal translations stored there.
4. **Orchestrator integration**: Yes — this importer will eventually be called as a step in the orchestrator ship pipeline. Initially standalone.

## Schema Extensions

### treebank_tokens (new table)

```sql
CREATE TABLE treebank_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id INTEGER NOT NULL REFERENCES editions(id),
  reference TEXT NOT NULL,
  token_index INTEGER NOT NULL,
  form TEXT NOT NULL,
  lemma TEXT,
  upos TEXT,
  xpos TEXT,
  feats TEXT,
  head INTEGER,
  deprel TEXT,
  deps TEXT,
  misc TEXT
);
CREATE INDEX idx_tb_tokens_ed_ref ON treebank_tokens(edition_id, reference);
CREATE INDEX idx_tb_tokens_ed_ref_idx ON treebank_tokens(edition_id, reference, token_index);
```

### aligned_segments (modify — add column)

```sql
ALTER TABLE aligned_segments ADD COLUMN literal_translation TEXT DEFAULT NULL;
```

## URN Map Format

```json
{
  "aesop-perry-257.conllu": {
    "editionUrn": "urn:lyceum:aesop:fables",
    "authorUrn": "urn:lyceum:author:aesop",
    "authorName": "Aesop",
    "workUrn": "urn:lyceum:aesop:fables",
    "workTitle": "Fables",
    "language": "grc",
    "editionLabel": "Perry 257",
    "editionType": "treebank",
    "editionDescription": "Aesop's Fable 257 (treebank edition)"
  }
}
```

## Implementation Structure

```
/home/blu/src/ai/conllu-viz/
├── src/
│   ├── types.ts          # existing (CoNLL-U types + parser)
│   ├── segment.ts        # existing
│   ├── morpho.ts         # existing
│   ├── db-schema.ts      # new: schema migrations
│   └── importer.ts       # new: core import logic
├── conllu-edition-map.json  # new: filename → edition URN mapping
├── scripts/
│   └── import-conllu.ts     # new: CLI entry point
├── package.json          # add: better-sqlite3
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/db-schema.ts` | Migration functions (create treebank_tokens table, add literal_translation col) |
| `src/importer.ts` | Core logic: parse → resolve edition → upsert treebank_tokens + aligned_segments |
| `scripts/import-conllu.ts` | CLI: `<path> [--db <path>] [--map <path>] [--dry-run]` |
| `conllu-edition-map.json` | URN mapping config |

## Phase 1: Core Tool

1. Add `better-sqlite3` dependency
2. Create `src/db-schema.ts` — idempotent migration
3. Create `src/importer.ts` — parse, resolve, insert
4. Create `scripts/import-conllu.ts` — CLI with args
5. Create `conllu-edition-map.json` — initial mapping for test file
6. Test with `test-data/aesop-perry-257.conllu`

## Future Phases

- Batch import from texts repo
- Orchestrator integration (ship command calls importer)
- Back-fill existing editions missing treebank data
- Generate URN map automatically for texts repo structure
