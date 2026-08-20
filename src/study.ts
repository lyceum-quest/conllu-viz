/**
 * Study page — Anki-style SRS card review session.
 * Mounts into `#page` element.
 *
 * Session model:
 *   - Queue contains all due + new cards at start
 *   - Day-based answers finish a card for the session
 *   - Minute-based learning/relearning cards stay deferred in the active queue
 *     and return when due without replacing the visible card
 *   - Cram keeps its immediate Again/non-Again queue behavior
 *   - Progress = reviewed / sessionTotal (moves! ✅)
 */

import { parseConllu, Token, Sentence } from './types';
import {
  AppStore, FileSession, SavedStudyProgress,
  loadStore, saveStore, ensureFileSession,
  parseTokenKey, getAllTokenKeys, listFiles,
  getStudySelection, setStudySelection,
  loadStudyProgress, saveStudyProgress, clearStudyProgress,
} from './store';
import {
  newSRSState, review as srsReview, RATINGS, intervalLabel, previewInterval,
  isInLearningPhase, MASTERED_INTERVAL_DAYS,
} from './srs';
import {
  normalizeDeferredQueueLists, queueDueDeferredItems, reconcileDeferredQueue,
} from './deferred-queue';
import { buildMorphAnalysisHTML } from './morpho';
import { navigate, routeUrl } from './router';
import type { StudyMode } from './router';

import './styles/tokens.css';
import './styles/study.css';

// ── Constants ─────────────────────────────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  NOUN: '#e0af68', VERB: '#f7768e', ADJ: '#9ece6a', ADV: '#73daca',
  DET: '#7dcfff', PRON: '#b4f9f8', PROPN: '#ff9e64', ADP: '#bb9af7',
  CCONJ: '#9d7cd8', SCONJ: '#7aa2f7', PART: '#c0caf5', NUM: '#e06c75',
  PUNCT: '#565f89', AUX: '#f7768e', INTJ: '#ff007f', X: '#565f89',
};

/** How many cards ahead to re-insert "Again" cards (Anki default: 3) */
const AGAIN_REINSERT_DISTANCE = 3;
const INTRADAY_INTERVAL_MINUTES = 24 * 60;

// ── State ─────────────────────────────────────────────────────────────────

interface StudyState {
  store: AppStore;
  fileId: string;
  fileName: string;
  workTitle?: string;
  mode: StudyMode;
  session: FileSession;
  sentences: Sentence[];
  allKeys: string[];
  queue: string[];           // cards still to review this session
  currentIdx: number;
  sessionTotal: number;      // total cards reviewed + remaining (for progress)
  reviewedCount: number;     // how many cards got a final rating (≥2 this session)
  cardShowTime: number;      // when current card was shown (for timing)
  totalTimeMs: number        // total time spent this session
  selectedSentences: Set<string>;
  showSentenceSelector: boolean;
  deferredCards: Set<string>;
  readyDeferredCards: Set<string>;
  dueTimer: number | null;
}

let state: StudyState | null = null;
let sentenceSelectorReturnFocus: HTMLElement | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────

function $(sel: string) { return document.querySelector(sel); }

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const morphTooltip = document.getElementById('morph-tooltip') as HTMLElement | null;
let activeMorphFeature: HTMLElement | null = null;

function positionMorphTooltip(x: number, y: number) {
  if (!morphTooltip) return;

  const pad = 14;
  const maxInset = 8;
  const rect = morphTooltip.getBoundingClientRect();
  let left = x + pad;
  let top = y - 10;

  if (left + rect.width > window.innerWidth - maxInset) left = x - rect.width - pad;
  if (left < maxInset) left = maxInset;
  if (top + rect.height > window.innerHeight - maxInset) top = window.innerHeight - rect.height - maxInset;
  if (top < maxInset) top = maxInset;

  morphTooltip.style.left = `${left}px`;
  morphTooltip.style.top = `${top}px`;
}

function showMorphTooltip(target: HTMLElement, x?: number, y?: number) {
  if (!morphTooltip) return;

  const template = target.querySelector('.morph-feat-tooltip-template') as HTMLTemplateElement | null;
  if (!template) return;

  morphTooltip.innerHTML = template.innerHTML;
  morphTooltip.classList.add('visible');
  morphTooltip.setAttribute('aria-hidden', 'false');

  if (typeof x === 'number' && typeof y === 'number') {
    positionMorphTooltip(x, y);
    return;
  }

  const rect = target.getBoundingClientRect();
  positionMorphTooltip(rect.right, rect.top + rect.height / 2);
}

function hideMorphTooltip() {
  if (!morphTooltip) return;
  activeMorphFeature = null;
  morphTooltip.classList.remove('visible');
  morphTooltip.setAttribute('aria-hidden', 'true');
  morphTooltip.innerHTML = '';
}

export function setupReviewCardMorphTooltips(root: HTMLElement | null) {
  if (!root) return;
  root.removeEventListener('mouseover', onMorphMouseOver);
  root.removeEventListener('mousemove', onMorphMouseMove);
  root.removeEventListener('mouseout', onMorphMouseOut);
  root.removeEventListener('focusin', onMorphFocusIn);
  root.removeEventListener('focusout', onMorphFocusOut);
  root.removeEventListener('scroll', hideMorphTooltip, true);
  root.addEventListener('mouseover', onMorphMouseOver);
  root.addEventListener('mousemove', onMorphMouseMove);
  root.addEventListener('mouseout', onMorphMouseOut);
  root.addEventListener('focusin', onMorphFocusIn);
  root.addEventListener('focusout', onMorphFocusOut);
  root.addEventListener('scroll', hideMorphTooltip, true);
  window.removeEventListener('resize', hideMorphTooltip);
  window.addEventListener('resize', hideMorphTooltip);
}

