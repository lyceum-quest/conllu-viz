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
| 23 | 29 | 29.5 | perry-029.conllu | ✅ Done |
| 24 | 80 | 29.9 | perry-080.conllu | ✅ Done |
| 25 | 303 | 30.1 | perry-303.conllu | ✅ Done |
| 26 | 139 | 30.3 | perry-139.conllu | ✅ Done |
| 27 | 126 | 30.5 | perry-126.conllu | ✅ Done |
| 28 | 216 | 30.5 | perry-216.conllu | ✅ Done |
| 29 | 86 | 30.6 | perry-086.conllu | ✅ Done |
| 30 | 294 | 30.6 | perry-294.conllu | ✅ Done |
| 31 | 76 | 30.7 | perry-076.conllu | ✅ Done |
| 32 | 136 | 31.0 | perry-136.conllu | ✅ Done |
| 33 | 228 | 31.0 | perry-228.conllu | ✅ Done |
| 34 | 366 | 31.3 | perry-366.conllu | ✅ Done |
| 35 | 211 | 31.8 | perry-211.conllu | ✅ Done |
| 36 | 231 | 32.3 | perry-231.conllu | ✅ Done |
| 37 | 323 | 32.5 | perry-323.conllu | ✅ Done |
| 38 | 324 | 32.7 | perry-324.conllu | ✅ Done |
| 39 | 415 | 32.7 | perry-415.conllu | ✅ Done |
| 40 | 372 | 33.0 | perry-372.conllu | ✅ Done |
| 41 | 300 | 33.3 | perry-300.conllu | ✅ Done |
| 42 | 12 | 33.5 | perry-012.conllu | ✅ Done |
| 43 | 217 | 33.5 | — | ⬜ Next |

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
