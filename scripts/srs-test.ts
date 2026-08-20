#!/usr/bin/env npx tsx
/** Deterministic transition and intraday-queue tests for the SRS scheduler. */

import type { SRSState } from '../src/store';
import {
  DEFAULT_EASE, MIN_EASE, Q_AGAIN, Q_EASY, Q_GOOD, Q_HARD,
  intervalLabel, isInLearningPhase, newSRSState, previewInterval, review,
} from '../src/srs';
import {
  normalizeDeferredQueueLists, queueDueDeferredItems, reconcileDeferredQueue,
} from '../src/deferred-queue';

const NOW = 1_700_000_000_000;
const MINUTE_MS = 60_000;
const originalNow = Date.now;
Date.now = () => NOW;

let passed = 0;
let failed = 0;

function fail(message: string): never {
  throw new Error(message);
}

function test(name: string, run: () => void) {
  try {
    run();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${error instanceof Error ? error.message : error}`);
  }
}

function equal<T>(actual: T, expected: T, message: string) {
  if (!Object.is(actual, expected)) fail(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

function close(actual: number, expected: number, message: string) {
  if (Math.abs(actual - expected) > 1e-9) fail(`${message}: expected ${expected}, got ${actual}`);
}

function deepEqual(actual: unknown, expected: unknown, message: string) {
  const actualJSON = JSON.stringify(actual);
  const expectedJSON = JSON.stringify(expected);
  if (actualJSON !== expectedJSON) fail(`${message}: expected ${expectedJSON}, got ${actualJSON}`);
}

function card(overrides: Partial<SRSState> = {}): SRSState {
  return {
    interval: 0,
    ease: DEFAULT_EASE,
    reviews: 0,
    nextReview: NOW,
    lapses: 0,
    learningStep: 0,
    ...overrides,
  };
}

function applyWithParity(state: SRSState, quality: number): { minutes: number; result: SRSState } {
  const minutes = previewInterval(state, quality);
  const result = review(state, quality);
  equal(result.nextReview, NOW + minutes * MINUTE_MS, 'preview/apply timestamp parity');
  return { minutes, result };
}

console.log('SRS transitions');

test('new state is deterministic and due immediately', () => {
  const state = newSRSState();
  equal(state.interval, 0, 'new interval');
  equal(state.ease, DEFAULT_EASE, 'new ease');
  equal(state.reviews, 0, 'new reviews');
  equal(state.learningStep, 0, 'new learning step');
  equal(state.nextReview, NOW, 'new due time');
});

test('new Again enters the configured first 1-minute step', () => {
  const { minutes, result } = applyWithParity(card(), Q_AGAIN);
  equal(minutes, 1, 'Again delay');
  equal(result.learningStep, 0, 'Again step');
  equal(result.reviews, 0, 'Again reviews');
});

test('new Hard stays on the first learning step for 2 minutes', () => {
  const { minutes, result } = applyWithParity(card(), Q_HARD);
  equal(minutes, 2, 'Hard delay');
  equal(result.learningStep, 0, 'Hard step');
  equal(result.interval, 0, 'Hard day interval');
});

test('new Good advances to the 10-minute learning step', () => {
  const { minutes, result } = applyWithParity(card(), Q_GOOD);
  equal(minutes, 10, 'Good delay');
  equal(result.learningStep, 1, 'Good step');
  equal(result.reviews, 0, 'Good remains learning');
});

test('new Easy graduates immediately to a 4-day mature review', () => {
  const { minutes, result } = applyWithParity(card(), Q_EASY);
  equal(minutes, 4 * 24 * 60, 'Easy delay');
  equal(result.interval, 4, 'Easy interval');
  equal(result.reviews, 1, 'Easy review phase');
});

test('second-step Again, Hard, Good, and Easy transition correctly', () => {
  const learning = () => card({ learningStep: 1 });

  const again = applyWithParity(learning(), Q_AGAIN);
  equal(again.minutes, 1, 'second-step Again delay');
  equal(again.result.learningStep, 0, 'second-step Again reset');

  const hard = applyWithParity(learning(), Q_HARD);
  equal(hard.minutes, 15, 'second-step Hard delay');
  equal(hard.result.learningStep, 1, 'second-step Hard stays');

  const good = applyWithParity(learning(), Q_GOOD);
  equal(good.minutes, 24 * 60, 'Good graduation delay');
  equal(good.result.interval, 1, 'Good graduation interval');
  equal(good.result.reviews, 1, 'Good enters mature review');

  const easy = applyWithParity(learning(), Q_EASY);
  equal(easy.minutes, 4 * 24 * 60, 'Easy graduation delay');
  equal(easy.result.reviews, 1, 'Easy enters mature review');
});

test('a newly graduated card uses mature day-based Hard scheduling', () => {
  const graduated = review(card({ learningStep: 1 }), Q_GOOD);
  const lapses = graduated.lapses;
  const { minutes, result } = applyWithParity(graduated, Q_HARD);
  equal(minutes, 2 * 24 * 60, 'graduated Hard delay');
  equal(result.interval, 2, 'graduated Hard interval');
  equal(result.reviews, 2, 'graduated mature review count');
  equal(result.lapses, lapses, 'graduated Hard does not lapse');
});

test('mature Again lapses directly into the configured 10-minute relearning step', () => {
  const mature = card({ interval: 10, reviews: 5, lapses: 2 });
  const { minutes, result } = applyWithParity(mature, Q_AGAIN);
  equal(minutes, 10, 'mature Again delay');
  equal(result.interval, 5, 'lapsed retained interval');
  equal(result.reviews, 0, 'lapsed relearning marker');
  equal(result.lapses, 3, 'lapse count');
  equal(result.learningStep, 0, 'relearning step');
  equal(previewInterval(result, Q_AGAIN), 10, 'relearning Again remains on 10-minute sequence');
});

test('mature Hard schedules ~1.2x without a lapse', () => {
  const mature = card({ interval: 10, reviews: 5, lapses: 2 });
  const { minutes, result } = applyWithParity(mature, Q_HARD);
  equal(minutes, 12 * 24 * 60, 'mature Hard delay');
  equal(result.interval, 12, 'mature Hard interval');
  equal(result.reviews, 6, 'mature Hard review count');
  equal(result.lapses, 2, 'mature Hard lapses');
  close(result.ease, 2.18, 'mature Hard ease');
});

test('mature Good and Easy apply their exact displayed intervals', () => {
  const good = applyWithParity(card({ interval: 10, reviews: 5 }), Q_GOOD);
  equal(good.minutes, 23 * 24 * 60, 'mature Good delay');
  equal(good.result.interval, 23, 'mature Good interval');
  close(good.result.ease, 2.36, 'mature Good ease');

  const easy = applyWithParity(card({ interval: 10, reviews: 5 }), Q_EASY);
  equal(easy.minutes, 32 * 24 * 60, 'mature Easy delay');
  equal(easy.result.interval, 32, 'mature Easy interval');
  close(easy.result.ease, 2.5, 'mature Easy ease');
});

test('mature successful reviews enforce minimum one-day growth', () => {
  for (const quality of [Q_HARD, Q_GOOD, Q_EASY]) {
    const { minutes, result } = applyWithParity(card({ interval: 1, reviews: 1, ease: MIN_EASE }), quality);
    equal(minutes, 2 * 24 * 60, `quality ${quality} minimum-growth delay`);
    equal(result.interval, 2, `quality ${quality} minimum-growth interval`);
  }
});

test('ease never drops below the configured minimum', () => {
  for (const quality of [Q_AGAIN, Q_HARD, Q_GOOD]) {
    const { result } = applyWithParity(card({ interval: 8, reviews: 3, ease: MIN_EASE }), quality);
    equal(result.ease, MIN_EASE, `quality ${quality} minimum ease`);
  }
});

test('relearning uses one 10-minute step then returns to its reduced mature interval', () => {
  const lapsed = review(card({ interval: 10, reviews: 4 }), Q_AGAIN);

  const hard = applyWithParity({ ...lapsed }, Q_HARD);
  equal(hard.minutes, 15, 'relearning Hard delay');
  equal(hard.result.reviews, 0, 'relearning Hard remains relearning');

  const good = applyWithParity({ ...lapsed }, Q_GOOD);
  equal(good.minutes, 5 * 24 * 60, 'relearning Good delay');
  equal(good.result.interval, 5, 'relearning Good retained interval');
  equal(good.result.reviews, 1, 'relearning Good returns to review');

  const easy = applyWithParity({ ...lapsed }, Q_EASY);
  equal(easy.minutes, 5 * 24 * 60, 'relearning Easy delay');
  equal(easy.result.interval, 5, 'relearning Easy interval');
  equal(easy.result.reviews, 1, 'relearning Easy returns to review');
});

test('preview and apply agree for every rating in every scheduler phase', () => {
  const phases = [
    card(),
    card({ learningStep: 1 }),
    card({ interval: 5, reviews: 0, lapses: 1 }),
    card({ interval: 10, reviews: 3 }),
  ];
  for (const phase of phases) {
    for (const quality of [Q_AGAIN, Q_HARD, Q_GOOD, Q_EASY]) {
      applyWithParity({ ...phase, ratingCounts: { ...phase.ratingCounts } }, quality);
    }
  }
});

test('interval labels exactly format the scheduled transition', () => {
  equal(intervalLabel(card(), Q_AGAIN), '1m', 'new Again label');
  equal(intervalLabel(card(), Q_HARD), '2m', 'new Hard label');
  equal(intervalLabel(card(), Q_GOOD), '10m', 'new Good label');
  equal(intervalLabel(card(), Q_EASY), '4d', 'new Easy label');
  equal(intervalLabel(card({ interval: 10, reviews: 3 }), Q_AGAIN), '10m', 'mature Again label');
  equal(intervalLabel(card({ interval: 10, reviews: 3 }), Q_HARD), '12d', 'mature Hard label');
  equal(intervalLabel(card({ interval: 24, reviews: 3, ease: MIN_EASE }), Q_GOOD), '1mo', 'month label');
  equal(intervalLabel(card({ interval: 216, reviews: 3, ease: MIN_EASE }), Q_EASY), '1.0y', 'year label');
});

test('review metadata is updated without changing scheduling parity', () => {
  const state = card({ reviews: 2, interval: 3, totalReviews: 7, ratingCounts: { 3: 2 } });
  applyWithParity(state, Q_GOOD);
  equal(state.firstSeen, NOW, 'first seen');
  equal(state.lastReviewed, NOW, 'last reviewed');
  equal(state.totalReviews, 8, 'total reviews');
  equal(state.lastRating, Q_GOOD, 'last rating');
  deepEqual(state.ratingCounts, { 3: 3 }, 'rating counts');
});

test('phase classification distinguishes learning and relearning from mature cards', () => {
  equal(isInLearningPhase(card()), true, 'new learning card');
  equal(isInLearningPhase(card({ interval: 5, reviews: 0, lapses: 1 })), true, 'relearning card');
  equal(isInLearningPhase(card({ interval: 1, reviews: 1 })), false, 'mature day-based card');
});

console.log('\nDeferred intraday queue');

test('a fresh local session reconstructs future learning cards as deferred', () => {
  const states: Record<string, SRSState> = {
    'due-learning': card({ nextReview: NOW }),
    'future-learning': card({ nextReview: NOW + 10 * MINUTE_MS, learningStep: 1 }),
    'future-relearning': card({
      interval: 5,
      reviews: 0,
      lapses: 1,
      nextReview: NOW + 15 * MINUTE_MS,
    }),
    'future-mature': card({ interval: 5, reviews: 2, nextReview: NOW + 5 * MINUTE_MS }),
  };
  const reconciled = reconcileDeferredQueue({
    queue: ['due-learning', 'future-learning', 'future-relearning', 'future-mature'],
    currentIdx: 0,
    isLearning: key => isInLearningPhase(states[key]),
    nextReview: key => states[key].nextReview,
    now: NOW,
  });

  deepEqual(reconciled, {
    queue: ['due-learning', 'future-learning', 'future-relearning', 'future-mature'],
    currentIdx: 0,
    deferredQueue: ['future-learning', 'future-relearning'],
    readyDeferredQueue: [],
  }, 'fresh deferred reconstruction');
});

test('persisted statuses reconcile with live scheduling changes', () => {
  const states: Record<string, SRSState> = {
    'rewind-late': card({ nextReview: NOW - MINUTE_MS }),
    'stale-ready-mature': card({ interval: 3, reviews: 2, nextReview: NOW }),
    'rewind-early': card({ nextReview: NOW - 2 * MINUTE_MS, learningStep: 1 }),
    visible: card({ interval: 2, reviews: 1, nextReview: NOW }),
    'valid-ready': card({ nextReview: NOW }),
    'ready-became-future': card({ nextReview: NOW + 10 * MINUTE_MS, learningStep: 1 }),
    'stale-deferred-mature': card({
      interval: 8,
      reviews: 3,
      nextReview: NOW + 20 * MINUTE_MS,
    }),
  };
  const reconciled = reconcileDeferredQueue({
    queue: [
      'rewind-late',
      'stale-ready-mature',
      'rewind-early',
      'visible',
      'valid-ready',
      'ready-became-future',
      'stale-deferred-mature',
    ],
    currentIdx: 3,
    deferredQueue: ['rewind-early', 'stale-deferred-mature'],
    readyDeferredQueue: ['stale-ready-mature', 'valid-ready', 'ready-became-future'],
    isLearning: key => isInLearningPhase(states[key]),
    nextReview: key => states[key].nextReview,
    now: NOW,
  });

  deepEqual(reconciled, {
    queue: [
      'stale-ready-mature',
      'rewind-early',
      'rewind-late',
      'visible',
      'valid-ready',
      'ready-became-future',
      'stale-deferred-mature',
    ],
    currentIdx: 1,
    deferredQueue: ['ready-became-future'],
    readyDeferredQueue: ['rewind-early', 'rewind-late', 'valid-ready'],
  }, 'live status reconciliation');
});

test('a due deferred card is inserted after, not over, the visible card', () => {
  const dueAt: Record<string, number> = { deferred: 100, visible: 0, later: 0 };
  const queueState = {
    queue: ['deferred', 'visible', 'later'],
    currentIdx: 1,
    deferredCards: new Set(['deferred']),
    readyDeferredCards: new Set<string>(),
  };
  equal(queueDueDeferredItems(queueState, key => dueAt[key], 100, true), true, 'queued due item');
  deepEqual(queueState.queue, ['visible', 'deferred', 'later'], 'visible card preserved');
  equal(queueState.queue[queueState.currentIdx], 'visible', 'current visible card');
});

test('a due deferred card wakes an exhausted queue', () => {
  const queueState = {
    queue: ['waiting'],
    currentIdx: 1,
    deferredCards: new Set(['waiting']),
    readyDeferredCards: new Set<string>(),
  };
  equal(queueDueDeferredItems(queueState, () => 100, 100, false), true, 'queued waiting item');
  equal(queueState.currentIdx, 0, 'rewound queue index');
  equal(queueState.queue[0], 'waiting', 'waiting item is current');
});

test('a future deferred card remains deferred', () => {
  const queueState = {
    queue: ['waiting', 'visible'],
    currentIdx: 1,
    deferredCards: new Set(['waiting']),
    readyDeferredCards: new Set<string>(),
  };
  equal(queueDueDeferredItems(queueState, () => 101, 100, true), false, 'future item not queued');
  deepEqual(queueState.queue, ['waiting', 'visible'], 'future queue unchanged');
  equal(queueState.deferredCards.has('waiting'), true, 'future item retained');
});

test('multiple timer waves merge in due order without moving the visible card', () => {
  const dueAt: Record<string, number> = { first: 100, second: 200, visible: 0, later: 0 };
  const queueState = {
    queue: ['first', 'visible', 'second', 'later'],
    currentIdx: 1,
    deferredCards: new Set(['first', 'second']),
    readyDeferredCards: new Set<string>(),
  };

  equal(queueDueDeferredItems(queueState, key => dueAt[key], 100, true), true, 'first wave queued');
  deepEqual(queueState.queue, ['visible', 'first', 'second', 'later'], 'first wave placement');
  equal(queueState.currentIdx, 0, 'index follows visible card after first removal');

  equal(queueDueDeferredItems(queueState, key => dueAt[key], 200, true), true, 'second wave queued');
  deepEqual(queueState.queue, ['visible', 'first', 'second', 'later'], 'ready waves retain due order');
  equal(queueState.queue[queueState.currentIdx], 'visible', 'visible card survives both waves');
  deepEqual([...queueState.readyDeferredCards], ['first', 'second'], 'both waves marked ready');
});

test('an exhausted queue adjusts its index for several removed and absent deferred cards', () => {
  const dueAt: Record<string, number> = { second: 200, first: 100, absent: 300, done: 0 };
  const queueState = {
    queue: ['second', 'done', 'first'],
    currentIdx: 3,
    deferredCards: new Set(['second', 'first', 'absent']),
    readyDeferredCards: new Set<string>(),
  };

  equal(queueDueDeferredItems(queueState, key => dueAt[key], 300, false), true, 'all due cards queued');
  equal(queueState.currentIdx, 1, 'index rewound by removed cards');
  deepEqual(queueState.queue, ['done', 'first', 'second', 'absent'], 'due cards inserted at exhaustion point');
  equal(queueState.queue[queueState.currentIdx], 'first', 'earliest due card is current');
});

test('persisted deferred lists normalize status, duplicates, and queue order', () => {
  const normalized = normalizeDeferredQueueLists(
    ['visible', 'ready-2', 'ready-1', 'future', 'later'],
    ['future', 'ready-1', 'future', 'missing'],
    ['ready-1', 'ready-2', 'ready-1', 'missing'],
  );
  deepEqual(normalized, {
    deferredQueue: ['future'],
    readyDeferredQueue: ['ready-2', 'ready-1'],
  }, 'normalized persisted queues');
});

test('persisted deferred lists remain compatible when optional fields are absent', () => {
  deepEqual(normalizeDeferredQueueLists(['one', 'two']), {
    deferredQueue: [],
    readyDeferredQueue: [],
  }, 'missing persisted fields');
});

Date.now = originalNow;
console.log(`\n${'─'.repeat(50)}`);
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