export function cleanupReviewCardMorphTooltips(root: HTMLElement | null) {
  root?.removeEventListener('mouseover', onMorphMouseOver);
  root?.removeEventListener('mousemove', onMorphMouseMove);
  root?.removeEventListener('mouseout', onMorphMouseOut);
  root?.removeEventListener('focusin', onMorphFocusIn);
  root?.removeEventListener('focusout', onMorphFocusOut);
  root?.removeEventListener('scroll', hideMorphTooltip, true);
  window.removeEventListener('resize', hideMorphTooltip);
  hideMorphTooltip();
}

function getMorphFeatureTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('.morph-feat') as HTMLElement | null;
}

function onMorphMouseOver(e: MouseEvent) {
  const feat = getMorphFeatureTarget(e.target);
  if (!feat || feat === activeMorphFeature) return;
  activeMorphFeature = feat;
  showMorphTooltip(feat, e.clientX, e.clientY);
}

function onMorphMouseMove(e: MouseEvent) {
  const feat = getMorphFeatureTarget(e.target);
  if (!feat) return;
  if (feat !== activeMorphFeature) {
    activeMorphFeature = feat;
    showMorphTooltip(feat, e.clientX, e.clientY);
    return;
  }
  positionMorphTooltip(e.clientX, e.clientY);
}

function onMorphMouseOut(e: MouseEvent) {
  const feat = getMorphFeatureTarget(e.target);
  const nextFeat = getMorphFeatureTarget(e.relatedTarget);
  if (!feat || feat !== activeMorphFeature || nextFeat === feat) return;
  if (nextFeat) {
    activeMorphFeature = nextFeat;
    showMorphTooltip(nextFeat);
    return;
  }
  hideMorphTooltip();
}

function onMorphFocusIn(e: FocusEvent) {
  const feat = getMorphFeatureTarget(e.target);
  if (!feat) return;
  activeMorphFeature = feat;
  showMorphTooltip(feat);
}

function onMorphFocusOut(e: FocusEvent) {
  const feat = getMorphFeatureTarget(e.target);
  const nextFeat = getMorphFeatureTarget(e.relatedTarget);
  if (!feat || nextFeat === feat) return;
  if (nextFeat) {
    activeMorphFeature = nextFeat;
    showMorphTooltip(nextFeat);
    return;
  }
  hideMorphTooltip();
}

