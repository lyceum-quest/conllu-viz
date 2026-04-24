# CoNLL-U Pipeline: Unified Specification

This document defines the canonical CoNLL-U format for all Greek texts in this project — both Aesop fables and Xenophon (and future works). The spec merges the best conventions from each source into a single consistent structure.

---

## Tracking Completed Works

### Aesop Fables

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

### Xenophon

| Work | Book | File | Status |
|------|------|------|--------|
| Anabasis | 1 | book-01.tb.conllu | ✅ Done |

---

## File Organization

```
conllu/
├── aesop/fables/          # One file per fable: perry-NNN.conllu
├── xenophon/anabasis/     # One file per book: book-NN.tb.conllu
└── ...                    # Future authors/works follow same pattern
```

---

## Unified CoNLL-U Format

### File-Level Header

Every CoNLL-U file must begin with these metadata comments before the first sentence:

```
# global.columns = ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC
# source = <Author, Work (Book N)>
# source_edition = <Edition information>
# encoder = <Who/what produced the annotations>
# editor = <Who reviewed/corrected the annotations>
# project = Beyond Translation / Perseus Digital Library
# conversion_method = <How the data was produced>
# gloss_type = Context-aware philological glosses
# license = CC BY-SA 4.0
# date_modified = YYYY-MM-DD
# contact = Tufts University Department of Classical Studies
```

> **Aesop files are missing all of these.** They should be retrofitted. Example for Perry 45:
> ```
> # source = Aesop, Fables (Chambry edition)
> # source_edition = Chambry (Perry numbering)
> # encoder = LLM-assisted
> # editor = Gregory Crane (Human Philologist)
> # project = Beyond Translation / Perseus Digital Library
> # conversion_method = Manual annotation with LLM assistance
> # gloss_type = Context-aware philological glosses
> # license = CC BY-SA 4.0
> # date_modified = 2026-04-24
> # contact = Tufts University Department of Classical Studies
> ```

### Sentence-Level Headers

Every sentence block must include these headers:

```
# sent_id = <work-specific ID>
# text = <raw Greek sentence>
# translation_lang = en
# prose_translation = <natural English translation>
# literal_translation = <word-for-word literal translation>
```

Additional sentence-level headers by work type:

| Header | Aesop | Xenophon | Notes |
|--------|-------|----------|-------|
| `# title` | ✅ Required | ❌ Not applicable | Fable title (Aesop only) |
| `# parallel_id` | ✅ Required | ❌ Not applicable | Link to Lyceum edition (Aesop only) |
| `# document_id` | ❌ Not applicable | ✅ Required | Perseus document ID |
| `# subdoc` | ❌ Not applicable | ✅ Required | Citation (e.g. `1.4.4`) |

> **Xenophon is missing `# text` on most sentences** (only 30 of 497 have it). Every sentence must have `# text`.

> **Xenophon uses `# sentence_id`** — this should be normalized to `# sent_id` to match the UD standard and the Aesop convention.

#### sent_id convention

- Aesop: `perry-NNN-sN` (e.g., `perry-045-s1`)
- Xenophon: `xen-anabasis-01-sN` (e.g., `xen-anabasis-01-s1`)

### Token Rows

Tab-separated, 10 columns:

```
ID \t FORM \t LEMMA \t UPOS \t XPOS \t FEATS \t HEAD \t DEPREL \t DEPS \t MISC
```

---

## Column Specifications

### UPOS (Column 3)

Universal POS tags. The full set for this project:

