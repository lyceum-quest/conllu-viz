# CoNLL-U Pipeline: Progress Tracking

## Aesop Fables

| # | Perry | Difficulty | File | Status |
|---|-------|-----------|------|--------|
| 1 | 257 | 18.8 | perry-257.conllu | ✅ Done |
| 2 | 184 | 19.9 | perry-184.conllu | ✅ Done |
| 3 | 365 | 22.3 | perry-365.conllu | ✅ Done |
| 4 | 45 | 22.7 | perry-045.conllu | ✅ Done |
| 5 | 374 | 23.1 | perry-374.conllu | ✅ Done |
| 6 | 288 | 24.5 | perry-288.conllu | ✅ Done |
| 7 | 250 | 24.7 | perry-250.conllu | ✅ Done |
| 8 | 256 | 25.7 | perry-256.conllu | ✅ Done |
| 9 | 229 | 26.7 | perry-229.conllu | ✅ Done |
| 10 | 15 | 26.8 | perry-015.conllu | ✅ Done |
| 11 | 199 | 26.8 | perry-199.conllu | ✅ Done |
| 12 | 202 | 26.9 | perry-202.conllu | ✅ Done |
| 13 | 378 | 27.2 | perry-378.conllu | ✅ Done |
| 14 | 322 | 27.7 | perry-322.conllu | ✅ Done |
| 15 | 213 | 28.2 | perry-213.conllu | ✅ Done |
| 16 | 289 | 28.2 | perry-289.conllu | ✅ Done |
| 17 | 346 | 28.5 | perry-346.conllu | ✅ Done |
| 18 | 192 | 28.6 | perry-192.conllu | ✅ Done |
| 19 | 174 | 29.1 | perry-174.conllu | ✅ Done |
| 20 | 87 | 29.3 | perry-087.conllu | ✅ Done |
| 21 | 98 | 29.4 | perry-098.conllu | ✅ Done |
| 22 | 27 | 29.5 | perry-027.conllu | ✅ Done |
| 23 | 29 | 29.5 | — | ⬜ Next |

**Next fable**: Read `perry-difficulty-map.csv` and find the first row whose Perry number doesn't have a `.conllu` file. That's your next target.

## Xenophon

| Work | Book | File | Status |
|------|------|------|--------|
| Anabasis | 1 | book-01.tb.conllu | ✅ Done |

## Migration Status

### Aesop → Unified Spec

- [ ] Add file-level headers (`# source`, `# source_edition`, `# encoder`, `# editor`, `# project`, `# conversion_method`, `# gloss_type`, `# license`, `# date_modified`, `# contact`, `# global.columns`)
- [ ] Use `AUX` UPOS for εἰμί as copula/auxiliary
- [ ] Use `INTJ` UPOS for interjections
- [ ] Use `PROPN` UPOS for proper names
- [ ] Consider adding `Ref` to MISC for cross-referencing

### Xenophon → Unified Spec

- [ ] Normalize `# sentence_id` → `# sent_id`
- [ ] Add `# text` header to all sentences (currently only 30/497)
- [ ] Convert XPOS from Glaux morph codes to human-readable format
- [ ] Normalize `__` → `_` in FEATS
- [ ] Normalize `Gloss=` → `gloss=` in MISC (inconsistent capitalization)
- [ ] Replace `nsubjpass` → `nsubj:pass` (deprecated UD v2 relation)
