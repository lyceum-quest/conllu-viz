/**
 * Study page — Anki-style SRS card review session.
 * Mounts into `#page` element.
 *
 * Session model:
 *   - Queue contains all due + new cards at start
 *   - Good/Easy: card is "done" for this session
 *   - Hard: card advances but stays (re-review at current step)
 *   - Again: card is re-inserted a few positions ahead (re-review same session)
 *   - Progress = reviewed / sessionTotal (moves! ✅)
 */

import { parseConllu, Token, Sentence } from './types';
import {
  AppStore, FileSession, loadStore, saveStore, ensureFileSession,
  makeTokenKey, parseTokenKey, getAllTokenKeys,
} from './store';
import {
  newSRSState, review as srsReview, RATINGS, intervalLabel,
  MASTERED_INTERVAL_DAYS,
} from './srs';
import { parseMorphFeatures } from './morpho';
import { segmentGreekWord } from './segment';
import { navigate, routeUrl } from './router';

import './styles/tokens.css';
import './styles/study.css';

// ── Constants ─────────────────────────────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  NOUN: '#e0af68', VERB: '#f7768e', ADJ: '#9ece6a', ADV: '#73daca',
  DET: '#7dcfff', PRON: '#b4f9f8', PROPN: '#ff9e64', ADP: '#bb9af7',
  CCONJ: '#9d7cd8', SCONJ: '#7aa2f7', PART: '#c0caf5', NUM: '#e06c75',
  PUNCT: '#565f89', AUX: '#f7768e', INTJ: '#ff007f', X: '#565f89',
};

const POS_LABELS: Record<string, string> = {
  NOUN: 'noun', VERB: 'verb', ADJ: 'adjective', ADV: 'adverb',
  DET: 'determiner', PRON: 'pronoun', PROPN: 'proper noun',
  ADP: 'preposition', CCONJ: 'coordinating conjunction',
  SCONJ: 'subordinating conjunction', PART: 'particle',
  NUM: 'numeral', PUNCT: 'punctuation', AUX: 'auxiliary',
  INTJ: 'interjection', X: 'other',
};

/** How many cards ahead to re-insert "Again" cards (Anki default: 3) */
const AGAIN_REINSERT_DISTANCE = 3;

// ── State ─────────────────────────────────────────────────────────────────

interface StudyState {
  store: AppStore;
  fileId: string;
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
}

let state: StudyState | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────