function shuffle(arr: string[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function orderedSelectedSentences(sentences: Sentence[], selectedSentences: Set<string>): string[] {
  return sentences.filter(sentence => selectedSentences.has(sentence.id)).map(sentence => sentence.id);
}

function isSameSelection(a: Iterable<string>, b: Iterable<string>): boolean {
  const aa = [...new Set(a)].sort();
  const bb = [...new Set(b)].sort();
  return aa.length === bb.length && aa.every((value, idx) => value === bb[idx]);
}

function sanitizeSelection(sentences: Sentence[], selectedSentences: Iterable<string>): string[] {
  const validIds = new Set(sentences.map(sentence => sentence.id));
  return [...new Set(selectedSentences)].filter(id => validIds.has(id));
}

function defaultSelection(sentences: Sentence[]): string[] {
  return sentences[0] ? [sentences[0].id] : [];
}

function resolveInitialSelection(
  store: AppStore,
  fileId: string,
  sentences: Sentence[],
  routeSelectedSentences: string[] | undefined,
  hasRouteSelection: boolean,
): string[] {
  if (hasRouteSelection) {
    const routedSentence = sanitizeSelection(sentences, routeSelectedSentences ?? [])[0];
    if (routedSentence) return [routedSentence];
  }

  const rememberedSentence = sanitizeSelection(sentences, getStudySelection(store, fileId) ?? [])[0];
  return rememberedSentence ? [rememberedSentence] : defaultSelection(sentences);
}

function isSavedProgressValid(progress: SavedStudyProgress, allKeys: string[], selectedSentences: Set<string>, mode: StudyMode): boolean {
  const allowedKeys = new Set(allKeys.filter(key => selectedSentences.has(parseTokenKey(key).sentId)));
  const deferredQueue = progress.deferredQueue ?? [];
  const readyDeferredQueue = progress.readyDeferredQueue ?? [];
  if (!Array.isArray(progress.queue)
    || !Array.isArray(deferredQueue)
    || !Array.isArray(readyDeferredQueue)) return false;

  const deferredKeys = new Set(deferredQueue);
  return progress.mode === mode
    && progress.currentIdx >= 0
    && progress.currentIdx <= progress.queue.length
    && progress.queue.every(key => allowedKeys.has(key))
    && deferredQueue.every(key => allowedKeys.has(key) && progress.queue.includes(key))
    && readyDeferredQueue.every(key => allowedKeys.has(key)
      && progress.queue.includes(key)
      && !deferredKeys.has(key));
}

function getFileDisplayTitle(file: { name: string; content: string }, fallbackId?: string) {
  try {
    return parseConllu(file.content, file.name).title || file.name || fallbackId || '';
  } catch {
    return file.name || fallbackId || '';
  }
}

function persistStudySelection(st: StudyState) {
  const selected = orderedSelectedSentences(st.sentences, st.selectedSentences);
  setStudySelection(st.store, st.fileId, selected);
  saveStore(st.store);

  const nextUrl = routeUrl('study', st.fileId, { selectedSentences: selected, studyMode: st.mode });
  if (window.location.hash !== nextUrl) {
    history.replaceState(null, '', nextUrl);
  }
}

function persistStudyProgress(st: StudyState) {
  const deferredQueues = normalizeDeferredQueueLists(
    st.queue,
    st.deferredCards,
    st.readyDeferredCards,
  );
  saveStudyProgress({
    fileId: st.fileId,
    mode: st.mode,
    selectedSentences: orderedSelectedSentences(st.sentences, st.selectedSentences),
    queue: [...st.queue],
    currentIdx: st.currentIdx,
    sessionTotal: st.sessionTotal,
    reviewedCount: st.reviewedCount,
    totalTimeMs: st.totalTimeMs,
    ...deferredQueues,
    updatedAt: Date.now(),
  });
}

function isCramMode(st: StudyState): boolean {
  return st.mode === 'cram';
}

function advancePastFutureCards(st: StudyState): boolean {
  if (isCramMode(st)) return false;

  let advanced = false;
  while (st.currentIdx < st.queue.length) {
    const key = st.queue[st.currentIdx];
    const tokenState = st.session.tokens[key];
    if (tokenState
      && tokenState.nextReview > Date.now()
      && !st.readyDeferredCards.has(key)) {
      st.currentIdx++;
      advanced = true;
      continue;
    }
    break;
  }
  return advanced;
}

function clearDueTimer(st: StudyState) {
  if (st.dueTimer !== null) window.clearTimeout(st.dueTimer);
  st.dueTimer = null;
}

function queueDueDeferredCards(st: StudyState, preserveCurrentCard: boolean): boolean {
  return queueDueDeferredItems(
    st,
    key => st.session.tokens[key]?.nextReview ?? Number.POSITIVE_INFINITY,
    Date.now(),
    preserveCurrentCard,
  );
}

function scheduleDeferredCards(st: StudyState) {
  clearDueTimer(st);
  if (st.deferredCards.size === 0) return;

  const nextReview = Math.min(...[...st.deferredCards]
    .map(key => st.session.tokens[key]?.nextReview ?? Number.POSITIVE_INFINITY));
  if (!Number.isFinite(nextReview)) return;

  st.dueTimer = window.setTimeout(() => {
    st.dueTimer = null;
    if (state !== st) return;

    const hadCurrentCard = st.currentIdx < st.queue.length;
    const queued = queueDueDeferredCards(st, hadCurrentCard);
    scheduleDeferredCards(st);
    persistStudyProgress(st);

    // Do not replace a card while it is visible. Wake an exhausted session as
    // soon as its next minute-based learning/relearning card becomes due.
    if (queued && !hadCurrentCard) render();
  }, Math.max(0, nextReview - Date.now()));
}

// ── Keyboard shortcuts ───────────────────────────────────────────────────
// Space / Enter   — flip card (front ↔ back)
// 1 / A           — Again
// 2 / H           — Hard
// 3 / G           — Good
// 4 / E           — Easy
// S               — toggle sentence selector
// Escape          — back to files / close selector

function onKeydown(e: KeyboardEvent) {
  if (!state) return;

  const selPanel = $('#sentence-selector-overlay') as HTMLElement | null;
  const selOpen = selPanel && !selPanel.classList.contains('hidden');

  if (e.key === 'Escape') {
    e.preventDefault();
    if (selOpen) {
      closeSentenceSelector();
      return;
    }
    leaveStudy('browser');
    return;
  }

  if (selOpen) return;

  // Flip card with space/enter
  const cardEl = $('#study-card') as HTMLElement | null;
  if ((e.key === ' ' || e.key === 'Enter') && cardEl) {
    e.preventDefault();
    cardEl.classList.toggle('flipped');
    return;
  }

  // Arrow Left/Right — move to previous/next sentence
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const st = state;
    if (!st) return;
    const sentences = st.sentences;
    // Find the last selected sentence to determine current position
    const selectedArr = orderedSelectedSentences(sentences, st.selectedSentences);
    const lastSelectedId = selectedArr[selectedArr.length - 1];
    const currentSentIdx = sentences.findIndex(s => s.id === lastSelectedId);
    if (currentSentIdx === -1) return;
    const nextIdx = e.key === 'ArrowRight'
      ? Math.min(currentSentIdx + 1, sentences.length - 1)
      : Math.max(currentSentIdx - 1, 0);
    if (nextIdx !== currentSentIdx) {
      moveStudyToSentence(sentences[nextIdx].id);
    }
    return;
  }

  // Arrow Up/Down — move to previous/next work
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault();
    const st = state;
    if (!st) return;
    const files = listFiles(st.store);
    const currentIdx = files.findIndex(f => f.id === st.fileId);
    if (currentIdx === -1) return;
    const nextIdx = e.key === 'ArrowDown'
      ? Math.min(currentIdx + 1, files.length - 1)
      : Math.max(currentIdx - 1, 0);
    if (nextIdx !== currentIdx) {
      leaveStudy('study', files[nextIdx].id, { studyMode: st.mode });
    }
    return;
  }

  // S key — toggle sentence selector
  if (e.key.toLowerCase() === 's') {
    e.preventDefault();
    toggleSentenceSelector();
    return;
  }

  // Number keys always rate and move to next
  if (state.queue.length > 0) {
    const map: Record<string, number> = { '1': 1, '2': 2, '3': 3, '4': 4, 'a': 1, 'h': 2, 'g': 3, 'e': 4 };
    const q = map[e.key.toLowerCase()];
    if (q !== undefined) {
      e.preventDefault();
      handleRating(q);
    }
  }
}

