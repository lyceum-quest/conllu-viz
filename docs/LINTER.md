# CoNLL-U Linter

The project includes a custom linter that validates `.conllu` files against the conventions defined in [CONLLU.md](CONLLU.md). It catches structural errors, morphological inconsistencies, and project-specific metadata requirements.

## Usage

```bash
# Lint all files under conllu/
npm run lint

# Lint specific files
npx tsx scripts/lint.ts conllu/aesop/fables/perry-015.conllu

# Lint with globs
npx tsx scripts/lint.ts conllu/aesop/fables/*.conllu

# Run linter tests
npm run lint:test
```

Exit code is `1` if any errors are found, `0` otherwise.

## How It Works

The linter runs in three phases over each file:

### Phase 1 — File-level headers

Parses `# key = value` headers at the top of the file and checks:

| Rule | Severity | What it catches |
|---|---|---|
| `file-header-missing` | error | Missing any of the 10 required headers (`global.columns`, `source`, `source_edition`, `encoder`, `editor`, `project`, `conversion_method`, `gloss_type`, `license`, `date_modified`, `contact`) |
| `file-header-columns` | error | `global.columns` value doesn't match the expected 10-column layout |
| `file-header-date` | error | `date_modified` not in `YYYY-MM-DD` format |
| `file-header-license` | warning | License is not `CC BY-SA 4.0` |
| `file-header-contact` | warning | Aesop files with non-default contact address |
| `empty-file` | error | File has no sentences with tokens |

### Phase 2 — Sentence parsing

Groups lines into sentences (headers + tokens separated by blank lines). Parses each token row into its 10 CoNLL-U columns and splits the FEATS field into key-value pairs.

### Phase 3 — Sentence & token validation

#### Sentence-level checks

| Rule | Severity | What it catches |
|---|---|---|
| `sent-header-missing` | error | Missing any of `sent_id`, `text`, `translation_lang`, `prose_translation`, `literal_translation` |
| `sent-header-title` | error | Aesop first sentence missing `# title = ...` |
| `sent-header-parallel` | error | Aesop sentence missing `# parallel_id = ...` |
| `sent-header-docid` | warning | Xenophon sentence missing `# document_id = ...` |
| `sent-header-subdoc` | warning | Xenophon sentence missing `# subdoc = ...` |
| `sent-id-format` | warning | `sent_id` doesn't match the expected pattern (`perry-NNN-sN` for Aesop, `xen-anabasis-NN-sN` for Xenophon) |
| `sent-translation-lang` | warning | `translation_lang` is not `en` |
| `text-mismatch` | warning | `# text` doesn't match the FORM fields reconstructed from tokens (accounts for punctuation spacing) |
| `no-root` | error | Sentence has no token with `HEAD=0` |
| `multiple-roots` | error | Sentence has more than one token with `HEAD=0` |

#### Token-level checks

| Rule | Severity | What it catches |
|---|---|---|
| `upos-conj` | error | `UPOS=CONJ` (should be `CCONJ`) |
| `upos-invalid` | error | UPOS not in the Universal POS tagset |
| `deprel-deprecated` | error | `DEPREL=nsubjpass` (deprecated, use `nsubj:pass`) |
| `deprel-invalid` | error | DEPREL not in the allowed set |
| `head-invalid` | error | HEAD references a token ID that doesn't exist in the sentence |
| `deps-not-empty` | warning | DEPS is not `_` (enhanced dependencies are unused) |
| `feat-mood-subj` | error | `Mood=Subj` (should be `Sub`) |
| `feat-contradiction` | error | Contradictory feature combo like `Aspect=Perf + Tense=Fut` |
| `feat-unknown-key` | warning | Feature key not in the allowed set (Case, Gender, Number, etc.) |
| `feat-unknown-value` | warning | Feature value not recognized for its key |
| `noun-degree-cmp` | warning | NOUN with `Degree=Cmp` (likely should be ADJ) |
| `misc-missing-gloss` | error | MISC field missing required `gloss=` |
| `misc-key-case` | warning | MISC key is not lowercase (`Ref=` is allowed as exception for Xenophon) |
| `det-gender-mismatch` | error | DET gender doesn't match its head noun's gender |
| `det-verb-head` | warning | DET with `deprel=det` pointing to a VERB (likely wrong head) |
| `punct-deprel` | warning | `UPOS=PUNCT` but DEPREL is not `punct` |
| `punct-upos` | warning | DEPREL is `punct` but UPOS is not `PUNCT` |
| `token-columns` | error | Token row doesn't have exactly 10 tab-separated columns |
| `xenophon-missing-ref` | warning | Xenophon token missing `Ref=` in MISC |

## Work-type Detection

The linter detects the work type from the file path:

- Path contains `aesop` → Aesop-specific checks (title on first sentence, parallel_id, sent_id format)
- Path contains `xenophon` → Xenophon-specific checks (document_id, subdoc, Ref= in MISC)

## Output Format

```
✓ conllu/aesop/fables/perry-001.conllu

✗ conllu/aesop/fables/perry-015.conllu (2 errors, 1 warning)
  ✗ [upos-conj] perry-015-s1[4]: δὲ: UPOS=CONJ (should be CCONJ)
  ✗ [head-invalid] perry-015-s2[7]: λόγος: HEAD=99 does not reference a valid token ID
  ⚠ [feat-unknown-value] perry-015-s2[3]: Unknown value "Past" for feature "Tense"

──────────────────────────────────────────────────────────────
Files: 2 checked, 1 clean
Total: 2 errors, 1 warning
```

## Testing

The linter has a companion test suite in `scripts/lint-test.ts` that validates each rule by constructing minimal CoNLL-U strings with known errors. Run with:

```bash
npm run lint:test
```

## Extending

To add a new rule:

1. Add the check in the appropriate phase of `lintContent()` in `scripts/lint.ts`
2. Use the `Finding` interface with a descriptive `rule` name and appropriate `severity`
3. Add a test case in `scripts/lint-test.ts`
4. Update the tables in this document
