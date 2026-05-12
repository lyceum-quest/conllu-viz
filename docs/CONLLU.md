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

### File Naming Convention

**Filename format**: `{kebab-case-title}-perry-{NNN}-difficulty-{NNN}.conllu`

- `{kebab-case-title}`: English fable title in kebab-case (e.g., `the-lioness-and-the-fox`)
- `{NNN}` (first): zero-padded Perry number (e.g., `257`)
- `{NNN}` (second): difficulty order from `perry-difficulty-map.csv`

Example: `the-lioness-and-the-fox-perry-257-difficulty-016.conllu`

### File Template

Every new Aesop fable file should follow this complete template:

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
1	<Token rows follow tab-separated: ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL _ gloss=...>
```

### Edition Map Entry Template

When adding a fable, also add an entry to `conllu/aesop/fables/conllu-edition-map.json`:

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

Replace `NNN` with the Perry number (no zero-padding in URNs) and `<English Title>` with the fable title.

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

---

## XPOS Catalog

Definitive list of all XPOS tags found in completed Aesop fable files (284 unique values). Use only these tags when annotating. If a new tag is needed, follow the patterns above and add it here.

### Adjectives
```
adj.fem.pl.acc        adj.fem.pl.gen        adj.fem.pl.nom        adj.fem.pl.voc
adj.fem.sg.acc        adj.fem.sg.dat        adj.fem.sg.gen        adj.fem.sg.nom        adj.fem.sg.voc
adj.masc.pl.acc       adj.masc.pl.dat       adj.masc.pl.gen       adj.masc.pl.nom
adj.masc.sg.acc       adj.masc.sg.dat       adj.masc.sg.gen       adj.masc.sg.nom       adj.masc.sg.voc
adj.neut.pl.acc       adj.neut.pl.dat       adj.neut.pl.gen       adj.neut.sg.voc.sup   adj.neut.pl.gen.cmp
adj.neut.sg.acc       adj.neut.sg.gen       adj.neut.sg.nom       adj.neut.sg.voc
```

### Adverbs
```
adverb
```

### Articles
```
article.fem.pl.acc    article.fem.pl.dat    article.fem.pl.gen    article.fem.pl.nom
article.fem.sg.acc    article.fem.sg.dat    article.fem.sg.gen    article.fem.sg.nom
article.masc.pl.acc   article.masc.pl.dat   article.masc.pl.gen   article.masc.pl.nom
article.masc.sg.acc   article.masc.sg.dat   article.masc.sg.gen   article.masc.sg.nom
article.neut.pl.acc   article.neut.pl.dat   article.neut.pl.gen   article.neut.pl.nom
article.neut.sg.acc   article.neut.sg.dat   article.neut.sg.gen   article.neut.sg.nom
```

### Conjunctions & Particles
```
conjunction    interjection    neg.particle    particle
```

### Nouns
```
noun.fem.pl.acc        noun.fem.pl.dat       noun.fem.pl.gen       noun.fem.pl.nom
noun.fem.sg.acc        noun.fem.sg.dat       noun.fem.sg.gen       noun.fem.sg.nom       noun.fem.sg.voc
noun.masc.pl.acc       noun.masc.pl.dat      noun.masc.pl.gen      noun.masc.pl.nom
noun.masc.sg.acc       noun.masc.sg.dat      noun.masc.sg.gen      noun.masc.sg.nom      noun.masc.sg.voc
noun.neut.pl.acc       noun.neut.pl.dat      noun.neut.pl.gen      noun.neut.pl.nom
noun.neut.sg.acc       noun.neut.sg.dat      noun.neut.sg.gen      noun.neut.sg.nom      noun.neut.sg.voc
```

### Numerals
```
numeral.masc.pl.nom    numeral.masc.sg.acc    numeral.pl.nom
```

### Prepositions
```
preposition    preposition.acc    preposition.dat    preposition.gen
```

### Pronouns
```
pron.1pl.dat           pron.1pl.nom          pron.1sg.acc          pron.1sg.dat          pron.1sg.gen          pron.1sg.nom
pron.2pl.dat           pron.2sg.acc          pron.2sg.dat          pron.2sg.gen          pron.2sg.masc.sg.acc  pron.2sg.masc.sg.gen
pron.2sg.nom           pron.2pl.acc
pron.demonstr.fem.sg.acc    pron.demonstr.masc.sg.acc    pron.demonstr.masc.sg.nom   pron.demonstr.neut.sg.acc
pron.indef.masc.sg.acc     pron.indef.masc.sg.nom      pron.indef.neut.sg.acc
pron.interr.fem.sg.nom
pron.fem.pl.acc        pron.fem.pl.gen       pron.fem.pl.nom       pron.fem.sg.acc       pron.fem.sg.dat       pron.fem.sg.gen       pron.fem.sg.nom
pron.masc.pl.acc       pron.masc.pl.gen      pron.masc.pl.nom      pron.masc.sg.acc      pron.masc.sg.dat      pron.masc.sg.gen      pron.masc.sg.nom
pron.neut.pl.acc       pron.neut.pl.gen      pron.neut.sg.acc      pron.neut.sg.dat      pron.neut.sg.gen      pron.neut.sg.nom
pron.pl.dat            pron.pl.nom
pron.prs.1pl.acc       pron.prs.1pl.dat      pron.prs.1sg.acc      pron.prs.1sg.nom      pron.prs.2sg.acc      pron.prs.2sg.nom
pron.prs.3pl.acc       pron.prs.3sg.acc      pron.prs.3sg.dat      pron.prs.3sg.gen      pron.prs.3sg.nom
pron.refl.3sg.gen      pron.refl.fem.sg.acc  pron.refl.masc.pl.acc
pron.rel.fem.sg.gen
```

### Proper Nouns
```
propn.masc.sg.dat    propn.masc.sg.gen
```

### Punctuation
```
punctuation
```

### Verbs — Aorist
```
verb.aor.imp.act.3sg          verb.aor.imper.act.2sg       verb.aor.imper.mp.2sg
verb.aor.ind.act.1pl          verb.aor.ind.act.1sg         verb.aor.ind.act.2sg
verb.aor.ind.act.3pl          verb.aor.ind.act.3sg         verb.aor.ind.mp.3pl          verb.aor.ind.mp.3sg
verb.aor.inf.act              verb.aor.inf.mp              verb.aor.inf.pass
verb.aor.opt.act.1sg          verb.aor.opt.act.2sg         verb.aor.opt.act.3sg         verb.aor.opt.mp.3pl
verb.aor.ptcp.act.fem.pl.nom  verb.aor.ptcp.act.fem.sg.gen verb.aor.ptcp.act.fem.sg.nom
verb.aor.ptcp.act.masc.pl.acc verb.aor.ptcp.act.masc.pl.gen verb.aor.ptcp.act.masc.pl.nom
verb.aor.ptcp.act.masc.sg.acc verb.aor.ptcp.act.masc.sg.gen verb.aor.ptcp.act.masc.sg.nom
verb.aor.ptcp.act.neut.pl.nom verb.aor.ptcp.act.neut.sg.nom
verb.aor.ptcp.mp.fem.pl.gen   verb.aor.ptcp.mp.fem.sg.gen  verb.aor.ptcp.mp.fem.sg.nom
verb.aor.ptcp.mp.masc.sg.acc  verb.aor.ptcp.mp.masc.sg.nom
verb.aor.ptcp.pass.fem.sg.nom verb.aor.ptcp.pass.masc.pl.gen verb.aor.ptcp.pass.masc.sg.acc
verb.aor.ptcp.pass.masc.sg.gen verb.aor.ptcp.pass.masc.sg.nom
verb.aor.ptcp.pass.neut.sg.gen verb.aor.ptcp.pass.neut.sg.nom
verb.aor.sub.act.2sg          verb.aor.sub.mp.2sg
verb.aor.subj.act.1sg        verb.aor.subj.act.2sg       verb.aor.subj.act.3sg
verb.aor.subj.mp.1pl         verb.aor.subj.mp.1sg        verb.aor.subj.mp.3sg
```

### Verbs — Future
```
verb.fut.ind.act.1sg    verb.fut.ind.act.2sg    verb.fut.ind.act.3pl    verb.fut.ind.act.3sg
verb.fut.ind.mp.1sg    verb.fut.ind.mp.3sg
verb.fut.inf.act
verb.fut.ptcp.mp.fem.sg.nom
```

### Verbs — Imperfect
```
verb.impf.ind.act.2sg   verb.impf.ind.act.3pl   verb.impf.ind.act.3sg
verb.impf.ind.mp.3pl   verb.impf.ind.mp.3sg
verb.impf.subj.mp.3sg
```

### Verbs — Present
```
verb.pres.imp.act.2sg   verb.pres.imp.mp.2sg
verb.pres.imper.act.2sg verb.pres.imper.act.3sg verb.pres.imper.mp.2sg  verb.pres.imper.mp.3sg
verb.pres.ind.act.1pl   verb.pres.ind.act.1sg   verb.pres.ind.act.2pl   verb.pres.ind.act.2sg
verb.pres.ind.act.3pl   verb.pres.ind.act.3sg
verb.pres.ind.mp.1pl    verb.pres.ind.mp.1sg    verb.pres.ind.mp.3pl   verb.pres.ind.mp.3sg
verb.pres.ind.pass.3sg
verb.pres.inf.act       verb.pres.inf.mp
verb.pres.opt.act.2sg   verb.pres.opt.mp.1sg   verb.pres.opt.mp.2sg
verb.pres.ptcp.act.fem.sg.acc   verb.pres.ptcp.act.fem.sg.gen   verb.pres.ptcp.act.fem.sg.nom
verb.pres.ptcp.act.masc.pl.acc verb.pres.ptcp.act.masc.pl.gen  verb.pres.ptcp.act.masc.pl.nom
verb.pres.ptcp.act.masc.sg.acc verb.pres.ptcp.act.masc.sg.dat  verb.pres.ptcp.act.masc.sg.gen  verb.pres.ptcp.act.masc.sg.nom
verb.pres.ptcp.act.neut.pl.dat verb.pres.ptcp.act.neut.pl.nom  verb.pres.ptcp.act.neut.sg.nom
verb.pres.ptcp.mp.fem.pl.voc   verb.pres.ptcp.mp.fem.sg.acc    verb.pres.ptcp.mp.fem.sg.gen   verb.pres.ptcp.mp.fem.sg.nom
verb.pres.ptcp.mp.masc.pl.acc verb.pres.ptcp.mp.masc.pl.nom
verb.pres.ptcp.mp.masc.sg.acc verb.pres.ptcp.mp.masc.sg.dat  verb.pres.ptcp.mp.masc.sg.gen  verb.pres.ptcp.mp.masc.sg.nom
verb.pres.ptcp.mp.neut.sg.dat
verb.pres.ptcp.pass.fem.pl.nom verb.pres.ptcp.pass.fem.sg.nom verb.pres.ptcp.pass.masc.pl.acc
verb.pres.sub.act.2sg    verb.pres.sub.mp.3pl    verb.pres.subj.mp.3pl
```

### Verbs — Perfect & Pluperfect
```
verb.perf.ind.act.1sg   verb.perf.ind.act.2sg   verb.perf.ind.act.3sg
verb.perf.ind.mp.1sg   verb.perf.ind.mp.2sg   verb.perf.ind.mp.3sg
verb.perf.ptcp.act.masc.pl.nom verb.perf.ptcp.act.masc.sg.acc verb.perf.ptcp.act.masc.sg.gen verb.perf.ptcp.act.masc.sg.nom
verb.perf.ptcp.mp.fem.sg.acc  verb.perf.ptcp.mp.masc.pl.acc  verb.perf.ptcp.mp.masc.sg.acc
verb.perf.ptcp.mp.neut.sg.acc
verb.perf.ptcp.pass.masc.pl.acc verb.perf.ptcp.pass.masc.sg.nom
verb.plup.ind.act.1pl   verb.plup.ind.act.3sg
```

### Verbs — Impersonal
```
verb.impers.pres.ind.3sg
```

> **Note**: XPOS tags with inconsistent naming (e.g., `verb.aor.imp.act.3sg` vs `verb.aor.imper.act.2sg`, or `verb.aor.sub.act.2sg` vs `verb.aor.subj.act.1sg`) reflect variation in the existing corpus. Prefer the longer forms (`imper`, `subj`) for new annotations.
