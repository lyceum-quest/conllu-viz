# Aesop CoNLL-U Pipeline: Adding Fables

## Tracking Completed Fables

| # | Perry | Difficulty | File | Status |
|---|-------|-----------|------|--------|
| 1 | 257 | 18.8 | aesop-perry-257.conllu | ✅ Done |
| 2 | 184 | 19.9 | aesop-perry-184.conllu | ✅ Done |
| 3 | 365 | 22.3 | aesop-perry-365.conllu | ✅ Done |
| 4 | 45 | 22.7 | aesop-perry-45.conllu | ✅ Done |
| 5 | 374 | 23.1 | aesop-perry-374.conllu | ✅ Done |
| 6 | 288 | 24.5 | aesop-perry-288.conllu | ✅ Done |
| 7 | 250 | 24.7 | aesop-perry-250.conllu | ✅ Done |
| 8 | 256 | 25.7 | aesop-perry-256.conllu | ✅ Done |
| 9 | 229 | 26.7 | aesop-perry-229.conllu | ✅ Done |
| 10 | 15 | 26.8 | aesop-perry-15.conllu | ✅ Done |
| 11 | 199 | 26.8 | aesop-perry-199.conllu | ✅ Done |
| 12 | 202 | 26.9 | aesop-perry-202.conllu | ✅ Done |
| 13 | 378 | 27.2 | — | ⬜ Next |

**Next fable**: Read `perry-difficulty-map.csv` and find the first row whose perry number doesn't have a `.conllu` file. That's your next target.

---

## Instructions for Each New Fable

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

For each sentence, create a block with:

#### Header metadata:
```
# sent_id = perry-NNN-s1
# text = <raw greek sentence>
# parallel_id = lyceum-aesop-pNNN/s1
# translation_lang = en
# prose_translation = <natural English translation>
# literal_translation = <word-for-word literal translation>
```

#### Token rows (tab-separated):
```
ID \t FORM \t LEMMA \t UPOS \t XPOS \t FEATS \t HEAD \t DEPREL \t _ \t MISC
```

Columns:
- **ID**: Token number (global across all sentences in the file, starting at 1)
- **FORM**: The actual Greek word form
- **LEMMA**: Dictionary form of the word
- **UPOS**: Universal POS tag (NOUN, VERB, ADJ, ADV, DET, PRON, PROPN, ADP, CCONJ, SCONJ, PART, NUM, PUNCT, AUX)
- **XPOS**: Detailed morph description (e.g., `noun.fem.sg.nom`, `verb.aor.inf.act`, `verb.pres.ptcp.mp.masc.sg.nom`)
- **FEATS**: Pipe-separated UD features (e.g., `Gender=Fem|Number=Sing|Case=Nom`)
- **HEAD**: ID of the word this token depends on (0 = root of sentence)
- **DEPREL**: Dependency relation (nsubj, obj, obl, advcl, acl, root, advmod, det, case, conj, cc, mark, amod, xcomp, ccomp, cop, aux, punct, discourse, nummod, etc.)
- **DEPS**: `_` (enhanced dependencies — leave blank)
- **MISC**: Gloss in format `gloss=<english gloss>` (e.g., `gloss=camel`, `gloss=seeing`)

#### Morphology detail conventions:
- Verbs: `verb.{tense}.{voice}.{mood}.{person/number}` or `verb.{tense}.ptcp.{voice}.{gender}.{number}.{case}` or `verb.{tense}.inf.{voice}`
- Nouns: `noun.{gender}.{number}.{case}`
- Adjectives: `adj.{gender}.{number}.{case}`
- Articles: `article.{gender}.{number}.{case}`
- Pronouns: `pron.{gender}.{number}.{case}`
- Numerals: `numeral.{gender}.{number}.{case}`
- Adpositions: `preposition` or `preposition.{case}`
- Particles: `neg.particle` or `interrogative.particle`

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

### Step 6: Validate

Run the viewer to check the parse:
```bash
./conllu-view.sh aesop-perry-NNN.conllu
```

### Step 7: Save the File

Write to `aesop-perry-NNN.conllu` in this directory (`/home/blu/src/greek/lyceum/projects/lyceum-quest/aesop/`).

### Step 8: Update This Document

Add the completed fable to the tracking table at the top.

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
