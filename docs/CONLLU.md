# CoNLL-U Format Specification

This document defines the canonical CoNLL-U format for all Greek texts in this project. See [PROGRESS.md](PROGRESS.md) for completed works and migration status.

---

## File Organization

```
conllu/
├── aesop/fables/          # One file per fable: perry-NNN.conllu
├── xenophon/anabasis/     # One file per book: book-NN.tb.conllu
└── ...                    # Future authors/works follow same pattern
```

---

## File-Level Header

Every CoNLL-U file must begin with these metadata comments before the first sentence:

```
# global.columns = ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC
# source = <Author, Work (Book N)>
# source_edition = <Edition information>
# encoder = <Who/what produced the annotations>
# editor = Brandon Lucas
# project = Lyceum Digital Library
# conversion_method = <How the data was produced>
# gloss_type = Context-aware philological glosses
# license = CC BY-SA 4.0
# date_modified = YYYY-MM-DD
# contact = support@lyceum.quest
```

Defaults:
- **editor**: `Brandon Lucas` (override only if a different human reviewed the file)
- **project**: `Lyceum Digital Library` (override only for external contributions)
- **contact**: `support@lyceum.quest`

Other fields are set per file:
- **source**: e.g. `Aesop, Fables (Chambry edition)` or `Xenophon, Anabasis (Book 1)`
- **source_edition**: e.g. `Chambry (Perry numbering)` or `Glaux (Greek Language Automated XML)`
- **encoder**: e.g. `LLM-assisted` or `Gemini 3 Flash (Large Language Model)`
- **conversion_method**: e.g. `Manual annotation with LLM assistance` or `LLM-augmented transformation to Universal Dependencies`

---

## Sentence-Level Headers

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
| `# title` | ✅ Required | ❌ Not applicable | Fable title (first sentence only) |
| `# parallel_id` | ✅ Required | ❌ Not applicable | Link to Lyceum edition |
| `# document_id` | ❌ Not applicable | ✅ Required | Perseus document ID |
| `# subdoc` | ❌ Not applicable | ✅ Required | Citation (e.g. `1.4.4`) |

### sent_id convention

- Aesop: `perry-NNN-sN` (e.g., `perry-045-s1`)
- Xenophon: `xen-anabasis-01-sN` (e.g., `xen-anabasis-01-s1`)

---

## Token Rows

Tab-separated, 10 columns:

```
ID \t FORM \t LEMMA \t UPOS \t XPOS \t FEATS \t HEAD \t DEPREL \t DEPS \t MISC
```

---

## Column Specifications

### UPOS (Column 3)

| UPOS | Description | Notes |
|------|-------------|-------|
| ADJ | Adjective | |
| ADP | Adposition | |
| ADV | Adverb | |
| AUX | Auxiliary verb | εἰμί as copula or auxiliary |
| CCONJ | Coordinating conjunction | |
| DET | Determiner / Article | |
| INTJ | Interjection | ὦ as exclamation |
| NOUN | Noun | |
| NUM | Numeral | |
| PART | Particle | |
| PRON | Pronoun | |
| PROPN | Proper noun | Ζεύς, Κῦρος, Ἀρταξέρξης, etc. |
| PUNCT | Punctuation | |
| SCONJ | Subordinating conjunction | |
| VERB | Verb | |

### XPOS (Column 4)

Human-readable morphological description:

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

Pipe-separated UD morphological features. Use `_` for no features.

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

Dependency relations used in this project:

| DEPREL | Description |
|--------|-------------|
| `root` | Root |
| `nsubj` | Nominal subject |
| `nsubj:pass` | Passive nominal subject |
| `obj` | Direct object |
| `iobj` | Indirect object |
| `csubj` | Clausal subject |
| `csubj:pass` | Passive clausal subject |
| `ccomp` | Clausal complement |
| `xcomp` | Open clausal complement |
| `nummod` | Numeric modifier |
| `acl` | Clausal modifier of noun |
| `acl:relcl` | Relative clause modifier |
| `amod` | Adjectival modifier |
| `appos` | Apposition |
| `advcl` | Adverbial clause modifier |
| `advmod` | Adverbial modifier |
| `discourse` | Discourse element |
| `vocative` | Vocative |
| `dislocated` | Dislocated element |
| `orphan` | Orphan (ellipsis) |
| `obl` | Oblique nominal |
| `obl:agent` | Agent oblique |
| `case` | Case marking |
| `det` | Determiner |
| `nmod` | Nominal modifier |
| `compound` | Compound |
| `flat` | Flat structure (names) |
| `conj` | Conjunct |
| `cc` | Coordinating conjunction |
| `cop` | Copula |
| `aux` | Auxiliary |
| `mark` | Marker |
| `fixed` | Fixed multiword expression |
| `parataxis` | Parataxis |
| `punct` | Punctuation |
| `gen` | Genitive modifier (Aesop convention) |

> **`nsubjpass`** is deprecated in UD v2. Use `nsubj:pass` instead.

### DEPS (Column 9)

Always `_`. Enhanced dependencies are not used.

### MISC (Column 10)

Pipe-separated key=value pairs. Always use lowercase keys.

| Key | Description | Required |
|-----|-------------|----------|
| `Ref` | Citation reference (e.g., `1.1.1`) | Xenophon: ✅ Aesop: optional |
| `gloss` | English gloss for the token | ✅ Always |

Format: `Ref=1.1.1|gloss=of-Darius` or just `gloss=camel`

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

### Step 8: Update Progress

Add the completed fable to the tracking table in [PROGRESS.md](PROGRESS.md).

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
