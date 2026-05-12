# CoNLL-U Format Explained Like You're Five

## What is CoNLL-U?

Imagine you have a sentence and you want to write down **everything** about every single word — what it looks like, what it really means, what job it does in the sentence, and how it connects to other words. CoNLL-U is a **recipe for writing all that down** in a plain text file so computers can read it.

---

## The Big Picture

A CoNLL-U file is just a text file. It has **three kinds of lines**:

1. **Word lines** — one line per word, with 10 pieces of info separated by tabs
2. **Blank lines** — these separate sentences (like hitting Enter twice between paragraphs)
3. **Comment lines** — start with `#`, like sticky notes about the sentence

That's it. Every sentence = some comments (optional) + word lines + a blank line at the end.

---

## The 10 Columns (per word line)

Think of each word line as a row in a spreadsheet with 10 columns:

| # | Name | What it means (ELI5) | Example |
|---|------|----------------------|---------|
| 1 | **ID** | The word's number in the sentence (1, 2, 3...) | `3` |
| 2 | **FORM** | The word as it actually appears | `running` |
| 3 | **LEMMA** | The "dictionary form" of the word | `run` |
| 4 | **UPOS** | What **type** of word is this? (universal category) | `VERB` |
| 5 | **XPOS** | A more specific type tag (language-specific, optional) | `VBG` |
| 6 | **FEATS** | Extra details about the word (tense, number, case, etc.) | `Tense=Pres\|Number=Sing` |
| 7 | **HEAD** | Which word is this word's "boss"? (by ID number; 0 = the whole sentence) | `2` |
| 8 | **DEPREL** | What's the relationship to the boss? | `nsubj` |
| 9 | **DEPS** | Same as HEAD+DEPREL but can have **multiple** bosses (enhanced graph) | `2:nsubj\|4:nsubj` |
| 10 | **MISC** | Anything else that doesn't fit above | `SpaceAfter=No` |

### Quick explainer for the tricky ones:

- **ID**: Usually just a number (1, 2, 3...). But:
  - `1-2` = a **multiword token** (like "vámonos" = "vámonos" which is really two words "vamos" + "nos"). The range line just shows the surface form; the real words come after.
  - `5.1` = an **empty node** (an invisible word implied by context, like in "Sue likes coffee and Bill ☐ tea" where "likes" is implied)

- **LEMMA**: The "base form." `running` → `run`, `mice` → `mouse`, `better` → `good`

- **UPOS** vs **XPOS**: UPOS is a simple universal set (17 tags: NOUN, VERB, ADJ, etc.). XPOS is whatever the language wants — could be a Penn Treebank tag like `NNP`, or a French grammar tag, or nothing (`_`).

- **FEATS**: A `|`-separated list of `Key=Value` pairs. Like `Number=Sing|Tense=Past|Person=3`. Alphabetically sorted. Use `_` if none.

- **HEAD + DEPREL**: Think of dependency grammar as a tree. Every word has one parent (HEAD), and the relationship name (DEPREL). HEAD=0 means "I'm the root of the sentence." Example: in "The cat sat", "cat" has HEAD pointing to "sat" with DEPREL=nsubj.

- **DEPS**: The "enhanced" version. Some words logically belong to multiple parents (e.g., in "They buy and sell books", "They" is subject of BOTH "buy" and "sell"). DEPS can represent that: `2:nsubj|4:nsubj`. Use `_` if not provided.

- **MISC**: A catch-all. Most commonly `SpaceAfter=No` (there was no space after this word in the original text). Can also have `Translit=`, `Gloss=`, `Typo=Yes`, etc.

---

## The Underscore Rule (`_`)

If you don't have a value for a field, use `_` (underscore). It means "nothing here" or "not applicable."

- You **must not** leave any field empty — always use `_` instead of a blank
- Exception: FORM, LEMMA, and MISC can contain spaces; all other fields cannot
- Special gotcha: if a word actually IS the underscore character `_`... the spec says "good luck, that's application-dependent"

---

## Multiword Tokens (the `1-2` thing)

Some "words" in text are really multiple words mashed together. Spanish "vámonos" = "vamos" + "nos". In CoNLL-U:

```
1-2    vámonos   _    _    _    _    _    _    _    _
1      vamos     ir   VERB ... (all the real annotation)
2      nos       nosotros  PRON ... (all the real annotation)
```