| UPOS | Description | Aesop | Xenophon |
|------|-------------|-------|----------|
| ADJ | Adjective | ✅ | ✅ |
| ADP | Adposition | ✅ | ✅ |
| ADV | Adverb | ✅ | ✅ |
| AUX | Auxiliary verb | ❌ Missing | ✅ |
| CCONJ | Coordinating conjunction | ✅ | ✅ |
| DET | Determiner / Article | ✅ | ✅ |
| INTJ | Interjection | ❌ Missing | ✅ |
| NOUN | Noun | ✅ | ✅ |
| NUM | Numeral | ✅ | ✅ |
| PART | Particle | ✅ | ✅ |
| PRON | Pronoun | ✅ | ✅ |
| PROPN | Proper noun | ❌ Missing | ✅ |
| PUNCT | Punctuation | ✅ | ✅ |
| SCONJ | Subordinating conjunction | ✅ | ✅ |
| VERB | Verb | ✅ | ✅ |

> **Aesop is missing AUX, INTJ, PROPN.** These should be used in Aesop files going forward:
> - **AUX**: For εἰμί when used as a copula or auxiliary (not as a main verb)
> - **INTJ**: For interjections like ὦ (when used as an exclamation, not as a vocative particle)
> - **PROPN**: For proper names (Ζεύς, Κῦρος, Ἀρταξέρξης, etc.)

### XPOS (Column 4)

Human-readable morphological description. This is the Aesop convention — **Xenophon's Glaux morph codes (e.g., `n-s---mg-`, `v3ppie---`) must be converted.**

| Category | Pattern | Example |
|----------|---------|---------|
| Verb (finite) | `verb.{tense}.{mood}.{voice}.{person}sg/pl` | `verb.impf.ind.act.3sg` |
| Verb (infinitive) | `verb.{tense}.inf.{voice}` | `verb.aor.inf.act` |
| Verb (participle) | `verb.{tense}.ptcp.{voice}.{gender}.{number}.{case}` | `verb.pres.ptcp.mp.fem.sg.nom` |
| Verb (impersonal) | `verb.impers.{tense}.{mood}.3sg` | `verb.impers.pres.ind.3sg` |
| Noun | `noun.{gender}.{number}.{case}` | `noun.masc.pl.nom` |
| Proper noun | `propn.{gender}.{number}.{case}` | `propn.masc.sg.nom` |
| Adjective | `adj.{degree}.{gender}.{number}.{case}` | `adj.pos.fem.sg.acc` |
| Article | `article.{gender}.{number}.{case}` | `article.masc.sg.acc` |
| Pronoun | `pron.{type}.{gender}.{number}.{case}` | `pron.demonstr.fem.sg.nom` |
| Numeral | `numeral.{gender}.{number}.{case}` | `numeral.masc.pl.nom` |
| Preposition | `preposition` or `preposition.{case}` | `preposition.acc` |
| Conjunction | `conjunction` | `conjunction` |
| Particle | `{type}.particle` | `neg.particle` |

### FEATS (Column 6)

Pipe-separated UD morphological features. Both sources use this correctly. Use `_` for no features.

> **Xenophon has `__` (double underscore)** in some FEATS fields — these should be normalized to `_`.

Standard features for Greek:

| Feature | Values | Used with |
|---------|--------|-----------|
| Case | Nom, Gen, Dat, Acc, Voc | Nouns, ADJ, DET, PRON, PROPN, NUM |
| Gender | Masc, Fem, Neut, Com | Nouns, ADJ, DET, PRON, PROPN, NUM |
| Number | Sing, Plur, Dual | Nouns, ADJ, DET, PRON, PROPN, NUM, VERB |
| Person | 1, 2, 3 | VERB, PRON |
| Tense | Pres, Imp, Aor, Perf, Fut | VERB |
| Mood | Ind, Sub, Opt, Imp, Inf | VERB |
| Voice | Act, Mid, Pass | VERB |
| Aspect | Imp, Perf | VERB |
| VerbForm | Fin, Inf, Part, Ger | VERB |
| Degree | Pos, Cmp, Sup | ADJ |
| Definite | Def | DET |
| PronType | Art, Dem, Int, Rel, Prs, Rcp | PRON, DET |

### DEPREL (Column 8)

Dependency relations. The unified set:

