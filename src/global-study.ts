/** Global spaced-repetition queue built from cards encountered in every work. */

import { parseConllu, Sentence, Token } from './types';
import {
  AppStore, SRSState, loadStore, saveStore, parseTokenKey, resetFileStudyHistory,
} from './store';
import { RATINGS, MASTERED_INTERVAL_DAYS, intervalLabel, review as srsReview } from './srs';
import { navigate, routeUrl } from './router';

import './styles/tokens.css';
import './styles/study.css';

const POS_COLORS: Record<string, string> = {
  NOUN: '#e0af68', VERB: '#f7768e', ADJ: '#9ece6a', ADV: '#73daca',
  DET: '#7dcfff', PRON: '#b4f9f8', PROPN: '#ff9e64', ADP: '#bb9af7',
  CCONJ: '#9d7cd8', SCONJ: '#7aa2f7', PART: '#c0caf5', NUM: '#e06c75',
  PUNCT: '#565f89', AUX: '#f7768e', INTJ: '#ff007f', X: '#565f89',
};

const AGAIN_REINSERT_DISTANCE = 3;

interface GlobalCard {
  fileId: string;
  fileName: string;
  workTitle: string;
  key: string;
  sentence: Sentence;
  token: Token;
  srs: SRSState;
}

type GlobalView = 'review' | 'collection' | 'settings';

interface GlobalStudyState {
  store: AppStore;
  allCards: GlobalCard[];
  queue: GlobalCard[];
  currentIdx: number;
  reviewedCount: number;
  cardShowTime: number;
  totalTimeMs: number;
  view: GlobalView;
  collectionQuery: string;
}

let state: GlobalStudyState | null = null;

function escapeHTML(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
  return escapeHTML(value).replace(/"/g, '&quot;');
}

function collectEncounteredCards(store: AppStore): GlobalCard[] {
  const cards: GlobalCard[] = [];

  for (const [fileId, session] of Object.entries(store.sessions)) {
    const trackedKeys = Object.keys(session.tokens);
    const file = store.files[fileId];
    if (!file || trackedKeys.length === 0) continue;

    try {
      const treebank = parseConllu(file.content, file.name);
      const sentences = new Map(treebank.sentences.map(sentence => [sentence.id, sentence]));
      const tokensBySentence = new Map(treebank.sentences.map(sentence => [
        sentence.id,
        new Map(sentence.tokens.map(token => [token.id, token])),
      ]));
      const workTitle = treebank.title || file.name;

      for (const key of trackedKeys) {
        const { sentId, tokenId } = parseTokenKey(key);
        const sentence = sentences.get(sentId);
        const token = tokensBySentence.get(sentId)?.get(tokenId);
        if (!sentence || !token || token.upos === 'PUNCT') continue;
        cards.push({
          fileId,
          fileName: file.name,
          workTitle,
          key,
          sentence,
          token,
          srs: session.tokens[key],
        });
      }
    } catch (error) {
      console.warn(`[global-study] unable to read ${file.name}`, error);
    }
  }

  return cards;
}

function buildDueQueue(cards: GlobalCard[]): GlobalCard[] {
  const now = Date.now();
  return cards
    .filter(card => card.srs.nextReview <= now)
    .sort((a, b) => a.srs.nextReview - b.srs.nextReview);
}

function formatDate(timestamp: number | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) return 'Not recorded';
  return new Date(timestamp).toLocaleString();
}

function isoDate(timestamp: number | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '';
  return new Date(timestamp).toISOString();
}

function totalReviews(srs: SRSState): number {
  return srs.totalReviews ?? srs.reviews;
}

function ratingHistory(srs: SRSState): string {
  const counts = srs.ratingCounts;
  if (!counts || Object.keys(counts).length === 0) return 'Detailed rating history starts with your next review.';
  return `Again ${counts[1] ?? 0} · Hard ${counts[2] ?? 0} · Good ${counts[3] ?? 0} · Easy ${counts[4] ?? 0}`;
}

function sentenceHTML(sentence: Sentence, target: Token): string {
  return sentence.tokens.map((token, index) => {
    const attaches = token.upos === 'PUNCT' && /^[,.;:!?··;)\]»”’]$/u.test(token.form);
    const spacing = index > 0 && !attaches ? ' ' : '';
    const form = escapeHTML(token.form);
    return `${spacing}${token.id === target.id
      ? `<span class="study-highlighted-token">${form}</span>`
      : form}`;
  }).join('');
}