// ── Mount ─────────────────────────────────────────────────────────────────

export function mount(fileId: string, routeSelectedSentences?: string[], hasRouteSelection = false, mode: StudyMode = 'srs') {
  cleanup();
  if (!fileId) { navigate('browser'); return; }

  const store = loadStore();
  const file = store.files[fileId];
  if (!file) { navigate('browser'); return; }

  const treebank = parseConllu(file.content, file.name);
  const session = ensureFileSession(store, fileId);
  const allKeys = getAllTokenKeys(store, fileId);
  const initialSelection = resolveInitialSelection(
    store,
    fileId,
    treebank.sentences,
    routeSelectedSentences,
    hasRouteSelection,
  );
  const selectedSentenceSet = new Set(initialSelection);
  const savedProgress = loadStudyProgress(fileId, mode, initialSelection);
  const canRestoreProgress = !!savedProgress && isSavedProgressValid(savedProgress, allKeys, selectedSentenceSet, mode);
  if (savedProgress && !canRestoreProgress) clearStudyProgress(fileId, mode, initialSelection);
  const initialQueue = canRestoreProgress
    ? savedProgress.queue
    : buildQueue(allKeys, session, selectedSentenceSet, mode);
  const reconciledQueue = mode === 'srs'
    ? reconcileDeferredQueue({
      queue: initialQueue,
      currentIdx: canRestoreProgress ? savedProgress.currentIdx : 0,
      deferredQueue: canRestoreProgress ? savedProgress.deferredQueue : undefined,
      readyDeferredQueue: canRestoreProgress ? savedProgress.readyDeferredQueue : undefined,
      isLearning: key => !!session.tokens[key] && isInLearningPhase(session.tokens[key]),
      nextReview: key => session.tokens[key]?.nextReview ?? Number.POSITIVE_INFINITY,
      now: Date.now(),
    })
    : {
      queue: [...initialQueue],
      currentIdx: canRestoreProgress ? savedProgress.currentIdx : 0,
      deferredQueue: [],
      readyDeferredQueue: [],
    };

  state = {
    store, fileId, fileName: file.name, workTitle: treebank.title, mode, session,
    sentences: treebank.sentences,
    allKeys, queue: reconciledQueue.queue,
    currentIdx: reconciledQueue.currentIdx,
    sessionTotal: canRestoreProgress ? savedProgress.sessionTotal : reconciledQueue.queue.length,
    reviewedCount: canRestoreProgress ? savedProgress.reviewedCount : 0,
    cardShowTime: Date.now(),
    totalTimeMs: canRestoreProgress ? savedProgress.totalTimeMs : 0,
    selectedSentences: selectedSentenceSet,
    showSentenceSelector: false,
    deferredCards: new Set(reconciledQueue.deferredQueue),
    readyDeferredCards: new Set(reconciledQueue.readyDeferredQueue),
    dueTimer: null,
  };

  if (advancePastFutureCards(state)) persistStudyProgress(state);
  scheduleDeferredCards(state);
  persistStudySelection(state);
  persistStudyProgress(state);
  updateNav(state);
  render();

  setupReviewCardMorphTooltips(document.getElementById('page'));

  window.removeEventListener('keydown', onKeydown);
  window.addEventListener('keydown', onKeydown);
}

function buildQueue(
  allKeys: string[],
  session: FileSession,
  selectedSentences: Set<string>,
  mode: StudyMode,
): string[] {
  const now = Date.now();
  const due: string[] = [];
  const future: string[] = [];

  for (const key of allKeys) {
    const { sentId } = parseTokenKey(key);

    // Skip sentences not in selection
    if (!selectedSentences.has(sentId)) continue;

    const ss = session.tokens[key];
    if (mode === 'cram' || !ss || ss.nextReview <= now) {
      due.push(key);
    } else {
      future.push(key);
    }
  }

  shuffle(due);

  if (mode === 'cram') {
    return due;
  }

  // Include future cards in the queue so an in-progress session can still be
  // resumed without rebuilding, but they will be skipped on render.
  shuffle(future);
  return [...due, ...future];
}

function restartStudyWithSelection(selectedSentences: Set<string>) {
  if (!state) return;
  const st = state;
  const nextSelection = new Set(selectedSentences);
  const previousSelection = orderedSelectedSentences(st.sentences, st.selectedSentences);
  const newQueue = buildQueue(st.allKeys, st.session, nextSelection, st.mode);
  const reconciledQueue = isCramMode(st)
    ? {
      queue: newQueue,
      currentIdx: 0,
      deferredQueue: [],
      readyDeferredQueue: [],
    }
    : reconcileDeferredQueue({
      queue: newQueue,
      currentIdx: 0,
      isLearning: key => !!st.session.tokens[key]
        && isInLearningPhase(st.session.tokens[key]),
      nextReview: key => st.session.tokens[key]?.nextReview ?? Number.POSITIVE_INFINITY,
      now: Date.now(),
    });

  clearDueTimer(st);
  st.selectedSentences = nextSelection;
  st.queue = reconciledQueue.queue;
  st.sessionTotal = reconciledQueue.queue.length;
  st.currentIdx = reconciledQueue.currentIdx;
  st.deferredCards = new Set(reconciledQueue.deferredQueue);
  st.readyDeferredCards = new Set(reconciledQueue.readyDeferredQueue);
  st.reviewedCount = 0;
  st.totalTimeMs = 0;
  st.showSentenceSelector = false;

  if (!isSameSelection(previousSelection, orderedSelectedSentences(st.sentences, nextSelection))) {
    clearStudyProgress(st.fileId, st.mode, previousSelection);
  }

  advancePastFutureCards(st);
  scheduleDeferredCards(st);
  persistStudySelection(st);
  persistStudyProgress(st);
  updateNav(st);
  render();
}