| DEPREL | Description | Currently in |
|--------|-------------|-------------|
| `root` | Root | Both |
| `nsubj` | Nominal subject | Both |
| `nsubj:pass` | Passive nominal subject | Xenophon only |
| `obj` | Direct object | Both |
| `iobj` | Indirect object | Both |
| `csubj` | Clausal subject | Xenophon only |
| `csubj:pass` | Passive clausal subject | Xenophon only |
| `ccomp` | Clausal complement | Both |
| `xcomp` | Open clausal complement | Both |
| `nummod` | Numeric modifier | Xenophon only |
| `acl` | Clausal modifier of noun | Both |
| `acl:relcl` | Relative clause | Both |
| `amod` | Adjectival modifier | Both |
| `appos` | Apposition | Both |
| `advcl` | Adverbial clause modifier | Both |
| `advmod` | Adverbial modifier | Both |
| `discourse` | Discourse element | Both |
| `vocative` | Vocative | Both |
| `dislocated` | Dislocated element | Xenophon only |
| `orphan` | Orphan | Xenophon only |
| `obl` | Oblique nominal | Both |
| `obl:agent` | Agent oblique | Both |
| `case` | Case marking | Both |
| `det` | Determiner | Both |
| `nmod` | Nominal modifier | Both |
| `compound` | Compound | Xenophon only |
| `flat` | Flat structure (names) | Xenophon only |
| `conj` | Conjunct | Both |
| `cc` | Coordinating conjunction | Both |
| `cop` | Copula | Both |
| `aux` | Auxiliary | Both |
| `mark` | Marker | Both |
| `fixed` | Fixed multiword expression | Both |
| `parataxis` | Parataxis | Both |
| `punct` | Punctuation | Both |
| `gen` | Genitive modifier | Aesop only |

> **Relations to add to Aesop going forward**: `csubj`, `csubj:pass`, `nsubj:pass`, `nummod`, `compound`, `flat`, `dislocated`, `orphan` — as needed by the syntax.

> **`nsubjpass`** appears in Xenophon but is deprecated in UD v2 in favor of `nsubj:pass`. Use `nsubj:pass` for new annotations.

### DEPS (Column 9)

Always `_`. Enhanced dependencies are not used.

### MISC (Column 10)

Pipe-separated key=value pairs. The unified MISC fields:

| Key | Description | Required |
|-----|-------------|----------|
| `Ref` | Citation reference (e.g., `1.1.1`) | Xenophon: ✅ Aesop: optional |
| `gloss` | English gloss for the token | ✅ Always |

Format: `Ref=1.1.1|gloss=of-Darius` or just `gloss=camel`

> **Xenophon has inconsistent capitalization** (`gloss=` vs `Gloss=`). Always use lowercase `gloss=`.

> **Aesop is missing `Ref`.** For Aesop, `Ref` is optional since the `parallel_id` header links to Lyceum, but it may be added for consistency.

---

## Migration Checklist

### Aesop → Unified

- [ ] Add file-level headers (`# source`, `# source_edition`, `# encoder`, `# editor`, `# project`, `# conversion_method`, `# gloss_type`, `# license`, `# date_modified`, `# contact`, `# global.columns`)
- [ ] Use `AUX` UPOS for εἰμί as copula/auxiliary
- [ ] Use `INTJ` UPOS for interjections
- [ ] Use `PROPN` UPOS for proper names
- [ ] Consider adding `Ref` to MISC for cross-referencing

### Xenophon → Unified

- [ ] Normalize `# sentence_id` → `# sent_id`
- [ ] Add `# text` header to all sentences (currently only 30/497)
- [ ] Convert XPOS from Glaux morph codes to human-readable format
- [ ] Normalize `__` → `_` in FEATS
- [ ] Normalize `Gloss=` → `gloss=` in MISC (inconsistent capitalization)
- [ ] Replace `nsubjpass` → `nsubj:pass` (deprecated UD v2 relation)

---

## Instructions for New Aesop Fables

### Step 1: Get the Greek Text

Source: Lyceum `texts.db` (Chambry edition, Perry numbering)

