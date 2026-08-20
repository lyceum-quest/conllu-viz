/** Queue helpers for minute-based learning cards deferred inside a study session. */

export interface DeferredQueueState<T> {
  queue: T[];
  currentIdx: number;
  deferredCards: Set<T>;
  readyDeferredCards: Set<T>;
}

export interface DeferredQueueLists<T> {
  deferredQueue: T[];
  readyDeferredQueue: T[];
}

export interface ReconciledDeferredQueue<T> extends DeferredQueueLists<T> {
  queue: T[];
  currentIdx: number;
}

export interface DeferredQueueReconciliation<T> {
  queue: readonly T[];
  currentIdx: number;
  deferredQueue?: Iterable<T>;
  readyDeferredQueue?: Iterable<T>;
  isLearning: (item: T) => boolean;
  nextReview: (item: T) => number;
  now: number;
}

/**
 * Normalize persisted deferred status into queue order. Ready status wins if a
 * malformed saved record puts an item in both lists; unknowns and duplicates
 * are discarded.
 */
export function normalizeDeferredQueueLists<T>(
  queue: readonly T[],
  deferredQueue: Iterable<T> = [],
  readyDeferredQueue: Iterable<T> = [],
): DeferredQueueLists<T> {
  const deferred = new Set(deferredQueue);
  const ready = new Set(readyDeferredQueue);
  const seen = new Set<T>();
  const normalized: DeferredQueueLists<T> = { deferredQueue: [], readyDeferredQueue: [] };

  for (const item of queue) {
    if (seen.has(item)) continue;
    seen.add(item);
    if (ready.has(item)) {
      normalized.readyDeferredQueue.push(item);
    } else if (deferred.has(item)) {
      normalized.deferredQueue.push(item);
    }
  }

  return normalized;
}

/**
 * Reconcile fresh or persisted local-session status against the live scheduler.
 * Future learning cards are always deferred. Tracked due cards stay ready, and
 * any due learning card behind the saved position is rewound into the active
 * queue. Mature cards never retain intraday status.
 */
export function reconcileDeferredQueue<T>(
  input: DeferredQueueReconciliation<T>,
): ReconciledDeferredQueue<T> {
  const queue = [...input.queue];
  const currentIdx = Math.min(Math.max(0, input.currentIdx), queue.length);
  const persistedDeferred = new Set(input.deferredQueue ?? []);
  const persistedReady = new Set(input.readyDeferredQueue ?? []);
  const deferredCards = new Set<T>();
  const readyDeferredCards = new Set<T>();
  const seen = new Set<T>();

  for (let idx = 0; idx < queue.length; idx++) {
    const item = queue[idx];
    if (seen.has(item)) continue;
    seen.add(item);
    if (!input.isLearning(item)) continue;

    if (input.nextReview(item) > input.now || idx < currentIdx) {
      deferredCards.add(item);
    } else if (persistedDeferred.has(item) || persistedReady.has(item)) {
      readyDeferredCards.add(item);
    }
  }

  const state: DeferredQueueState<T> = {
    queue,
    currentIdx,
    deferredCards,
    readyDeferredCards,
  };
  queueDueDeferredItems(state, input.nextReview, input.now, false);

  return {
    queue: state.queue,
    currentIdx: state.currentIdx,
    ...normalizeDeferredQueueLists(state.queue, state.deferredCards, state.readyDeferredCards),
  };
}

/**
 * Reinsert elapsed deferred items at the current position, or immediately after
 * the visible item. Returns false when nothing became due.
 */
export function queueDueDeferredItems<T>(
  state: DeferredQueueState<T>,
  nextReview: (item: T) => number,
  now: number,
  preserveCurrentItem: boolean,
): boolean {
  const dueItems = [...state.deferredCards]
    .filter(item => nextReview(item) <= now)
    .sort((a, b) => nextReview(a) - nextReview(b));
  if (dueItems.length === 0) return false;

  const currentItem = preserveCurrentItem && state.currentIdx < state.queue.length
    ? state.queue[state.currentIdx]
    : null;

  for (const item of dueItems) {
    state.deferredCards.delete(item);
    state.readyDeferredCards.add(item);
    const queuedIdx = state.queue.indexOf(item);
    if (queuedIdx === -1) continue;
    state.queue.splice(queuedIdx, 1);
    if (queuedIdx < state.currentIdx) state.currentIdx--;
  }

  const insertionIdx = currentItem !== null
    ? state.queue.indexOf(currentItem) + 1
    : state.currentIdx;
  let readyCount = 0;
  while (state.readyDeferredCards.has(state.queue[insertionIdx + readyCount])) readyCount++;
  const readyItems = state.queue.splice(insertionIdx, readyCount);
  readyItems.push(...dueItems);
  readyItems.sort((a, b) => nextReview(a) - nextReview(b));
  state.queue.splice(insertionIdx, 0, ...readyItems);
  return true;
}