function sourceUrl(card: GlobalCard): string {
  return routeUrl('reader', card.fileId, {
    targetSentence: card.sentence.id,
    targetTokenId: card.token.id,
  });
}

function sourceLabel(card: GlobalCard): string {
  const work = card.workTitle === card.fileName
    ? card.workTitle
    : `${card.workTitle} (${card.fileName})`;
  return `${work} · ${card.sentence.id} · card ${card.token.id}`;
}

function updateNav() {
  const title = document.getElementById('nav-title');
  if (title) title.textContent = 'All encountered vocabulary';
}

export function mount() {
  cleanup();

  const store = loadStore();
  const allCards = collectEncounteredCards(store);
  state = {
    store,
    allCards,
    queue: buildDueQueue(allCards),
    currentIdx: 0,
    reviewedCount: 0,
    cardShowTime: Date.now(),
    totalTimeMs: 0,
    view: 'review',
    collectionQuery: '',
  };

  updateNav();
  render();
  window.addEventListener('keydown', onKeydown);
}

export function cleanup() {
  window.removeEventListener('keydown', onKeydown);
  state = null;
}

function onKeydown(event: KeyboardEvent) {
  if (!state) return;
  const interactive = event.target instanceof Element && !!event.target.closest('a, button, input, select');

  if (event.key === 'Escape') {
    event.preventDefault();
    cleanup();
    navigate('browser');
    return;
  }

  if (state.view !== 'review') return;

  if (!interactive && (event.key === ' ' || event.key === 'Enter')) {
    event.preventDefault();
    document.getElementById('study-card')?.classList.toggle('flipped');
    return;
  }

  if (interactive || state.currentIdx >= state.queue.length) return;
  const quality = ({ '1': 1, a: 1, '2': 2, h: 2, '3': 3, g: 3, '4': 4, e: 4 } as Record<string, number>)[event.key.toLowerCase()];
  if (quality) {
    event.preventDefault();
    handleRating(quality);
  }
}

function currentDueCount(cards: GlobalCard[]): number {
  const now = Date.now();
  return cards.filter(card => card.srs.nextReview <= now).length;
}

function startReviewSeenCards() {
  if (!state) return;
  state.allCards = collectEncounteredCards(state.store);
  state.queue = buildDueQueue(state.allCards);
  state.currentIdx = 0;
  state.reviewedCount = 0;
  state.totalTimeMs = 0;
  state.view = 'review';
  render();
}