function moveStudyToSentence(sentenceId: string) {
  if (!state) return;
  // Reset nextReview for cards in the target sentence so they appear fresh,
  // not skipped as "future" cards (same logic as "Review Again" button)
  if (!isCramMode(state)) {
    const targetKeys = state.allKeys.filter(key => parseTokenKey(key).sentId === sentenceId);
    for (const key of targetKeys) {
      if (state.session.tokens[key]) {
        state.session.tokens[key].nextReview = 0;
      }
    }
    state.store.sessions[state.fileId] = state.session;
    saveStore(state.store);
  }
  restartStudyWithSelection(new Set([sentenceId]));
}

function getNextSentence(sentences: Sentence[], selectedSentences: Set<string>): Sentence | null {
  if (sentences.length === 0) return null;

  let lastSelectedIdx = -1;
  sentences.forEach((sent, idx) => {
    if (selectedSentences.has(sent.id)) lastSelectedIdx = idx;
  });

  return sentences[lastSelectedIdx + 1] ?? null;
}

function getNextWork(store: AppStore, fileId: string) {
  const files = listFiles(store);
  const currentIdx = files.findIndex(file => file.id === fileId);
  if (currentIdx === -1) return null;
  const nextFile = files[currentIdx + 1];
  if (!nextFile) return null;
  return {
    ...nextFile,
    displayTitle: getFileDisplayTitle(nextFile, nextFile.id),
  };
}

export function cleanup() {
  closeSentenceSelector(false);
  cleanupReviewCardMorphTooltips(document.getElementById('page'));
  window.removeEventListener('keydown', onKeydown);
  if (state) clearDueTimer(state);
  state = null;
}

function leaveStudy(page: 'browser' | 'study', fileId?: string, options?: Parameters<typeof navigate>[2]) {
  cleanup();
  navigate(page, fileId, options);
}

// ── Render ────────────────────────────────────────────────────────────────