function $(sel: string) { return document.querySelector(sel); }

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shuffle(arr: string[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
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
    if (selOpen && selPanel) {
      selPanel.classList.add('hidden');
      state.showSentenceSelector = false;
      return;
    }
    window.removeEventListener('keydown', onKeydown);
    state = null;
    navigate('browser');
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

export function mount(fileId: string, selectedSentences?: Set<string>) {
  if (!fileId) { navigate('browser'); return; }

  const store = loadStore();
  const file = store.files[fileId];
  if (!file) { navigate('browser'); return; }

  const treebank = parseConllu(file.content, file.name);
  const session = ensureFileSession(store, fileId);
  const allKeys = getAllTokenKeys(store, fileId);
  const queue = buildQueue(allKeys, session, treebank.sentences, selectedSentences ?? new Set());

  state = {
    store, fileId, session,
    sentences: treebank.sentences,
    allKeys, queue, currentIdx: 0,
    sessionTotal: queue.length,
    reviewedCount: 0,
    cardShowTime: Date.now(),
    totalTimeMs: 0,
    selectedSentences: selectedSentences ?? new Set(),
    showSentenceSelector: false,
  };

  updateNav(state);
  render();
  window.addEventListener('keydown', onKeydown);
}

function buildQueue(allKeys: string[], session: FileSession, sentences: Sentence[], selectedSentences: Set<string>): string[] {
  const now = Date.now();
  const due: string[] = [];
  const neu: string[] = [];

  const hasSelection = selectedSentences.size > 0;

  for (const key of allKeys) {
    const { sentId } = parseTokenKey(key);

    // Skip sentences not in selection
    if (hasSelection && !selectedSentences.has(sentId)) continue;

    const ss = session.tokens[key];
    if (!ss || ss.nextReview <= now) {
      due.push(key);
    } else {
      neu.push(key);
    }
  }

  // Only show cards that are new or already due; the rest are "future reviews"
  // that the user will see in future sessions.
  shuffle(due);
  // No shuffling of neu so new cards appear in reading order as an option
  // but they are appended after due cards.
  shuffle(neu);
  // Include ALL cards in the session queue; future-due cards will be skipped
  // by the "nextReview" check on rendering.
  return [...due, ...neu];
}

// ── Render ────────────────────────────────────────────────────────────────

function render() {
  const page = document.getElementById('page')!;
  if (!state) { page.innerHTML = ''; return; }

  const st = state; // narrow for TS
  const { fileId, session, sentences, queue, currentIdx, store, sessionTotal, reviewedCount } = st;
  const file = store.files[fileId];

  // Hide the tree app
  const app = document.getElementById('app') as HTMLElement;
  if (app) app.style.display = 'none';

  const displayKeys = st.allKeys.filter(k => {
    if (st.selectedSentences.size > 0) {
      const { sentId } = parseTokenKey(k);
      return st.selectedSentences.has(sentId);
    }
    return true;
  });

  const pct = sessionTotal > 0
    ? Math.min(100, Math.round((reviewedCount / sessionTotal) * 100)) : 0;

  const hasSelection = st.selectedSentences.size > 0;
  const selCount = hasSelection ? ` (${st.selectedSentences.size}/${sentences.length})` : '';

  page.innerHTML = '';

  const container = createEl('div');
  container.className = 'study-container';

  // Header
  const header = createEl('div');
  header.className = 'study-header';
  header.innerHTML = `
    <h2>📝 Spaced Repetition</h2>
    <div class="study-header-row">
      <div class="study-file-name">${escapeHTML(file.name)}</div>
      <button class="study-sel-btn" id="btn-sentence-selector" title="Select sentences">
        📝 Sentences${selCount}
      </button>
    </div>
  `;
  container.appendChild(header);

  // ── Progress: session-based (reviewed / total in session) ──
  const progress = createEl('div');
  progress.className = 'study-progress';
  const queueRemaining = queue.length - currentIdx;

  progress.innerHTML = `
    <div class="study-progress-bar"><div class="study-progress-fill" style="width:${pct}%"></div></div>
    <div class="study-progress-label">
      <span>${reviewedCount} reviewed / ${sessionTotal} total</span>
      <span class="study-due-count">${queueRemaining} remaining</span>
    </div>
  `;
  container.appendChild(progress);

  // ── Queue: skip future cards ──
  // Advance past any cards that aren't due yet
  while (state.currentIdx < queue.length) {
    const k = queue[state.currentIdx];
    const ss = session.tokens[k];
    if (ss && ss.nextReview > Date.now()) {
      // Not due yet — skip and move on
      state.currentIdx++;
    } else {
      break;
    }
  }

  // ── Queue empty? ──
  if (state.currentIdx >= queue.length) {
    const doneEl = createEl('div');
    doneEl.className = 'study-done';
    const mastered = Object.values(session.tokens).filter(t => t.interval >= MASTERED_INTERVAL_DAYS).length;
    doneEl.innerHTML = `
      <div class="done-icon">🎉</div>
      <h2>Session Complete!</h2>
      <p>Reviewed ${reviewedCount} of ${sessionTotal} cards this session.</p>
      <p style="color:var(--text-muted);font-size:13px;">${mastered} words mastered across all sessions.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:16px;">
        <button class="study-done-btn" id="btn-review-again">Review Again</button>
        <button class="study-done-btn" id="btn-back-browser" style="background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-default);">← Back to Files</button>
      </div>
    `;
    container.appendChild(doneEl);
    page.appendChild(container);

    $('#btn-back-browser')!.addEventListener('click', () => navigate('browser'));
    $('#btn-review-again')!.addEventListener('click', () => {
      if (!st) return;
      // Reset all cards to due-now so the skip-loop won't bypass them
      for (const key of st.allKeys) {
        if (st.session.tokens[key]) {
          st.session.tokens[key].nextReview = 0;
        }
      }
      st.store.sessions[st.fileId] = st.session;
      saveStore(st.store);
      // Bypass the due-check: include ALL cards for re-review
      st.sessionTotal = st.allKeys.length;
      st.queue = [...st.allKeys];
      shuffle(st.queue);
      st.currentIdx = 0;
      st.reviewedCount = 0;
      updateNav(st);
      render();
    });
    $('#btn-sentence-selector')!.addEventListener('click', () => toggleSentenceSelector());
    return;
  }

  // ── Current card ──
  const cardKey = queue[currentIdx];
  const { sentId, tokenId } = parseTokenKey(cardKey);
  const sentence = sentences.find(s => s.id === sentId)!;
  const token = sentence.tokens.find(t => t.id === tokenId)!;

  container.appendChild(createCardEl(token, sentence));
  container.appendChild(createRatings(container, queue[currentIdx]));

  // Back button
  const backBtn = createEl('button');
  backBtn.className = 'browser-btn';
  backBtn.style.cssText = 'margin-top: 20px; font-size: 12px;';
  backBtn.textContent = '← Back to Files';
  backBtn.addEventListener('click', () => navigate('browser'));
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

function createCardEl(token: Token, sentence: Sentence) {
  const wrap = createEl('div', 'study-card-wrap');

  const card = createEl('div', 'study-card');
  card.id = 'study-card';

  // Build the Greek sentence with the target token highlighted
  const tokenColor = POS_COLORS[token.upos] || '#565f89';
  const greekSentenceHTML = sentence.tokens.map(t => {
    if (t.id === token.id) {
      return `<span class="study-highlighted-token" style="color:${tokenColor}">${escapeHTML(t.form)}</span>`;
    }
    return escapeHTML(t.form);
  }).join(' ');

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

  const segs = segmentGreekWord(token.form, token.feats, token.upos);
  const wordHTML = segs.length > 0
    ? segs.map(s =>
      `<span class="segment" style="color:${s.color}" title="${escapeHTML(s.encodes.join(', ') || 'Stem')}">${escapeHTML(s.text)}</span>`
    ).join('')
    : `<span style="color:${POS_COLORS[token.upos] || '#565f89'}">${escapeHTML(token.form)}</span>`;

  const posLabel = POS_LABELS[token.upos] || token.upos;
  const glossStr = token.gloss ? ` — ${escapeHTML(token.gloss)}` : '';

  const feats = parseMorphFeatures(token.feats, segs);
  const morphHTMLstr = feats.length > 0
    ? `<div class="study-morph-section">
         <div class="study-sentence-label">Morphology</div>
         <div class="study-morph-features">
           ${feats.map(f => `
             <div class="study-morph-feat" style="--feat-color:${f.categoryColor}">
               <span class="study-morph-feat-key" style="color:${f.categoryColor}">${f.key}</span>
               <span class="study-morph-feat-val">${f.value}</span>
               <span class="study-morph-feat-desc">${f.label}</span>
             </div>`).join('')}
         </div>
       </div>`
    : '';

  const prose = sentence.translations?.['en']?.prose || '';
  const literal = sentence.translations?.['en']?.literal || '';

  back.innerHTML = `
    <div class="study-back-header">
      <div class="study-back-word-segmented">${wordHTML}</div>
      <div class="study-back-lemma">${escapeHTML(token.lemma)}${glossStr}</div>
      <div class="study-back-pos" style="color:${POS_COLORS[token.upos] || '#565f89'}">${posLabel}</div>
    </div>
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

  for (const r of RATINGS) {
    const keyLabel = r.label === 'Again' ? '1' : r.label === 'Hard' ? '2' : r.label === 'Good' ? '3' : '4';
    const interval = intervalLabel(srsState, r.quality);
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
  help.innerHTML = '<kbd>Space</kbd> flip · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> rate · <kbd>S</kbd> sentences · <kbd>Esc</kbd> back';
  wrap.appendChild(help);

  container.appendChild(wrap);
  return wrap;
}

// ── Sentence selector ────────────────────────────────────────────────────

function toggleSentenceSelector() {
  if (!state) return;
  state.showSentenceSelector = !state.showSentenceSelector;
  if (state.showSentenceSelector) {
    renderSentenceSelector(state.sentences);
  } else {
    const overlay = $('#sentence-selector-overlay') as HTMLElement | null;
    if (overlay) overlay.remove();
  }
}

function renderSentenceSelector(sentences: Sentence[]) {
  if (!state) return;
  const existing = $('#sentence-selector-overlay') as HTMLElement | null;
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'sentence-selector-overlay';

  const panel = document.createElement('div');
  panel.className = 'sentence-selector-card';

  const header = document.createElement('div');
  header.className = 'sentence-selector-header';
  header.innerHTML = `
    <h3>Select Sentences to Study</h3>
    <button id="sentence-selector-close">&times;</button>
  `;
  panel.appendChild(header);

  const actions = document.createElement('div');
  actions.className = 'sentence-selector-actions';
  actions.innerHTML = `
    <button id="sel-all" class="sel-action-btn">Select All</button>
    <button id="sel-none" class="sel-action-btn">Deselect All</button>
    <button id="sel-invert" class="sel-action-btn">Invert</button>
  `;
  panel.appendChild(actions);

  const list = document.createElement('div');
  list.className = 'sentence-selector-list';

  for (const sent of sentences) {
    const item = document.createElement('div');
    const isSelected = !state!.selectedSentences.size || state!.selectedSentences.has(sent.id);
    item.className = `sentence-selector-item${isSelected ? ' selected' : ''}`;
    item.dataset.sentId = sent.id;

    const preview = sent.text || sent.tokens.map(t => t.form).join(' ');
    const truncated = preview.length > 80 ? preview.slice(0, 80) + '…' : preview;

    item.innerHTML = `
      <span class="sentence-check">${isSelected ? '☑' : '☐'}</span>
      <span class="sentence-id">${escapeHTML(sent.id)}</span>
      <span class="sentence-preview">${escapeHTML(truncated)}</span>
    `;

    item.addEventListener('click', () => {
      if (!state) return;
      const sid = item.dataset.sentId!;
      const currentSel = state.selectedSentences;
      if (currentSel.size === 0) {
        for (const s of state.sentences) currentSel.add(s.id);
        if (item.classList.contains('selected')) {
          currentSel.delete(sid);
          item.classList.remove('selected');
          item.querySelector('.sentence-check')!.textContent = '☐';
        }
      } else {
        if (item.classList.contains('selected')) {
          currentSel.delete(sid);
          item.classList.remove('selected');
          item.querySelector('.sentence-check')!.textContent = '☐';
        } else {
          currentSel.add(sid);
          item.classList.add('selected');
          item.querySelector('.sentence-check')!.textContent = '☑';
        }
      }
    });

    list.appendChild(item);
  }

  panel.appendChild(list);

  const footer = document.createElement('div');
  footer.className = 'sentence-selector-footer';
  footer.innerHTML = `<button id="sel-confirm" class="sel-confirm-btn">Apply & Restart</button>`;
  panel.appendChild(footer);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  $('#sentence-selector-close')!.addEventListener('click', () => toggleSentenceSelector());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) toggleSentenceSelector();
  });

  $('#sel-all')!.addEventListener('click', () => {
    for (const s of sentences) state!.selectedSentences.add(s.id);
    renderSentenceSelector(sentences);
  });

  $('#sel-none')!.addEventListener('click', () => {
    state!.selectedSentences.clear();
    renderSentenceSelector(sentences);
  });

  $('#sel-invert')!.addEventListener('click', () => {
    const allIds = new Set(sentences.map(s => s.id));
    if (state!.selectedSentences.size === 0) {
      state!.selectedSentences.clear();
    } else if (state!.selectedSentences.size === allIds.size) {
      state!.selectedSentences.clear();
    } else {
      const newSel = new Set([...allIds].filter(id => !state!.selectedSentences.has(id)));
      state!.selectedSentences.clear();
      for (const id of newSel) state!.selectedSentences.add(id);
    }
    renderSentenceSelector(sentences);
  });

  $('#sel-confirm')!.addEventListener('click', () => {
    const newQueue = buildQueue(state!.allKeys, state!.session, state!.sentences, state!.selectedSentences);
    state!.queue = newQueue;
    state!.sessionTotal = newQueue.length;
    state!.currentIdx = 0;
    state!.reviewedCount = 0;
    state!.showSentenceSelector = false;
    overlay.remove();
    render();
  });
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

  if (!session.tokens[key]) session.tokens[key] = newSRSState();

  const srsState = session.tokens[key];
  srsReview(srsState, quality);

  session.lastReview = Date.now();
  store.sessions[fileId] = session;
  saveStore(store);

  // ── Queue management (Anki-style for session) ──
  if (quality === 1) {
    // AGAIN — re-insert card ahead in the queue (not done yet)
    // Remove current card from its position
    state.queue.splice(currentIdx, 1);

    // Insert it back at a distance, avoiding the last position
    const targetIdx = Math.min(currentIdx + AGAIN_REINSERT_DISTANCE, state.queue.length);
    state.queue.splice(targetIdx, 0, key);

    // Do NOT increment currentIdx or review count — card stays in session
  } else {
    // HARD / GOOD / EASY — card progresses to next interval
    // Count as reviewed (final rating for this card this session)
    state.reviewedCount++;
    state.currentIdx++;
  }

  render();
}

// ── Nav update ────────────────────────────────────────────────────────────

function updateNav(st: StudyState) {
  const titleEl = document.getElementById('nav-title');
  const studyLink = document.getElementById('nav-study') as HTMLAnchorElement;
  if (titleEl) titleEl.textContent = st.fileId;
  if (studyLink) { studyLink.style.display = ''; studyLink.href = routeUrl('study', st.fileId); }
}