function render() {
  const page = document.getElementById('page');
  if (!page || !state) return;

  const st = state;
  const dueNow = currentDueCount(st.allCards);
  const mastered = st.allCards.filter(card => card.srs.interval >= MASTERED_INTERVAL_DAYS).length;
  const remaining = Math.max(0, st.queue.length - st.currentIdx);
  const total = st.reviewedCount + remaining;
  const pct = total > 0 ? Math.round((st.reviewedCount / total) * 100) : 100;

  page.innerHTML = `
    <div class="study-container global-study-container">
      <div class="study-header global-study-header">
        <h2>🌐 Global Spaced Repetition</h2>
        <div class="study-header-row">
          <div class="study-header-copy">
            <div class="study-file-name">All encountered vocabulary</div>
            <div class="study-file-meta">${st.allCards.length} encountered · ${dueNow} due now · ${mastered} mastered</div>
          </div>
        </div>
        <div class="global-study-actions" aria-label="Global review sections">
          <button class="study-sel-btn ${st.view === 'review' ? 'active' : ''}" id="btn-global-review">Review Seen Cards <span class="global-due-badge">${dueNow}</span></button>
          <button class="study-sel-btn ${st.view === 'collection' ? 'active' : ''}" id="btn-global-collection">View Collection</button>
          <button class="study-sel-btn ${st.view === 'settings' ? 'active' : ''}" id="btn-global-settings">⚙ Settings</button>
        </div>
      </div>
      ${st.view === 'review' ? `
        <div class="study-progress">
          <div class="study-progress-bar"><div class="study-progress-fill" style="width:${pct}%"></div></div>
          <div class="study-progress-label">
            <span>${st.reviewedCount} reviewed</span>
            <span class="study-due-count">${remaining} remaining</span>
          </div>
        </div>` : ''}
      <div id="global-study-content"></div>
    </div>`;

  document.getElementById('btn-global-review')?.addEventListener('click', startReviewSeenCards);
  document.getElementById('btn-global-collection')?.addEventListener('click', () => {
    if (!state) return;
    state.view = 'collection';
    render();
  });
  document.getElementById('btn-global-settings')?.addEventListener('click', () => {
    if (!state) return;
    state.view = 'settings';
    render();
  });

  const content = document.getElementById('global-study-content');
  if (!content) return;

  if (st.view === 'collection') {
    content.innerHTML = '<div id="global-collection-panel"></div>';
    renderCollection();
    return;
  }

  if (st.view === 'settings') {
    renderSettings(content);
    return;
  }

  if (st.allCards.length === 0) {
    content.innerHTML = `
      <div class="study-done">
        <div class="done-icon">🌱</div>
        <h2>Your collection starts as you study</h2>
        <p>Rate cards in any work. Every encountered word will appear here when it is due.</p>
        <button class="study-done-btn study-done-secondary" id="btn-back-browser">Browse Works</button>
      </div>`;
    document.getElementById('btn-back-browser')?.addEventListener('click', () => navigate('browser'));
    return;
  }

  if (st.currentIdx >= st.queue.length) {
    const nextReview = st.allCards
      .map(card => card.srs.nextReview)
      .filter(timestamp => timestamp > Date.now())
      .sort((a, b) => a - b)[0];
    content.innerHTML = `
      <div class="study-done">
        <div class="done-icon">🎉</div>
        <h2>Global review complete</h2>
        <p>${st.reviewedCount ? `Reviewed ${st.reviewedCount} cards across your collection.` : 'No cards are due right now.'}</p>
        ${nextReview ? `<p class="global-next-review"><span>Next review</span><time datetime="${isoDate(nextReview)}" title="${isoDate(nextReview)}">${escapeHTML(formatDate(nextReview))}</time></p>` : ''}
        <button class="study-done-btn study-done-secondary" id="btn-back-browser">← Back to Files</button>
      </div>`;
    document.getElementById('btn-back-browser')?.addEventListener('click', () => navigate('browser'));
    return;
  }

  const card = st.queue[st.currentIdx];
  const dueIndicator = document.createElement('div');
  dueIndicator.className = 'global-review-now';
  dueIndicator.innerHTML = `<strong>${dueNow}</strong> ${dueNow === 1 ? 'card needs' : 'cards need'} review now`;
  content.appendChild(dueIndicator);
  content.appendChild(createCard(card));
  content.appendChild(createRatings(card));
  st.cardShowTime = Date.now();
}

function renderCollection() {
  if (!state) return;
  const panel = document.getElementById('global-collection-panel');
  if (!panel) return;

  const query = state.collectionQuery.trim().toLocaleLowerCase();
  const matching = state.allCards
    .filter(card => !query || [card.token.form, card.token.lemma, card.token.gloss || '', card.workTitle, card.sentence.id]
      .some(value => value.toLocaleLowerCase().includes(query)))
    .sort((a, b) => (b.srs.lastReviewed ?? 0) - (a.srs.lastReviewed ?? 0));
  const visible = matching.slice(0, 250);
  const now = Date.now();

  panel.className = 'global-collection-panel';
  panel.innerHTML = `
    <div class="global-collection-heading">
      <div><strong>Encountered words</strong><span>${matching.length}${matching.length !== state.allCards.length ? ` of ${state.allCards.length}` : ''}</span></div>
      <input id="global-collection-search" type="search" value="${escapeAttr(state.collectionQuery)}" placeholder="Search word, lemma, work, or sentence" aria-label="Search collection">
    </div>
    <div class="global-collection-list">
      ${visible.map(card => {
        const due = card.srs.nextReview <= now;
        const source = sourceLabel(card);
        return `<a class="global-collection-row" href="${escapeAttr(sourceUrl(card))}">
          <span class="global-collection-word"><strong>${escapeHTML(card.token.form)}</strong><small>${escapeHTML(card.token.lemma)}</small></span>
          <span class="global-collection-score">${totalReviews(card.srs)} reviews · ${card.srs.lapses} lapses · ${card.srs.interval}d</span>
          <span class="global-collection-due ${due ? 'is-due' : ''}" title="${escapeAttr(isoDate(card.srs.nextReview))}">${due ? 'Due now' : escapeHTML(formatDate(card.srs.nextReview))}</span>
          <span class="global-collection-source">↗ ${escapeHTML(source)}</span>
        </a>`;
      }).join('') || '<div class="global-collection-empty">No matching words.</div>'}
    </div>
    ${matching.length > visible.length ? `<div class="global-collection-limit">Showing the first ${visible.length} matches. Search to narrow the list.</div>` : ''}`;

  const search = document.getElementById('global-collection-search') as HTMLInputElement | null;
  search?.addEventListener('input', () => {
    if (!state) return;
    state.collectionQuery = search.value;
    renderCollection();
    const nextSearch = document.getElementById('global-collection-search') as HTMLInputElement | null;
    nextSearch?.focus();
    nextSearch?.setSelectionRange(state.collectionQuery.length, state.collectionQuery.length);
  });
}