function render() {
  const page = document.getElementById('page')!;
  hideMorphTooltip();
  if (!state) { page.innerHTML = ''; return; }

  const st = state; // narrow for TS
  if (advancePastFutureCards(st)) persistStudyProgress(st);

  const { fileId, fileName, workTitle, mode, session, sentences, queue, store, sessionTotal, reviewedCount } = st;
  const file = store.files[fileId];
  const displayTitle = workTitle || fileName;
  const showFileName = !!workTitle && workTitle !== fileName;
  const sessionLabel = mode === 'cram' ? '🔥 Cram Study' : '📝 Spaced Repetition';
  const reviewedLabel = mode === 'cram' ? 'studied' : 'reviewed';

  // Hide the tree app
  const app = document.getElementById('app') as HTMLElement;
  if (app) app.style.display = 'none';

  const pct = sessionTotal > 0
    ? Math.min(100, Math.round((reviewedCount / sessionTotal) * 100)) : 0;

  const selectedSentenceId = orderedSelectedSentences(sentences, st.selectedSentences)[0];
  const selectedSentenceIndex = sentences.findIndex(sentence => sentence.id === selectedSentenceId);
  const sentencePosition = selectedSentenceIndex >= 0 ? ` (${selectedSentenceIndex + 1}/${sentences.length})` : '';

  page.innerHTML = '';

  const container = createEl('div');
  container.className = 'study-container';

  // Header
  const header = createEl('div');
  header.className = 'study-header';
  header.innerHTML = `
    <h2>${sessionLabel}</h2>
    <div class="study-header-row">
      <div class="study-header-copy">
        <div class="study-file-name">${escapeHTML(displayTitle)}</div>
        ${showFileName ? `<div class="study-file-meta">${escapeHTML(fileName)}</div>` : ''}
      </div>
      <button class="study-sel-btn" id="btn-sentence-selector" title="Choose sentence">
        📝 Sentence${sentencePosition}
      </button>
    </div>
  `;
  container.appendChild(header);

  // ── Progress: session-based (reviewed / total in session) ──
  const progress = createEl('div');
  progress.className = 'study-progress';
  const remainingKeys = new Set(queue.slice(st.currentIdx));
  for (const key of st.deferredCards) remainingKeys.add(key);
  const activeRemaining = remainingKeys.size;

  progress.innerHTML = `
    <div class="study-progress-bar"><div class="study-progress-fill" style="width:${pct}%"></div></div>
    <div class="study-progress-label">
      <span>${reviewedCount} ${reviewedLabel} / ${sessionTotal} total</span>
      <span class="study-due-count">${activeRemaining} remaining</span>
    </div>
  `;
  container.appendChild(progress);

  // ── Queue empty? ──
  if (state.currentIdx >= queue.length) {
    const doneEl = createEl('div');
    doneEl.className = 'study-done';
    const mastered = Object.values(session.tokens).filter(t => t.interval >= MASTERED_INTERVAL_DAYS).length;
    const waitingForLearningCard = !isCramMode(st) && st.deferredCards.size > 0;
    const nextSentence = waitingForLearningCard ? null : getNextSentence(sentences, st.selectedSentences);
    const nextWork = nextSentence || waitingForLearningCard ? null : getNextWork(store, fileId);
    const nextActionHTML = nextSentence
      ? `
        <div class="study-done-next-step">
          <div class="study-done-next-label">Continue studying?</div>
          <div class="study-done-next-title">Move on to the next sentence</div>
          <div class="study-done-next-detail">Study ${escapeHTML(nextSentence.id)} next</div>
          <div class="study-done-next-copy">Keep going with the next sentence when you're ready, or use the sentence selector to choose a different set from this work.</div>
          <button class="study-done-btn study-done-primary" id="btn-next-sentence">→ ${mode === 'cram' ? 'Cram' : 'Study'} Next Sentence</button>
        </div>`
      : nextWork
        ? `
        <div class="study-done-next-step">
          <div class="study-done-next-label">Continue studying?</div>
          <div class="study-done-next-title">Move on to the next work</div>
          <div class="study-done-next-detail">${escapeHTML(nextWork.displayTitle)}</div>
          <div class="study-done-next-copy">You've finished every sentence in this work. Continue into the next work when you're ready.</div>
          <button class="study-done-btn study-done-primary" id="btn-next-work">→ ${mode === 'cram' ? 'Cram' : 'Study'} Next Work</button>
        </div>`
        : '';

    doneEl.innerHTML = `
      <div class="done-icon">${waitingForLearningCard ? '⏳' : '🎉'}</div>
      <h2>${waitingForLearningCard ? 'Waiting for the next learning card' : 'Session Complete!'}</h2>
      <p>${waitingForLearningCard
        ? 'This session will resume automatically when the card is due.'
        : `${mode === 'cram' ? 'Studied' : 'Reviewed'} ${reviewedCount} of ${sessionTotal} cards this session.`}</p>
      <p style="color:var(--text-muted);font-size:13px;">${mastered} words mastered across all spaced-repetition sessions.</p>
      ${mode === 'cram' ? '<p style="color:var(--text-muted);font-size:13px;">Cram sessions do not change your review schedule.</p>' : ''}
      ${nextActionHTML}
      <div class="study-done-actions">
        ${waitingForLearningCard ? '' : `<button class="study-done-btn" id="btn-review-again">${mode === 'cram' ? 'Cram Again' : 'Review Again'}</button>`}
        <button class="study-done-btn study-done-secondary" id="btn-back-browser">← Back to Files</button>
      </div>
    `;
    container.appendChild(doneEl);
    page.appendChild(container);

    $('#btn-back-browser')!.addEventListener('click', () => leaveStudy('browser'));
    $('#btn-review-again')?.addEventListener('click', () => {
      if (!st) return;
      const reviewKeys = st.allKeys.filter(key => st.selectedSentences.has(parseTokenKey(key).sentId));
      if (!isCramMode(st)) {
        // Reset selected cards to due-now so the skip-loop won't bypass them
        for (const key of reviewKeys) {
          if (st.session.tokens[key]) {
            st.session.tokens[key].nextReview = 0;
          }
        }
        st.store.sessions[st.fileId] = st.session;
        saveStore(st.store);
      }
      clearDueTimer(st);
      st.deferredCards.clear();
      st.readyDeferredCards.clear();
      st.sessionTotal = reviewKeys.length;
      st.queue = [...reviewKeys];
      shuffle(st.queue);
      st.currentIdx = 0;
      st.reviewedCount = 0;
      st.totalTimeMs = 0;
      persistStudySelection(st);
      persistStudyProgress(st);
      updateNav(st);
      render();
    });
    $('#btn-next-sentence')?.addEventListener('click', () => {
      if (!nextSentence) return;
      moveStudyToSentence(nextSentence.id);
    });
    $('#btn-next-work')?.addEventListener('click', () => {
      if (!nextWork) return;
      leaveStudy('study', nextWork.id, { studyMode: st.mode });
    });
    $('#btn-sentence-selector')!.addEventListener('click', () => toggleSentenceSelector());
    return;
  }

  // ── Current card ──
  const cardKey = queue[st.currentIdx];
  const { sentId, tokenId } = parseTokenKey(cardKey);
  const sentence = sentences.find(s => s.id === sentId)!;
  const token = sentence.tokens.find(t => t.id === tokenId)!;

  container.appendChild(createReviewCard(token, sentence));
  container.appendChild(createRatings(container, queue[st.currentIdx]));

  // Back button
  const backBtn = createEl('button');
  backBtn.className = 'browser-btn';
  backBtn.style.cssText = 'margin-top: 20px; font-size: 12px;';
  backBtn.textContent = '← Back to Files';
  backBtn.addEventListener('click', () => leaveStudy('browser'));
  container.appendChild(backBtn);

  page.appendChild(container);

  // Card flip
  const cardEl = $('#study-card') as HTMLElement;
  cardEl.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.study-rating-btn')) return;
    cardEl.classList.toggle('flipped');
  });

  // Rating handlers
  for (const r of RATINGS) {
    const btn = $(`#rating-${r.label.toLowerCase()}`) as HTMLElement;
    if (btn) {
      btn.addEventListener('click', () => handleRating(r.quality));
    }
  }

  // Sentence selector button
  $('#btn-sentence-selector')!.addEventListener('click', () => toggleSentenceSelector());

  if (state.showSentenceSelector) {
    renderSentenceSelector(sentences);
  }

  // Update card show time after render
  state.cardShowTime = Date.now();
}