```
Database: ~/src/greek/lyceum/reader/data/texts.db
Edition URN: urn:cts:greekLit:tlg0096.tlg002.perry-grc1
Edition ID: 4375
```

Query a fable by Perry number:
```bash
nix-shell -p sqlite --run "sqlite3 ~/src/greek/lyceum/reader/data/texts.db \
  \"SELECT content FROM segments WHERE edition_id=4375 AND reference='NNN'\""
```

Replace `NNN` with the Perry number (e.g., `15`, `256`). The returned text is the raw Greek from Chambry's edition. Strip any trailing `&nbsp;` entities.

### Step 2: Segment into Sentences

Split the text at sentence boundaries (period, interrogative mark, semicolon acting as question mark, colon, etc.). Each sentence becomes a CoNLL-U sentence block.

### Step 3: Build the CoNLL-U File

Start with the file-level header block, then for each sentence create a block with:

#### Sentence headers:
```
# sent_id = perry-NNN-sN
# text = <raw greek sentence>
# parallel_id = lyceum-aesop-pNNN/sN
# translation_lang = en
# prose_translation = <natural English translation>
# literal_translation = <word-for-word literal translation>
```

The first sentence in the file also gets the `# title` header:
```
# title = <English title of the fable>
```

#### Token rows (tab-separated):
```
ID \t FORM \t LEMMA \t UPOS \t XPOS \t FEATS \t HEAD \t DEPREL \t _ \t MISC
```

### Step 4: Translations

Provide both:
- **prose_translation**: Natural English rendering
- **literal_translation**: Word-for-word literal translation

### Step 5: Dependency Tree

Build the UD dependency tree:
- Find the root verb for each sentence (HEAD=0)
- Connect subjects as `nsubj`, objects as `obj`, etc.
- Participles typically attach as `advcl` or `acl`
- Infinitives as `xcomp`
- Prepositional phrases as `obl` with `case` on the preposition
- Negation particles as `advmod`
- Conjunctions: `conj` on the conjoined element, `cc` on the conjunction word
- Copular constructions: `cop` on εἰμί, `nsubj` on the subject, predicate as head
- Proper names: `PROPN` UPOS, use `flat` for multi-word names

### Step 6: Validate

Run the viewer to check the parse:
```bash
./conllu-view.sh perry-NNN.conllu
```

### Step 7: Save the File

Write to `conllu/aesop/fables/perry-NNN.conllu`.

### Step 8: Update This Document

Add the completed fable to the tracking table above.

---

## Reference: XPOS Tagging Conventions

See the completed Perry 257 file for examples of each POS type and morphological pattern.

### Verb Morphology Patterns
| Pattern | Example | Meaning |
|---------|---------|---------|
| `verb.pres.inf.act` | τίκτειν | present active infinitive |
| `verb.impf.ind.act.3sg` | ἔφη | imperfect indicative active 3rd sg |
| `verb.aor.inf.act` | ἐφικέσθαι | aorist middle infinitive |
| `verb.pres.ptcp.mp.fem.sg.nom` | ὀνειδιζομένη | present middle-passive participle fem sg nom |
| `verb.aor.ptcp.act.masc.sg.nom` | ἀγανακτήσας | aorist active participle masc sg nom |
| `verb.impers.pres.ind.3sg` | δεῖ | impersonal present indicative 3rd sg |

### Noun Morphology
| Pattern | Example |
|---------|---------|
| `noun.fem.sg.nom` | Λέαινα |
| `noun.masc.sg.acc` | λέοντα |
| `noun.neut.sg.dat` | πλήθει |
| `noun.fem.sg.gen` | ἀλώπεκος |

### Proper Noun Morphology
| Pattern | Example |
|---------|---------|
| `propn.masc.sg.nom` | Κῦρος |
| `propn.fem.sg.gen` | Παρυσάτιδος |
| `propn.masc.sg.acc` | Ἀρταξέρξη |