function renderSettings(content: HTMLElement) {
  if (!state) return;

  const works = new Map<string, { title: string; fileName: string; count: number }>();
  for (const card of state.allCards) {
    const existing = works.get(card.fileId);
    if (existing) {
      existing.count++;
    } else {
      works.set(card.fileId, {
        title: card.workTitle,
        fileName: card.fileName,
        count: 1,
      });
    }
  }

  const sortedWorks = [...works.entries()].sort((a, b) => a[1].title.localeCompare(b[1].title));
  content.innerHTML = `
    <section class="global-settings-panel">
      <div class="global-settings-heading">
        <div>
          <h3>Global review settings</h3>
          <p>Reset a work to remove all its cards and SRS history. The source work stays available. Cards will begin collecting again from scratch as you study it.</p>
        </div>
      </div>
      ${sortedWorks.length ? `
        <div class="global-settings-tools">
          <button class="sel-action-btn" id="global-settings-select-all">Select All</button>
          <button class="sel-action-btn" id="global-settings-select-none">Deselect All</button>
        </div>
        <div class="global-settings-list">
          ${sortedWorks.map(([fileId, work]) => `
            <label class="global-settings-work">
              <input type="checkbox" data-reset-file="${escapeAttr(fileId)}">
              <span class="global-settings-work-name">
                <strong>${escapeHTML(work.title)}</strong>
                ${work.title !== work.fileName ? `<small>${escapeHTML(work.fileName)}</small>` : ''}
              </span>
              <span class="global-settings-work-count">${work.count} cards</span>
            </label>`).join('')}
        </div>
        <div class="global-settings-footer">
          <span id="global-settings-selection">No works selected</span>
          <button class="global-reset-btn" id="global-reset-selected" disabled>Reset Selected Works</button>
        </div>`
        : '<div class="global-collection-empty">No works have collected cards yet.</div>'}
    </section>`;

  if (!sortedWorks.length) return;

  const checkboxes = () => [...content.querySelectorAll<HTMLInputElement>('[data-reset-file]')];
  const resetButton = content.querySelector<HTMLButtonElement>('#global-reset-selected');
  const selectionLabel = content.querySelector<HTMLElement>('#global-settings-selection');
  const updateSelection = () => {
    const count = checkboxes().filter(input => input.checked).length;
    if (resetButton) resetButton.disabled = count === 0;
    if (selectionLabel) selectionLabel.textContent = count ? `${count} ${count === 1 ? 'work' : 'works'} selected` : 'No works selected';
  };

  checkboxes().forEach(input => input.addEventListener('change', updateSelection));
  content.querySelector('#global-settings-select-all')?.addEventListener('click', () => {
    checkboxes().forEach(input => { input.checked = true; });
    updateSelection();
  });
  content.querySelector('#global-settings-select-none')?.addEventListener('click', () => {
    checkboxes().forEach(input => { input.checked = false; });
    updateSelection();
  });
  resetButton?.addEventListener('click', () => {
    if (!state) return;
    const fileIds = checkboxes().filter(input => input.checked).map(input => input.dataset.resetFile!);
    if (!fileIds.length) return;

    const noun = fileIds.length === 1 ? 'this work' : `these ${fileIds.length} works`;
    if (!confirm(`Reset ${noun}? This permanently deletes the selected SRS history and removes its cards from Global Review.`)) return;

    for (const fileId of fileIds) resetFileStudyHistory(state.store, fileId);
    saveStore(state.store);
    state.allCards = collectEncounteredCards(state.store);
    state.queue = buildDueQueue(state.allCards);
    state.currentIdx = 0;
    state.reviewedCount = 0;
    state.totalTimeMs = 0;
    render();
  });
}