function createEl(tag: string, cls?: string) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

export function createReviewCard(token: Token, sentence: Sentence) {
  const wrap = createEl('div', 'study-card-wrap');

  const card = createEl('div', 'study-card');
  card.id = 'study-card';

  // Build the Greek sentence with the target token highlighted
  const tokenColor = POS_COLORS[token.upos] || '#565f89';
  const greekSentenceHTML = sentence.tokens.map((t, index) => {
    const form = t.upos === 'PUNCT' && t.form === '?' ? ';' : t.form;
    const rendered = t.id === token.id
      ? `<span class="study-highlighted-token" style="color:${tokenColor}">${escapeHTML(form)}</span>`
      : escapeHTML(form);
    const attachesToPrevious = t.upos === 'PUNCT' && /^[,.;:!?··;)\]»”’]$/u.test(form);
    return `${index > 0 && !attachesToPrevious ? ' ' : ''}${rendered}`;
  }).join('');

  // FRONT
  const front = createEl('div', 'study-card-face study-card-front');
  front.innerHTML = `
    <div class="study-word" style="color:${tokenColor}">${escapeHTML(token.form)}</div>
    <div class="study-sentence-context">
      <div class="study-sentence-label">Context</div>
      <div class="study-greek-sentence">${greekSentenceHTML}</div>
    </div>
    <div class="study-hint">tap to reveal</div>
  `;

  // BACK
  const back = createEl('div', 'study-card-face study-card-back');
  back.id = 'study-card-back';

  const morphHTMLstr = `
    <div class="study-morph-section">
      <div class="study-sentence-label">Morphology</div>
      <div class="study-morph-analysis">
        ${buildMorphAnalysisHTML(token, POS_COLORS[token.upos] || '#565f89')}
      </div>
    </div>`;

  const prose = sentence.translations?.['en']?.prose || '';
  const literal = sentence.translations?.['en']?.literal || '';

  back.innerHTML = `
    ${morphHTMLstr}
    <div class="study-sentence">
      <div class="study-sentence-label">Sentence</div>
      <div class="study-greek-sentence">${greekSentenceHTML}</div>
      <div class="study-sent-id">${escapeHTML(sentence.id)}</div>
      ${prose ? `<div class="study-translation-prose">📖 ${escapeHTML(prose)}</div>` : ''}
      ${literal ? `<div class="study-translation-literal">🔤 ${escapeHTML(literal)}</div>` : ''}
    </div>
  `;

  card.appendChild(front);
  card.appendChild(back);
  wrap.appendChild(card);
  return wrap;
}

function createRatings(container: Element, cardKey: string) {
  const wrap = document.createElement('div');
  wrap.className = 'study-ratings-wrap';

  const btns = document.createElement('div');
  btns.className = 'study-ratings';
  const srsState = state!.session.tokens[cardKey] || newSRSState();
  const cramIntervals: Record<number, string> = {
    1: 'repeat',
    2: 'tough',
    3: 'done',
    4: 'easy',
  };

  for (const r of RATINGS) {
    const keyLabel = r.label === 'Again' ? '1' : r.label === 'Hard' ? '2' : r.label === 'Good' ? '3' : '4';
    const interval = state && isCramMode(state)
      ? cramIntervals[r.quality]
      : intervalLabel(srsState, r.quality);
    btns.innerHTML += `
      <button class="study-rating-btn ${r.label.toLowerCase()}" id="rating-${r.label.toLowerCase()}">
        <span class="rating-kbd">${keyLabel}</span>
        <span class="rating-label">${r.label}</span>
        <span class="rating-interval">${interval}</span>
      </button>`;
  }

  wrap.appendChild(btns);

  const help = document.createElement('div');
  help.className = 'study-kbd-hint';
  help.innerHTML = state && isCramMode(state)
    ? '<kbd>Space</kbd> flip · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> rate · <kbd>←</kbd><kbd>→</kbd> sentence · <kbd>↑</kbd><kbd>↓</kbd> work · <kbd>S</kbd> select · <kbd>Esc</kbd> back · session only'
    : '<kbd>Space</kbd> flip · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> rate · <kbd>←</kbd><kbd>→</kbd> sentence · <kbd>↑</kbd><kbd>↓</kbd> work · <kbd>S</kbd> select · <kbd>Esc</kbd> back';
  wrap.appendChild(help);

  container.appendChild(wrap);
  return wrap;
}

// ── Sentence selector ────────────────────────────────────────────────────

function closeSentenceSelector(restoreFocus = true) {
  document.getElementById('sentence-selector-overlay')?.remove();
  if (state) state.showSentenceSelector = false;
  const returnFocus = sentenceSelectorReturnFocus;
  sentenceSelectorReturnFocus = null;
  if (restoreFocus) returnFocus?.focus();
}

function toggleSentenceSelector() {
  if (!state) return;
  if (state.showSentenceSelector) {
    closeSentenceSelector();
    return;
  }
  sentenceSelectorReturnFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  state.showSentenceSelector = true;
  renderSentenceSelector(state.sentences);
}

