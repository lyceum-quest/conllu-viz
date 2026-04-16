# Plan: SRS Study Mode + Conllu File Browser

## Architecture
Hash-based SPA routing: `#browser` | `#tree:<fileId>` | `#study:<fileId>`
All shared modules (morpho, segment, types) reused. New modules:

### New Files
1. `src/store.ts` — localStorage persistence (SRS state + file registry)
2. `src/srs.ts` — SM-2 spaced repetition algorithm
3. `src/router.ts` — hash router orchestrator
4. `src/browser.ts` — conllu file browser page
5. `src/study.ts` — SRS card review session
6. `src/styles/browser.css` — browser page styles
7. `src/styles/study.css` — study page styles

### Changes
8. `index.html` — add `#page` mount point, top nav bar
9. `src/main.ts` — router init, page mount, keep existing tree logic

## Store Schema
```json
{
  "files": { "<id>": { id, name, source, loadAt, content } },
  "sessions": { "<fileId>": { fileId, tokens: { "<tokenKey>": { interval, ease, reviews, nextReview, lapses } } } }
}
```
Where `<tokenKey>` = `<sentId>:<tokenId>` (unique per sentence + token)

## SM-2 Algorithm
- Quality: 1=Again, 2=Hard, 3=Good, 4=Easy
- interval: If quality < 3 → interval=1, reset reviews=0
- If quality >= 3 and reviews=1 → interval=1
- If quality >= 3 and reviews=2 → interval=6
- Otherwise: interval = previous * ease
- ease += 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02), floor at 1.3
- nextReview = now + interval * 24h

## Study Page UX
- Card flip: front = Greek word (large, centered), back = morphology panel + sentence info + translations
- Rating buttons below card: Again / Hard / Good / Easy
- Progress: "X / Y cards" + progress bar
- "New + Due" queue prioritization (due cards first, random order within)

## Browser Page UX
- Card per file: name, sentence count, words studied/total, % mastered
- Actions: "Study" → #study:id, "Browse" → #tree:id
- "Load new file" button uses existing drag-drop/open mechanism
- Default files from /test-data/ available for quick start
