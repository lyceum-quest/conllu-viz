# Research: Global progressive vocabulary review

## Question
How should vocabulary encountered while studying individual works accumulate into one durable, globally scheduled review queue, while preserving exact source provenance and navigation?

## Findings
### Option 1: Build a global queue over existing per-token SRS sessions
- Each rated card already has an `SRSState` with an epoch-millisecond `nextReview`; only rated cards exist in `session.tokens`, so iterating those records naturally means “words encountered so far.”
- A global card identity can be `(fileId, sentId, tokenId)`. This preserves every occurrence and its exact sentence context without migrating current progress.
- Existing file study and global study can update the same `SRSState`, so schedules never diverge.
- Add cumulative review metadata (`firstSeen`, `lastReviewed`, `totalReviews`, rating counts, and last rating) as optional fields. Existing saved states remain structurally valid and are upgraded when next reviewed.
- Pros: no duplicated source of truth; backward-compatible; exact provenance; smallest migration risk.
- Cons: repeated occurrences of the same lemma remain separate cards.
- Source: `src/store.ts` (`FileSession`, `SRSState`), `src/study.ts` (`handleRating`, `buildQueue`), `src/srs.ts` (`nextReview`).

### Option 2: Introduce a lemma-level global vocabulary store
- Normalize cards by lemma and merge encounters from multiple files/sentences into one schedule, retaining a provenance list.
- Pros: fewer duplicate cards; closer to a conventional vocabulary deck.
- Cons: requires choosing how homographs, different senses/glosses, and morphology-specific prompts merge; requires migration and synchronization between per-token and lemma-level schedules; “this card” no longer maps to one source occurrence.
- Source: `src/types.ts` (`Token` has lemma, form, gloss, morphology), `src/store.ts` (current identity is token occurrence).

### Option 3: Copy encountered cards into a separate global deck
- On each local rating, create/update a second global card record with source metadata.
- Pros: global behavior can evolve independently.
- Cons: duplicates SRS state, creates conflict over whether local or global ratings are authoritative, and risks stale provenance when files change or are removed.
- Source: `src/store.ts` and `src/study.ts` show one current authoritative state per file/token.

## Recommendation
Use Option 1. Add a permanent `#global-study` route and navigation entry. Build its queue only from token states already present in `sessions`, sorted/shuffled with currently due cards first, and update those same states with the existing SM-2 implementation. Display the work title, filename, sentence ID, sentence context, and an exact Reader link for every card.

Add optional cumulative metadata to `SRSState` and populate it on every non-cram rating. The existing `nextReview` epoch value is the requested UTC-capable timer; show due counts and schedule data globally. Optional fields preserve all current localStorage records without a destructive schema migration.

For exact links, extend Reader routing with `sentence` and `token` query parameters. After chunked rendering completes, scroll to that sentence and visibly mark the source token. Keep per-work study behavior unchanged.

## Sources
- `src/store.ts` — localStorage metadata/SRS persistence and token key format.
- `src/srs.ts` — epoch-based scheduling and SM-2 transitions.
- `src/study.ts` — card rendering, ratings, and per-file queues.
- `src/router.ts` — hash route and sentence query conventions.
- `src/reader.ts` — sentence/token DOM identifiers and chunked rendering.
- `src/main.ts`, `index.html` — route mounting and global navigation.