Rules:
- The range line (1-2) has ID, FORM, and MISC only — everything else is `_`
- Ranges must be **non-empty** and **non-overlapping** (no `1-3` and `2-4`)
- The range line goes **before** the first word it covers
- Exception: multiword tokens CAN have `Typo=Yes` in FEATS

---

## Empty Nodes (the `5.1` thing)

Sometimes you need an invisible word (ellipsis). Like "Sue likes coffee and Bill tea" — "likes" is implied after "Bill."

```
5      Bill      Bill
5.1    likes     like    VERB ...
6      tea       tea
```

Rules:
- Indexed as `i.1`, `i.2`, etc. (after word `i`)
- Must have non-empty ID and DEPS; HEAD and DEPREL must be `_`
- All other fields are optional
- Cannot be part of a multiword token range (no `4-5.1`)
- Must appear in order (`7.1` before `7.2`)

---

## Sentences and Comments

### Blank lines
- Exactly one blank line after every sentence (including the last one in the file)
- No empty sentences allowed

### Comment lines (`#`)
- Must appear **before** the word lines of a sentence, never between them
- Two are **required** for every sentence in UD v2:
  - `# sent_id = unique_id` — a unique identifier for the sentence
  - `# text = The original sentence text.` — the full untokenized sentence
- Optional ones:
  - `# text_en = English translation` (for non-English sentences)
  - `# translit = Romanized version`
  - `# newdoc` or `# newdoc id = ...` — marks start of a new document
  - `# newpar` or `# newpar id = ...` — marks start of a new paragraph

---

## The Full Example

```
# sent_id = 1
# text = They buy and sell books.
1   They     they    PRON   PRP   Case=Nom|Number=Plur            2   nsubj   2:nsubj|4:nsubj   _
2   buy      buy     VERB   VBP   Number=Plur|Person=3|Tense=Pres 0   root    0:root            _
3   and      and     CCONJ  CC    _                               4   cc      4:cc              _
4   sell     sell    VERB  VBP    Number=Plur|Person=3|Tense=Pres 2   conj    0:root|2:conj     _
5   books    book    NOUN  NNS    Number=Plur                     2   obj     2:obj|4:obj       SpaceAfter=No
6   .        .       PUNCT .      _                               2   punct   2:punct           _

```

Let's read this together:
- **Word 1 "They"**: it's a PRONoun, its boss is word 2 ("buy"), it's the subject. In the enhanced graph, it's subject of both word 2 and word 4.
- **Word 2 "buy"**: it's a VERB, it's the root of the sentence (HEAD=0). Enhanced: it's root AND word 4 is its conj.
- **Word 4 "sell"**: VERB, its basic boss is word 2, relationship "conj" (conjoined). Enhanced: it's also a root and a conj of word 2.
- **Word 5 "books"**: NOUN, object of word 2. Enhanced: object of both word 2 and word 4. No space after it.
- **Word 6 "."**: punctuation attached to word 2.

---

## Quick Checklist for Valid CoNLL-U

- [ ] UTF-8 encoding, NFC normalized, LF line endings, final newline
- [ ] Each word line has exactly 10 tab-separated fields
- [ ] No empty fields — use `_` for missing values
- [ ] No spaces in fields 1, 4, 5, 6, 7, 8, 9 (only FORM, LEMMA, MISC can have spaces)
- [ ] Blank line after every sentence (including the last)
- [ ] `# sent_id` and `# text` comments for every sentence
- [ ] Comments only before word lines, never between them
- [ ] Multiword token ranges are non-overlapping and have `_` in most fields
- [ ] Empty nodes use `i.j` format, appear in order, have `_` for HEAD and DEPREL
- [ ] HEAD=0 + DEPREL=root for exactly one word per sentence (the root)
- [ ] FEATS sorted alphabetically, `|`-separated, `Key=Value` pairs
- [ ] DEPS sorted by head index, colon between head and relation, `|` between pairs

---

## Where to Find the Real Spec

The official specification lives at:
- **UD v2 format**: https://universaldependencies.org/format.html
- **UD v2 CoNLL-U changes**: https://universaldependencies.org/v2/conll-u.html
- **CoNLL-U Plus extension**: https://universaldependencies.org/ext-format.html

Local copies of these are saved in `docs/` alongside this file.
