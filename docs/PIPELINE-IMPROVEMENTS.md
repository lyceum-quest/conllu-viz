# Pipeline Improvement Plan

Lessons from creating fables 43–52 (perry 217, 218, 291, 393, 176, 253, 319, 396, 83, 260).

---

## 1. Add a File Template to the Spec

**Problem**: Had to read a reference file + spec separately. The spec describes file-level headers but the reference file (perry-257) didn't have them, causing a first-pass omission and a fix cycle.

**Fix**: Add a complete template to `docs/CONLLU.md` under "Instructions for New Aesop Fables" with all boilerplate pre-filled:

```
# global.columns = ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC
# source = Aesop, Fables (Chambry edition)
# source_edition = Chambry (Perry numbering)
# encoder = LLM-assisted
# editor = Brandon Lucas
# project = Lyceum Digital Library
# conversion_method = Manual annotation with LLM assistance
# gloss_type = Context-aware philological glosses
# license = CC BY-SA 4.0
# date_modified = YYYY-MM-DD
# contact = support@lyceum.quest

# title = <English title>
# sent_id = perry-NNN-s1
# text = <raw Greek sentence>
# parallel_id = lyceum-aesop-pNNN/s1
# translation_lang = en
# prose_translation = <natural English translation>
# literal_translation = <word-for-word literal translation>
1	<Token rows follow>
```

---

## 2. Document the File Naming Convention

**Problem**: Had to infer `slug-perry-NNN-difficulty-NNN.conllu` by listing the directory and reverse-engineering the pattern.

**Fix**: Add one line to the spec:

> **Filename format**: `{kebab-case-title}-perry-{NNN}-difficulty-{NNN}.conllu`
> where `{NNN}` is the zero-padded Perry number and `{NNN}` difficulty order from `perry-difficulty-map.csv`.

---

## 3. Add a Dependency Pattern Reference

**Problem**: ~30% of cognitive load went to tree-building decisions. Many constructions repeat across fables but had to be inferred from 1–2 examples.

**Fix**: Add a "Common Greek Dependency Patterns" section to the spec with ~10 patterns:

| Pattern | Greek Example | Structure |
|---------|--------------|-----------|
| Genitive absolute | `τῆς...ἐμπεσούσης` | participle → `advcl` on main verb; noun → `nsubj` of participle (both genitive) |
| Particle `μέν/δέ` | `τῷ μὲν...τῷ δὲ` | → `discourse` |
| Indirect speech `ὅτι` | `δηλοῖ ὅτι...` | `ὅτι` → `mark`, clause → `ccomp` |
| `ἔφη` with quoted speech | `ἔφη· "..."` | `ἔφη` as root, quote → `ccomp` or `parataxis` |
| Pronominal article | `τὴν τοῦ ἵππου` | article as `obj`/`nsubj` (substantival), genitive → `nmod` on article |
| Participial `advcl` | `θεασαμένη...ἠβουλήθη` | participle → `advcl` on finite verb |
| Aorist imperative + result | `παρελθέτω, καὶ τότε γνώσῃ` | imperative → `advcl`, future/subjunctive → `parataxis` |
| `μὲν...δὲ` coordination | `τὸ μὲν χρῶμα...νοσεῖν δὲ` | `δέ` → `cc` on second conj, `conj` on second verb |
| `ὥστε` result clause | `ὥστε...ὑπομένειν` | `ὥστε` → `mark`, infinitive → `advcl` on main verb |
| `εἰ` condition | `εἰ θέλεις...` | `εἰ` → `mark`, protasis → `advcl` on apodosis |

---

## 4. Build an XPOS Catalog from Existing Files

**Problem**: The spec gives XPOS patterns but leaves edge cases ambiguous (e.g., `verb.impers.pres.ind.3sg` vs `verb.pres.ind.act.3sg` for impersonals; `verb.plup.ind.act.3sg` vs `verb.perf.ind.act.3sg` for pluperfect — the linter rejects `Tense=Pqp`).

**Fix**: Extract all unique XPOS values from the 52 completed files and add them to the spec as a definitive catalog. This eliminates guessing and enforces consistency. Approximate expected count: ~50–60 unique XPOS tags.

```bash
# Generate the catalog:
grep -h '^[0-9]' conllu/aesop/fables/*.conllu | cut -f5 | sort -u
```

---

## 5. Add an Edition Map Entry Template

**Problem**: Had to read existing `conllu-edition-map.json` entries to reverse-engineer the URN format and field structure.

**Fix**: Add a template entry to the spec:

```json
"aesop-perry-NNN.conllu": {
  "editionUrn": "urn:cts:greekLit:tlg0096.tlg001.workspace-grc1-perryNNN",
  "authorUrn": "urn:cts:greekLit:tlg0096",
  "authorName": "Aesop",
  "workUrn": "urn:cts:greekLit:tlg0096.tlg001",
  "workTitle": "Aesop, Fables",
  "language": "grc",
  "editionLabel": "Aesop, Perry NNN (<English Title>)",
  "editionType": "treebank",
  "editionDescription": "CoNLL-U treebank edition of Aesop Fable NNN"
}
```

---

## 6. Build a Morph Pre-Fill Script (Highest Leverage)

**Problem**: Lemmatization and morphology are ~60% of the work and the most error-prone. Dependency trees are ~30% (mostly pattern-matching). Translations are ~10%. Currently every token's LEMMA, UPOS, XPOS, and FEATS must be produced from scratch.

**Fix**: Write `scripts/morph-prefill.ts` that takes raw Greek text and emits candidate token rows using Morpheus (Perseus morphology API) or a local morphological analyzer. The script would:

1. Tokenize the Greek text (split on whitespace/punctuation)
2. For each token, query Morpheus for possible analyses
3. Pick the most likely analysis (or emit multiple candidates)
4. Output a skeleton `.conllu` file with pre-filled ID, FORM, LEMMA, UPOS, XPOS, FEATS columns
5. Leave HEAD, DEPREL, MISC (gloss) as `_` / placeholder

Even 80% accuracy would cut the manual work roughly in half, since the human reviewer only needs to:
- Correct wrong morphological analyses (not produce them from scratch)
- Build the dependency tree
- Write glosses and translations

**Implementation options**:
- **Morpheus API**: `https://morph.perseus.org/api/analysis?word=XXX&lang=grc` — returns possible parses
- **Local CLTK**: Python library with Ancient Greek morphology
- **Simple lookup from existing files**: Since 52 fables are done, build a FORM→(LEMMA, UPOS, XPOS, FEATS) dictionary from completed data. High-frequency forms will already be covered.

**Quick win**: Start with option 3 (lookup from existing files). It requires no external dependency and will cover the most common tokens (articles, particles, common verbs like εἰμί, φημί, λέγω).

---

## Priority Order

| # | Item | Effort | Impact |
|---|------|--------|--------|
| 1 | File template in spec | Low | Eliminates header omission |
| 2 | File naming convention | Low | Eliminates directory listing step |
| 3 | Dependency pattern reference | Medium | Reduces tree-building errors |
| 4 | XPOS catalog | Low | Eliminates XPOS guessing |
| 5 | Edition map template | Low | Eliminates JSON reverse-engineering |
| 6 | Morph pre-fill script | High | Cuts ~60% of per-fable effort |

Items 1, 2, 4, 5 are quick doc changes. Item 3 is a moderate doc addition. Item 6 is the big win but requires implementation work.
