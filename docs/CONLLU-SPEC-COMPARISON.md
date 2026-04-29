# CoNLL-U Spec Comparison: UD Standard vs. This Project

Comparison of the [UD v2 CoNLL-U specification](https://universaldependencies.org/format.html) against the project's [CONLLU.md](CONLLU.md) format and the linter's validation rules.

---

## 1. UPOS Tags

| UD Standard (17 tags) | This Project | Difference |
|---|---|---|
| ADJ | ✅ | — |
| ADP | ✅ | — |
| ADV | ✅ | — |
| AUX | ❌ Not listed | Project omits AUX; uses VERB with copular/head roles instead |
| CCONJ | ✅ | — |
| DET | ✅ | — |
| INTJ | ✅ | — |
| NOUN | ✅ | — |
| NUM | ✅ | — |
| PART | ✅ | — |
| PRON | ✅ | — |
| PROPN | ✅ | — |
| PUNCT | ✅ | — |
| SCONJ | ✅ | — |
| SYM | ❌ Not listed | Project doesn't use symbol tokens |
| VERB | ✅ | — |
| X | ❌ Not listed | Project doesn't use "other" category |

**Impact:** AUX is used in UD for εἰμί as copula/auxiliary. The project's doc mentions εἰμί in the UPOS table note but tags it as VERB. The linter's `VALID_UPOS` set also lacks AUX, SYM, and X — tokens with these tags will be flagged as invalid.

---

## 2. FEATS (Morphological Features)

### Feature Keys

| UD Universal Features (full list) | This Project | Difference |
|---|---|---|
| Animacy | ❌ | Not used (Greek doesn't distinguish animacy) |
| Aspect | ✅ | — |
| Case | ✅ | — |
| Clusivity | ❌ | Not used |
| Definite | ✅ | — |
| Degree | ✅ | — |
| Deixis | ❌ | Not used |
| Evident | ❌ | Not used |
| Gender | ✅ | — |
| Mood | ✅ | — |
| NounClass | ❌ | Not used |
| Number | ✅ | — |
| NumType | ❌ | Not listed but NUM tokens exist | Should be included for NUM UPOS |
| Person | ✅ | — |
| Polarity | ✅ | — |
| Polite | ❌ | Not used |
| Poss | ❌ | Not used |
| PronType | ✅ | — |
| Reflex | ❌ | Not used |
| Tense | ✅ | — |
| VerbForm | ✅ | — |
| Voice | ✅ | — |

### Feature Value Differences

| Feature | UD Standard Values | This Project | Difference |
|---|---|---|---|
| **Case** | Nom, Gen, Dat, Acc, Voc, Abl, Abs, Add, Ade, All, Ben, Cau, Cmp, Cns, Com, Del, Dis, Ela, Equ, Erg, Ess, Ill, Ine, Ins, Lat, Loc, Par, Per, Sbe, Sbl, Spl, Sub, Sup, Tem, Ter, Tra | Nom, Gen, Dat, Acc, Voc | Subset only — correct for Ancient Greek |
| **Gender** | Masc, Fem, Neut, Com | Masc, Fem, Neut, Com | Matches (Com used for Greek common gender like παῖς) |
| **Number** | Sing, Plur, Dual, Coll, Count, Grpa, Grpl, Inv, Pauc, Ptan, Tri | Sing, Plur, Dual | Subset — correct for Greek |
| **Person** | 1, 2, 3, 4 | 1, 2, 3 | Matches (4th person not used in Greek) |
| **Tense** | Pres, Imp, Past, Fut, Pqp, Aor | Pres, Imp, Aor, Perf, Fut | **Mismatch:** UD uses `Past` and `Pqp` (pluperfect); project uses `Aor` (aorist) and `Perf` (perfect). `Aor` and `Perf` are not UD-standard values for Tense — they're Greek-specific. UD would encode aorist as `Tense=Past` and handle the distinction via Aspect. |
| **Mood** | Ind, Sub, Opt, Imp, Inf, Part, Cnd, Des, Jus, Nec, Pot, Prp, Qot, Adm, Irr, Int | Ind, Sub, Opt, Imp, Inf, Part | Subset — `Opt` is valid for Greek (optative mood). However, the linter flags `Mood=Subj` but UD uses `Sub` for subjunctive, which matches the project. |
| **Voice** | Act, Mid, Pass, Antip, Cau, Dir, Inv, Rcp | Act, Mid, Pass | Subset — correct for Greek |
| **Aspect** | Imp, Perf, Pro, Prog, Prosp, Freq, Hab, Iter | Imp, Perf | Subset — correct for Greek (imperfective/perfective distinction) |
| **VerbForm** | Fin, Inf, Part, Ger, Conv, Gdv, Sup, Vnoun | Fin, Inf, Part, Ger | Subset — `Ger` is included but rare in Greek; `Conv` (converb) not used |
| **Degree** | Pos, Cmp, Sup, Abs, Aug, Dim, Equ | Pos, Cmp, Sup | Subset — correct for Greek |
| **Definite** | Def, Ind, Com, Cons, Red, Spec | Def | Subset — Greek articles are always definite |
| **PronType** | Art, Dem, Int, Rel, Prs, Rcp, Ind, Emp, Exc, Neg, Poss, Tot | Art, Dem, Int, Rel, Prs, Rcp, Ind | Subset — missing `Neg` (used for οὐ/μή as negative pronouns) |
| **Polarity** | Pos, Neg | Neg | **Mismatch:** Project only lists `Neg`; UD standard is `Pos` and `Neg` |

### Key Tense/Aspect Issue

The biggest semantic divergence: **UD treats aorist as a tense-aspect combination** (`Tense=Past|Aspect=Perf`), while this project uses `Tense=Aor` as a distinct value. This is a common convention in Ancient Greek treebanks (e.g., PROIEL) but is not UD-standard. The linter accepts `Aor` but it would fail a strict UD validator.

---

## 3. DEPREL (Dependency Relations)

| UD Universal Relations (37 + subtypes) | This Project | Difference |
|---|---|---|
| acl | ✅ | — |
| acl:relcl | ✅ | — |
| advcl | ✅ | — |
| advcl:relcl | ❌ | Not used (adverbial relative clauses) |
| advmod | ✅ | — |
| advmod:emph | ❌ | Not used |
| advmod:lmod | ❌ | Not used |
| amod | ✅ | — |
| appos | ✅ | — |
| aux | ✅ | — |
| aux:pass | ❌ | Not used (project doesn't use AUX tag) |
| case | ✅ | — |
| cc | ✅ | — |
| cc:preconj | ❌ | Not used |
| ccomp | ✅ | — |
| clf | ❌ | Not used (classifiers, not relevant for Greek) |
| compound | ✅ | — |
| compound:lvc | ❌ | Not used |
| compound:prt | ❌ | Not used |
| compound:redup | ❌ | Not used |
| compound:svc | ❌ | Not used |
| conj | ✅ | — |
| cop | ✅ | — |
| csubj | ✅ | — |
| csubj:outer | ❌ | Not used |
| csubj:pass | ✅ | — |
| dep | ❌ | Not used (unspecified dependency) |
| det | ✅ | — |
| det:numgov | ❌ | Not used |
| det:nummod | ❌ | Not used |
| det:poss | ❌ | Not used |
| discourse | ✅ | — |
| dislocated | ✅ | — |
| expl | ❌ | Not used |
| expl:impers | ❌ | Not used |
| expl:pass | ❌ | Not used |
| expl:pv | ❌ | Not used |
| fixed | ✅ | — |
| flat | ✅ | — |
| flat:foreign | ❌ | Not used |
| flat:name | ❌ | Not used (project uses `flat` without subtype) |
| goeswith | ❌ | Not used |
| iobj | ✅ | — |
| list | ❌ | Not used |
| mark | ✅ | — |
| nmod | ✅ | — |
| nmod:poss | ❌ | Not used |
| nmod:tmod | ❌ | Not used |
| nsubj | ✅ | — |
| nsubj:outer | ❌ | Not used |
| nsubj:pass | ✅ | — |
| nummod | ✅ | — |
| nummod:gov | ❌ | Not used |
| obj | ✅ | — |
| obl | ✅ | — |
| obl:agent | ✅ | — |
| obl:arg | ❌ | Not used |
| obl:lmod | ❌ | Not used |
| obl:tmod | ❌ | Not used |
| orphan | ✅ | — |
| parataxis | ✅ | — |
| punct | ✅ | — |
| reparandum | ❌ | Not used |
| root | ✅ | — |
| vocative | ✅ | — |
| xcomp | ✅ | — |
| **gen** | ✅ (project-specific) | **Non-standard.** Not a UD relation. Used for Greek genitive modifiers where `nmod` might be more standard. |

**`gen` is the only non-UD relation** in the project. It's a project-specific convention for genitive modifiers.

---

## 4. DEPS Column (Enhanced Dependencies)

| | UD Standard | This Project |
|---|---|---|
| Usage | Optional; if provided, must be for all sentences | Always `_` (never used) |

The project explicitly disallows enhanced dependencies. This is valid per UD ("if a treebank does not provide any enhanced representation, it should be left unspecified").

---

## 5. MISC Column

| | UD Standard | This Project |
|---|---|---|
| Format | Pipe-separated key=value; `_` if empty | Same |
| Key casing | No standard; common attributes use mixed case (e.g., `SpaceAfter`, `Translit`, `Gloss`, `LTranslit`, `NewPar`) | **Lowercase keys only** (except `Ref`) |
| `SpaceAfter=No` | Standard UD attribute for detokenization | ❌ Not used |
| `Gloss` | UD standard (uppercase G) | Project uses `gloss` (lowercase) |
| `Ref` | Not a UD standard attribute | Project-specific; citation reference for Xenophon |
| `Translit`/`LTranslit` | UD standard for non-Latin scripts | ❌ Not used (could be useful for Greek) |

**Key difference:** The UD spec uses `Gloss` (uppercase G) as a standard MISC attribute. The project uses `gloss` (lowercase g). The project's "lowercase keys only" rule contradicts UD convention where standard attributes like `SpaceAfter`, `Translit`, and `Gloss` use title case.

---

## 6. Sentence-Level Metadata

| | UD Standard | This Project |
|---|---|---|
| `sent_id` | **Required.** Must be unique treebank-wide. | Required with work-specific format (`perry-NNN-sN` or `xen-anabasis-NN-sN`) |
| `text` | **Required.** Must reconstruct original sentence. | Required. Linter validates against FORM tokens. |
| `text_en` | Optional. English translation of sentence. | Not used. Project uses `prose_translation` and `literal_translation` instead. |
| `translit` | Optional. Transliteration of `text`. | Not used. |
| Other comments | Unrestricted. | Project requires `translation_lang`, `prose_translation`, `literal_translation`, plus work-specific headers. |

The project's `prose_translation` and `literal_translation` are non-standard but valid as custom sentence-level comments.

---

## 7. File-Level Metadata

| | UD Standard | This Project |
|---|---|---|
| File headers | No standard for file-level headers. UD only defines sentence-level `#` comments. | Project requires 11 file-level headers before first sentence. |
| `global.columns` | Defined in CoNLL-U Plus extension, not base spec. | Required. Must be the standard 10 columns. |
| `newdoc` / `newpar` | Standard UD markers for document/paragraph boundaries. | Not used. |

The project's file-level headers (`source`, `source_edition`, `encoder`, etc.) are a project-specific convention. They're valid CoNLL-U comments but not part of the UD spec.

---

## 8. Multiword Tokens and Empty Nodes

| | UD Standard | This Project |
|---|---|---|
| Multiword tokens (e.g., `1-2`) | Supported | ❌ Linter skips them (only processes `^\d+$` IDs) |
| Empty nodes (e.g., `1.1`) | Supported for enhanced deps | ❌ Not used (no enhanced dependencies) |

The linter silently skips multiword token ranges and empty nodes, which is reasonable since the project doesn't use either feature.

---

## 9. Structural Rules

| | UD Standard | This Project |
|---|---|---|
| Blank lines | Exactly one after every sentence, including last | Same (implied by linter's sentence-splitting logic) |
| Comment placement | Only before token lines, not between them | Same (linter doesn't enforce this) |
| Empty sentences | Not allowed | Not explicitly checked (but `empty-file` rule catches files with no tokens) |
| ID sequencing | Must be consecutive integers starting at 1 per sentence | Not validated by linter |
| FEATS sorting | Should be alphabetically sorted by attribute name | Not validated by linter |
| FEATS format | `[A-Z][A-Za-z0-9]*(\[[a-z0-9]+\])?` for keys, `[A-Z0-9][A-Za-z0-9]*` for values | Linter uses hardcoded whitelist instead of regex |

---

## Summary of Actionable Divergences

1. **Missing UPOS tags:** AUX, SYM, X not in the project's tagset. AUX is the most likely to be needed (εἰμί as auxiliary). The linter will reject these.

2. **`Tense=Aor` and `Tense=Perf`:** Non-UD-standard. UD uses `Tense=Past` with `Aspect=Perf` for aorist. This is a deliberate Greek-specific convention but breaks UD compatibility.

3. **`gen` DEPREL:** Non-UD relation. Consider `nmod` + `Case=Gen` as the UD-standard alternative, or document it as a language-specific subtype like `nmod:gen`.

4. **MISC key casing:** Project mandates lowercase (`gloss=`, `ref=`) but UD convention uses title case (`Gloss=`, `Ref=` is non-standard either way). This creates incompatibility with UD tools.

5. **No `SpaceAfter=No`:** Standard UD detokenization attribute is missing. Not critical for Greek (spacing rules differ) but limits compatibility.

6. **No `NumType` feature:** NUM tokens exist but lack `NumType=Card` which is standard in UD.

7. **File-level headers:** Project-specific convention. Valid as comments but tools expecting strict UD format may ignore or strip them.

8. **Custom sentence headers:** `prose_translation`, `literal_translation`, `translation_lang`, `parallel_id`, `title`, `document_id`, `subdoc` are all non-standard but valid as comment lines.