function createCard(card: GlobalCard): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'study-card-wrap';
  const color = POS_COLORS[card.token.upos] || '#565f89';
  const greekSentence = sentenceHTML(card.sentence, card.token);
  const translation = card.sentence.translations?.en;
  const source = sourceLabel(card);
  const lastReviewed = formatDate(card.srs.lastReviewed);
  const lastReviewedISO = isoDate(card.srs.lastReviewed);

  wrap.innerHTML = `
    <div class="study-card global-study-card" id="study-card">
      <div class="study-card-face study-card-front">
        <a class="global-card-source" href="${escapeAttr(sourceUrl(card))}" title="Open this word in Reader">↗ ${escapeHTML(source)}</a>
        <div class="study-word" style="color:${color}">${escapeHTML(card.token.form)}</div>
        <div class="study-sentence-context">
          <div class="study-sentence-label">Context</div>
          <div class="study-greek-sentence">${greekSentence}</div>
        </div>
        <div class="study-hint">tap to reveal</div>
      </div>
      <div class="study-card-face study-card-back">
        <a class="global-card-source" href="${escapeAttr(sourceUrl(card))}" title="Open this word in Reader">↗ ${escapeHTML(source)}</a>
        <div class="global-answer">
          <div class="global-answer-form" style="color:${color}">${escapeHTML(card.token.form)}</div>
          <div class="global-answer-lemma">${escapeHTML(card.token.lemma)}</div>
          ${card.token.gloss ? `<div class="global-answer-gloss">${escapeHTML(card.token.gloss)}</div>` : ''}
          <div class="global-answer-morph">${escapeHTML([card.token.upos, card.token.xpos].filter(Boolean).join(' · '))}</div>
        </div>
        <div class="study-sentence">
          <div class="study-sentence-label">Source sentence</div>
          <div class="study-greek-sentence">${greekSentence}</div>
          ${translation?.prose ? `<div class="study-translation-prose">📖 ${escapeHTML(translation.prose)}</div>` : ''}
          ${translation?.literal ? `<div class="study-translation-literal">🔤 ${escapeHTML(translation.literal)}</div>` : ''}
        </div>
        <div class="global-card-history">
          <div><strong>${totalReviews(card.srs)}</strong> reviews · <strong>${card.srs.lapses}</strong> lapses · <strong>${card.srs.interval}d</strong> interval</div>
          <div>${escapeHTML(ratingHistory(card.srs))}</div>
          <div>Last reviewed: <time datetime="${lastReviewedISO}" title="${lastReviewedISO}">${escapeHTML(lastReviewed)}</time></div>
        </div>
      </div>
    </div>`;

  const studyCard = wrap.querySelector<HTMLElement>('#study-card');
  studyCard?.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('a')) return;
    studyCard.classList.toggle('flipped');
  });
  return wrap;
}

function createRatings(card: GlobalCard): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'study-ratings-wrap';
  const buttons = document.createElement('div');
  buttons.className = 'study-ratings';

  for (const rating of RATINGS) {
    const button = document.createElement('button');
    button.className = `study-rating-btn ${rating.label.toLowerCase()}`;
    const key = rating.quality;
    button.innerHTML = `
      <span class="rating-kbd">${key}</span>
      <span class="rating-label">${rating.label}</span>
      <span class="rating-interval">${intervalLabel(card.srs, rating.quality)}</span>`;
    button.addEventListener('click', () => handleRating(rating.quality));
    buttons.appendChild(button);
  }

  wrap.appendChild(buttons);
  const hint = document.createElement('div');
  hint.className = 'study-kbd-hint';
  hint.innerHTML = '<kbd>Space</kbd> flip · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> rate · <kbd>Esc</kbd> files';
  wrap.appendChild(hint);
  return wrap;
}

function handleRating(quality: number) {
  if (!state || state.currentIdx >= state.queue.length) return;
  const st = state;
  const card = st.queue[st.currentIdx];
  st.totalTimeMs += Math.max(0, Date.now() - st.cardShowTime);

  srsReview(card.srs, quality);
  st.store.sessions[card.fileId].tokens[card.key] = card.srs;
  st.store.sessions[card.fileId].lastReview = Date.now();
  saveStore(st.store);

  if (quality === 1) {
    st.queue.splice(st.currentIdx, 1);
    const target = Math.min(st.currentIdx + AGAIN_REINSERT_DISTANCE, st.queue.length);
    st.queue.splice(target, 0, card);
  } else {
    st.reviewedCount++;
    st.currentIdx++;
  }

  render();
}