function renderSentenceSelector(sentences: Sentence[]) {
  if (!state) return;
  document.getElementById('sentence-selector-overlay')?.remove();

  let draftSentenceId = orderedSelectedSentences(sentences, state.selectedSentences)[0]
    ?? sentences[0]?.id
    ?? null;

  const overlay = document.createElement('div');
  overlay.id = 'sentence-selector-overlay';

  const panel = document.createElement('div');
  panel.className = 'sentence-selector-card';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'sentence-selector-title');

  const header = document.createElement('div');
  header.className = 'sentence-selector-header';
  header.innerHTML = `
    <div>
      <h3 id="sentence-selector-title">Choose a Sentence to Study</h3>
      <p class="sentence-selector-hint">Your choice and card position are remembered when you leave and return.</p>
    </div>
    <button id="sentence-selector-close" aria-label="Close sentence selector">&times;</button>
  `;
  panel.appendChild(header);

  const list = document.createElement('div');
  list.className = 'sentence-selector-list';

  sentences.forEach((sent, index) => {
    const item = document.createElement('label');
    const isSelected = sent.id === draftSentenceId;
    item.className = `sentence-selector-item${isSelected ? ' selected' : ''}`;

    const preview = sent.text || sent.tokens.map(t => t.form).join(' ');
    const truncated = preview.length > 80 ? preview.slice(0, 80) + '…' : preview;

    item.innerHTML = `
      <input class="sentence-radio" type="radio" name="study-sentence" value="${index}"${isSelected ? ' checked' : ''}>
      <span class="sentence-id">${escapeHTML(sent.id)}</span>
      <span class="sentence-preview">${escapeHTML(truncated)}</span>
    `;

    item.querySelector<HTMLInputElement>('.sentence-radio')?.addEventListener('change', () => {
      draftSentenceId = sent.id;
      list.querySelectorAll('.sentence-selector-item').forEach(row => row.classList.remove('selected'));
      item.classList.add('selected');
    });
    list.appendChild(item);
  });

  panel.appendChild(list);

  const footer = document.createElement('div');
  footer.className = 'sentence-selector-footer';
  footer.innerHTML = `<button id="sel-confirm" class="sel-confirm-btn"${draftSentenceId ? '' : ' disabled'}>Study Sentence</button>`;
  panel.appendChild(footer);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  document.getElementById('sentence-selector-close')?.addEventListener('click', () => closeSentenceSelector());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeSentenceSelector();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  document.getElementById('sel-confirm')?.addEventListener('click', () => {
    if (!state || !draftSentenceId) return;
    const currentSentenceId = orderedSelectedSentences(state.sentences, state.selectedSentences)[0];
    closeSentenceSelector(false);
    if (draftSentenceId !== currentSentenceId) {
      restartStudyWithSelection(new Set([draftSentenceId]));
    }
  });

  const initialFocus = panel.querySelector<HTMLElement>('.sentence-radio:checked')
    ?? document.getElementById('sentence-selector-close');
  initialFocus?.focus();
}

// ── Handle rating ─────────────────────────────────────────────────────────

function handleRating(quality: number) {
  if (!state || state.currentIdx >= state.queue.length) return;

  const { store, fileId, session, queue, currentIdx } = state;
  const key = queue[currentIdx];
  const cardEl = $('#study-card') as HTMLElement;
  if (cardEl) cardEl.classList.remove('flipped');

  // Record time on this card
  const timeMs = Date.now() - state.cardShowTime;
  state.totalTimeMs += Math.max(0, timeMs);

  let nextIntervalMinutes: number | null = null;
  if (!isCramMode(state)) {
    if (!session.tokens[key]) session.tokens[key] = newSRSState();

    const srsState = session.tokens[key];
    nextIntervalMinutes = previewInterval(srsState, quality);
    srsReview(srsState, quality);

    session.lastReview = Date.now();
    store.sessions[fileId] = session;
    saveStore(store);
    state.readyDeferredCards.delete(key);
  }

  // ── Queue management (Anki-style for session) ──
  // Cram retains its original Again/non-Again behavior and never schedules.
  if (isCramMode(state) ? quality === 1 : nextIntervalMinutes === 0) {
    state.queue.splice(currentIdx, 1);
    const targetIdx = Math.min(currentIdx + AGAIN_REINSERT_DISTANCE, state.queue.length);
    state.queue.splice(targetIdx, 0, key);
  } else {
    state.currentIdx++;
    if (nextIntervalMinutes !== null
      && nextIntervalMinutes > 0
      && nextIntervalMinutes < INTRADAY_INTERVAL_MINUTES) {
      state.deferredCards.add(key);
    } else {
      state.reviewedCount++;
    }
  }

  queueDueDeferredCards(state, false);
  advancePastFutureCards(state);
  scheduleDeferredCards(state);
  persistStudyProgress(state);
  updateNav(state);
  render();
}

// ── Nav update ────────────────────────────────────────────────────────────

function updateNav(st: StudyState) {
  const titleEl = document.getElementById('nav-title');
  const studyLink = document.getElementById('nav-study') as HTMLAnchorElement;
  if (titleEl) titleEl.textContent = st.workTitle || st.fileName || st.fileId;
  if (studyLink) {
    studyLink.style.display = '';
    studyLink.href = routeUrl('study', st.fileId, {
      selectedSentences: orderedSelectedSentences(st.sentences, st.selectedSentences),
      studyMode: st.mode,
    });
  }
}
