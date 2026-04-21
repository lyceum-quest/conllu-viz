/**
 * conllu-viz — Entry point & Router hub
 * Wires up hash-based routing between:
 *   #browser  → File browser page
 *   #tree:id  → Dependency tree view (existing)
 *   #study:id → SRS study session
 */

import './styles/tokens.css';
import './styles/layout.css';
import './styles/tree.css';
import './styles/browser.css';
import './styles/study.css';
import './styles/reader.css';

import { parseConllu, collectLegend, Treebank, Sentence, Token } from './types';
import { segmentGreekWord } from './segment';
import { layoutSentence, LayoutResult } from './layout';
import { render, setupPanZoom, exportSVG, setFilter, DEPREL_LABELS } from './renderer';
import { buildMorphAnalysisHTML } from './morpho';
import { mount as mountBrowser } from './browser';
import { mount as mountReader, cleanup as cleanupReader } from './reader';
import { mount as mountStudy } from './study';
import { parseRoute, navigate, routeUrl, PageType } from './router';
import { loadStore, saveStore, addFile } from './store';

// ── DOM refs ───────────────────────────────────────────────────────────────

const svg = document.getElementById('tree-svg') as unknown as SVGSVGElement;
const treeGroup = document.getElementById('tree-group') as unknown as SVGGElement;
const sidebarList = document.getElementById('sentence-list') as HTMLUListElement;
const dropOverlay = document.getElementById('drop-overlay') as HTMLElement;
const fileNameLabel = document.getElementById('file-name') as HTMLElement;
const legendPanel = document.getElementById('legend-panel') as HTMLElement;
const legendPosEl = document.getElementById('legend-pos') as HTMLElement;
const legendDeprelEl = document.getElementById('legend-deprel') as HTMLElement;
const sentenceDisplay = document.getElementById('sentence-display') as HTMLElement;
const btnOpen = document.getElementById('btn-open') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset') as HTMLButtonElement;
const btnLegend = document.getElementById('btn-legend-toggle') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const morphOverlay = document.getElementById('morph-overlay') as HTMLElement;
const morphPanel = document.getElementById('morph-panel') as HTMLElement;
const morphBody = document.getElementById('morph-body') as HTMLElement;
const morphTooltip = document.getElementById('morph-tooltip') as HTMLElement;
const morphClose = document.getElementById('morph-close') as HTMLButtonElement;
const langSelect = document.getElementById('lang-select') as HTMLSelectElement;
const translationPanel = document.getElementById('translation-panel') as HTMLElement;
const translationBody = document.getElementById('translation-body') as HTMLElement;
const translationClose = document.getElementById('translation-close') as HTMLButtonElement;

// ── Color maps ─────────────────────────────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  NOUN: '#e0af68', VERB: '#f7768e', ADJ: '#9ece6a', ADV: '#73daca',
  DET: '#7dcfff', PRON: '#b4f9f8', PROPN: '#ff9e64', ADP: '#bb9af7',
  CCONJ: '#9d7cd8', SCONJ: '#7aa2f7', PART: '#c0caf5', NUM: '#e06c75',
  PUNCT: '#565f89', AUX: '#f7768e', INTJ: '#ff007f', X: '#565f89',
};

const POS_LABELS: Record<string, string> = {
  NOUN: 'noun', VERB: 'verb', ADJ: 'adjective', ADV: 'adverb',
  DET: 'determiner / article', PRON: 'pronoun', PROPN: 'proper noun',
  ADP: 'preposition', CCONJ: 'coordinating conjunction',
  SCONJ: 'subordinating conjunction', PART: 'particle',
  NUM: 'numeral', PUNCT: 'punctuation', AUX: 'auxiliary verb',
  INTJ: 'interjection', X: 'other',
};

const DEP_COLORS: Record<string, string> = {
  'root': '#7aa2f7', 'nsubj': '#f7768e', 'obj': '#9ece6a',
  'obl': '#bb9af7', 'obl:agent': '#bb9af7', 'advcl': '#73daca',
  'acl': '#ff9e64', 'advmod': '#7dcfff', 'det': '#7dcfff',
  'case': '#9d7cd8', 'conj': '#9d7cd8', 'cc': '#c0caf5',
  'mark': '#7aa2f7', 'amod': '#9ece6a', 'nummod': '#e06c75',
  'discourse': '#e0af68', 'xcomp': '#f7768e',
  'ccomp': '#f7768e', 'cop': '#c0caf5', 'aux': '#c0caf5',
  'nmod': '#bb9af7', 'fixed': '#565f89', 'punct': '#565f89',
};

// ── State ─────────────────────────────────────────────────────────────────

let treebank: Treebank | null = null;
let sentenceLayouts: LayoutResult[] = [];
let activeIndex = -1;
let resetView: (() => void) | null = null;
let activeLang = '';
let currentFileId: string | null = null;

// Current page for nav highlighting
let currentPage: PageType = 'browser';

// ── Init pan/zoom ──────────────────────────────────────────────────────────

resetView = setupPanZoom(svg);

// ── Resizable sidebars ─────────────────────────────────────────────────────

const sidebarEl = document.getElementById('sidebar') as HTMLElement;
const legendPanelEl = document.getElementById('legend-panel') as HTMLElement;
const sidebarHandle = document.getElementById('sidebar-handle') as HTMLElement;
const legendHandle = document.getElementById('legend-handle') as HTMLElement;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 500;
const LEGEND_MIN = 160;
const LEGEND_MAX = 450;

function initResizeHandle(
  handle: HTMLElement,
  panel: HTMLElement,
  side: 'left' | 'right',
  min: number,
  max: number,
) {
  let startX = 0;
  let startW = 0;

  function onStart(clientX: number) {
    startX = clientX;
    startW = panel.offsetWidth;
    document.body.classList.add('resizing');
  }

  function onMove(clientX: number) {
    const dx = clientX - startX;
    const newW = side === 'left'
      ? Math.min(max, Math.max(min, startW + dx))
      : Math.min(max, Math.max(min, startW - dx));
    panel.style.width = `${newW}px`;
  }

  function onUp() {
    document.body.classList.remove('resizing');
  }

  // Mouse events
  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onStart(e.clientX);
    const moveH = (e: MouseEvent) => onMove(e.clientX);
    const upH = () => { onUp(); document.removeEventListener('mousemove', moveH); document.removeEventListener('mouseup', upH); };
    document.addEventListener('mousemove', moveH);
    document.addEventListener('mouseup', upH);
  });

  // Touch events
  handle.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    onStart(e.touches[0].clientX);
    const moveH = (e: TouchEvent) => { if (e.touches.length === 1) onMove(e.touches[0].clientX); };
    const upH = () => { onUp(); document.removeEventListener('touchmove', moveH); document.removeEventListener('touchend', upH); };
    document.addEventListener('touchmove', moveH, { passive: true });
    document.addEventListener('touchend', upH);
  }, { passive: true });
}

initResizeHandle(sidebarHandle, sidebarEl, 'left', SIDEBAR_MIN, SIDEBAR_MAX);
initResizeHandle(legendHandle, legendPanelEl, 'right', LEGEND_MIN, LEGEND_MAX);

// ── Mobile sidebar ─────────────────────────────────────────────────────────

const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle') as HTMLButtonElement;
const mobileSidebarBackdrop = document.getElementById('mobile-sidebar-backdrop') as HTMLElement;
const mobileSidebarClose = document.getElementById('mobile-sidebar-close') as HTMLButtonElement;

function isMobile() {
  return window.innerWidth <= 768;
}

function openMobileSidebar() {
  sidebarEl.classList.add('mobile-open');
  mobileSidebarBackdrop.classList.add('visible');
}

function closeMobileSidebar() {
  sidebarEl.classList.remove('mobile-open');
  mobileSidebarBackdrop.classList.remove('visible');
}

mobileSidebarToggle?.addEventListener('click', () => {
  if (sidebarEl.classList.contains('mobile-open')) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
});

mobileSidebarBackdrop?.addEventListener('click', closeMobileSidebar);
mobileSidebarClose?.addEventListener('click', closeMobileSidebar);

// Close mobile sidebar when a sentence is tapped
sidebarList.addEventListener('click', () => {
  if (isMobile()) closeMobileSidebar();
});

// Close on resize to desktop
window.addEventListener('resize', () => {
  if (!isMobile()) closeMobileSidebar();
});

// ── Router ─────────────────────────────────────────────────────────────────

window.addEventListener('hashchange', handleRoute);

function handleRoute() {
  const route = parseRoute();
  const { page, fileId } = route;
  currentPage = page;
  currentFileId = fileId || null;
  updateNavHighlights();

  // Show/hide the tree app
  const app = document.getElementById('app')!;
  const pageEl = document.getElementById('page')!;

  // Clean up previous page state
  if (currentPage !== page && currentPage === 'reader') {
    cleanupReader();
  }

  if (page === 'tree') {
    app.style.display = '';
    pageEl.innerHTML = '';
    if (fileId) loadTreeForFile(fileId);
    else mountBrowserTree(); // no file selected — show existing tree UI
  } else if (page === 'reader') {
    app.style.display = 'none';
    if (fileId) mountReader(fileId);
    else navigate('browser');
  } else if (page === 'study') {
    app.style.display = 'none';
    mountStudy(fileId!, route.selectedSentences, route.hasSelectedSentences, route.studyMode);
  } else {
    app.style.display = 'none';
    mountBrowser();
  }
}

function mountBrowserTree() {
  // Original behavior — show welcome / drop overlay
  fileNameLabel.textContent = '';
  dropOverlay.style.display = '';
  sidebarList.innerHTML = '';
  treeGroup.innerHTML = '';
  sentenceDisplay.innerHTML = '';
  morphOverlay.classList.add('hidden');
  translationPanel.classList.add('hidden');
  legendPanel.classList.add('hidden');
  langSelect.style.display = 'none';
  if (resetView) resetView();
}

function updateNavHighlights() {
  document.querySelectorAll('.nav-link').forEach(a => {
    const dp = a.getAttribute('data-page') as PageType;
    a.classList.toggle('active', dp === currentPage);
  });

  const treeLink = document.getElementById('nav-tree') as HTMLAnchorElement;
  const treeSep = document.getElementById('nav-tree-sep') as HTMLSpanElement;
  const readerLink = document.getElementById('nav-reader') as HTMLAnchorElement;
  const readerSep = document.getElementById('nav-reader-sep') as HTMLSpanElement;
  const studyLink = document.getElementById('nav-study') as HTMLAnchorElement;

  // Default: hide file-specific links
  treeLink.style.display = 'none';
  treeSep.style.display = 'none';
  readerLink.style.display = 'none';
  readerSep.style.display = 'none';
  studyLink.style.display = 'none';

  if (currentFileId) {
    // Show relevant links based on current page
    if (currentPage === 'tree' || currentPage === 'reader' || currentPage === 'study') {
      treeLink.style.display = '';
      treeLink.href = routeUrl('tree', currentFileId);
    }
    if (currentPage === 'tree' || currentPage === 'reader' || currentPage === 'study') {
      readerLink.style.display = '';
      readerLink.href = routeUrl('reader', currentFileId);
    }
    // Show separators between visible links
    treeSep.style.display = treeLink.style.display ? '' : 'none';
    readerSep.style.display = readerLink.style.display ? '' : 'none';
  }

  if (currentPage === 'study' && currentFileId) {
    studyLink.style.display = '';
    studyLink.href = window.location.hash || routeUrl('study', currentFileId);
  }
}

// ── Load tree for a specific file ──────────────────────────────────────────

function loadTreeForFile(fileId: string) {
  const store = loadStore();
  const file = store.files[fileId];
  if (!file) { navigate('browser'); return; }

  currentFileId = fileId;
  const content = file.content;
  loadFile(content, file.name);

  // Update nav
  const titleEl = document.getElementById('nav-title');
  if (titleEl) titleEl.textContent = treebank?.title || file.name;
  updateNavHighlights();
}

// ── File loading (existing logic, adapted) ─────────────────────────────────

function loadFile(content: string, sourceName?: string) {
  treebank = parseConllu(content, sourceName);
  sentenceLayouts = treebank.sentences.map(s => layoutSentence(s));

  if (sentenceLayouts.length === 0) return;

  fileNameLabel.textContent = sourceName || '';
  dropOverlay.style.display = 'none';
  buildLanguageSelector();
  buildSidebar();
  buildLegend();
  showSentence(0);
}

function loadFileFromDisk(file: File) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    if (!content) return;
    const store = loadStore();
    addFile(store, file.name, content, 'upload');
    saveStore(store);
    file.name;
    loadFile(content, file.name);
  };
  reader.readAsText(file);
}

// Open button
btnOpen.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) loadFileFromDisk(file);
  fileInput.value = '';
});

// Drag-and-drop on tree view
let dragCounter = 0;
document.addEventListener('dragenter', (e) => {
  if (currentPage !== 'tree') return;
  e.preventDefault();
  dragCounter++;
  dropOverlay.style.display = 'flex';
});
document.addEventListener('dragleave', (e) => {
  if (currentPage !== 'tree') return;
  e.preventDefault();
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    dropOverlay.style.display = '';
  }
});
document.addEventListener('dragover', (e) => {
  if (currentPage !== 'tree') return;
  e.preventDefault();
});
document.addEventListener('drop', (e) => {
  if (currentPage !== 'tree') return;
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.style.display = '';
  const file = e.dataTransfer?.files[0];
  if (file && file.name.endsWith('.conllu')) loadFileFromDisk(file);
});

// ── Sidebar ────────────────────────────────────────────────────────────────

function onLangSelectChange() {
  activeLang = langSelect.value || '';
  if (activeIndex >= 0) showSentenceTranslations(activeIndex);
}

function buildLanguageSelector() {
  if (!treebank) return;
  langSelect.innerHTML = '';
  const langs = treebank.translationLangs;

  // Remove previous listener to avoid accumulation
  langSelect.removeEventListener('change', onLangSelectChange);

  if (langs.length === 0) {
    langSelect.style.display = 'none';
    return;
  }

  langSelect.style.display = '';

  const optNone = document.createElement('option');
  optNone.value = '';
  optNone.textContent = '🌐 None';
  langSelect.appendChild(optNone);

  for (const lang of langs) {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = lang === 'en' ? '🇬 English' : `🌐 ${lang.toUpperCase()}`;
    langSelect.appendChild(opt);
  }

  langSelect.addEventListener('change', onLangSelectChange);
}

function buildSidebar() {
  sidebarList.innerHTML = '';
  treebank!.sentences.forEach((sent, i) => {
    const li = document.createElement('li');
    const num = document.createElement('div');
    num.className = 'sent-num';
    num.textContent = `#${sent.id}`;
    const preview = document.createElement('div');
    preview.className = 'sent-preview';
    preview.textContent = sent.text || sent.tokens.map(t => t.form).join(' ');
    li.appendChild(num);
    li.appendChild(preview);
    li.addEventListener('click', () => showSentence(i));
    sidebarList.appendChild(li);
  });
}

function showSentence(index: number) {
  if (index < 0 || index >= sentenceLayouts.length) return;
  activeIndex = index;

  sidebarList.querySelectorAll('li').forEach((li, i) => {
    li.classList.toggle('active', i === index);
  });

  buildSentenceDisplay(treebank!.sentences[index]);
  render(sentenceLayouts[index], svg, treeGroup);
  showSentenceTranslations(index);
}

function showSentenceTranslations(index: number) {
  const sent = treebank!.sentences[index];
  const lang = activeLang;

  if (!lang || Object.keys(sent.translations).length === 0) {
    translationPanel.classList.add('hidden');
    return;
  }

  const trans = sent.translations[lang];
  if (!trans) {
    translationPanel.classList.add('hidden');
    return;
  }

  let bodyHTML = '';
  if (trans.prose) {
    bodyHTML += `
      <div class="trans-section">
        <div class="trans-section-label">Prose translation</div>
        <div class="trans-text prose">${trans.prose}</div>
      </div>`;
  }
  if (trans.literal) {
    bodyHTML += `
      <div class="trans-section">
        <div class="trans-section-label">Literal translation</div>
        <div class="trans-text">${trans.literal}</div>
      </div>`;
  }

  translationBody.innerHTML = bodyHTML;
  translationPanel.classList.remove('hidden');
}

function buildSentenceDisplay(sentence: Sentence) {
  sentenceDisplay.innerHTML = '';

  const cardsRow = document.createElement('div');
  cardsRow.className = 'sent-cards';

  for (const t of sentence.tokens) {
    const card = document.createElement('div');
    card.className = 'sent-card';
    card.style.setProperty('--token-color', POS_COLORS[t.upos] || '#565f89');
    card.dataset.upos = t.upos;

    const wordEl = document.createElement('div');
    wordEl.className = 'sent-card-word';
    const segs = segmentGreekWord(t.form, t.feats, t.upos);
    for (const s of segs) {
      const span = document.createElement('span');
      span.className = 'segment';
      span.style.color = s.color;
      span.title = s.encodes.length > 0 ? `${s.type}: ${s.encodes.join(', ')}` : 'Stem';
      span.textContent = s.text;
      wordEl.appendChild(span);
    }
    card.appendChild(wordEl);

    if (t.gloss) {
      const glossEl = document.createElement('div');
      glossEl.className = 'sent-card-gloss';
      glossEl.textContent = t.gloss;
      card.appendChild(glossEl);
    }

    if (!t.gloss) {
      const lemmaEl = document.createElement('div');
      lemmaEl.className = 'sent-card-lemma';
      lemmaEl.textContent = t.lemma;
      card.appendChild(lemmaEl);
    }

    card.addEventListener('click', () => {
      const group = document.getElementById('tree-group');
      if (!group) return;
      const node = group.querySelector(`[data-id="${t.id}"]`);
      if (node) (node as SVGGElement).dispatchEvent(new Event('click'));
    });

    cardsRow.appendChild(card);
  }

  sentenceDisplay.appendChild(cardsRow);

  if (Object.keys(sentence.translations).length > 0) {
    const lang = activeLang || Object.keys(sentence.translations)[0];
    const trans = sentence.translations[lang];
    if (trans) {
      const transRow = document.createElement('div');
      transRow.className = 'sent-translations';

      if (trans.prose) {
        const proseEl = document.createElement('div');
        proseEl.className = 'sent-trans sent-trans-prose';
        proseEl.innerHTML = `<span class="sent-trans-label">Prose:</span> ${trans.prose}`;
        transRow.appendChild(proseEl);
      }
      if (trans.literal) {
        const litEl = document.createElement('div');
        litEl.className = 'sent-trans sent-trans-literal';
        litEl.innerHTML = `<span class="sent-trans-label">Lit.:</span> ${trans.literal}`;
        transRow.appendChild(litEl);
      }
      sentenceDisplay.appendChild(transRow);
    }
  }
}

// --- Morph panel (existing) ---

function positionMorphTooltip(x: number, y: number) {
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

let activeMorphFeature: HTMLElement | null = null;

function hideMorphTooltip() {
  activeMorphFeature = null;
  morphTooltip.classList.remove('visible');
  morphTooltip.setAttribute('aria-hidden', 'true');
  morphTooltip.innerHTML = '';
}

function getMorphFeatureTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest('.morph-feat') as HTMLElement | null;
}

function showMorphPanel(token: Token) {
  morphOverlay.classList.remove('hidden');
  morphBody.innerHTML = buildMorphAnalysisHTML(token, POS_COLORS[token.upos] || '#565f89');
  morphPanel.focus();
}

function hideMorphPanel() {
  hideMorphTooltip();
  morphOverlay.classList.add('hidden');
  morphBody.innerHTML = '';
}

svg.addEventListener('token-focus', (e) => {
  const detail = (e as CustomEvent).detail;
  if (detail?.token) showMorphPanel(detail.token);
});

morphClose.addEventListener('click', hideMorphPanel);
morphOverlay.addEventListener('click', (e) => {
  if (e.target === morphOverlay) hideMorphPanel();
});
morphBody.addEventListener('mouseover', (e) => {
  const feat = getMorphFeatureTarget(e.target);
  if (!feat || feat === activeMorphFeature) return;
  activeMorphFeature = feat;
  showMorphTooltip(feat, e.clientX, e.clientY);
});
morphBody.addEventListener('mousemove', (e) => {
  const feat = getMorphFeatureTarget(e.target);
  if (!feat) return;
  if (feat !== activeMorphFeature) {
    activeMorphFeature = feat;
    showMorphTooltip(feat, e.clientX, e.clientY);
    return;
  }
  positionMorphTooltip(e.clientX, e.clientY);
});
morphBody.addEventListener('mouseout', (e) => {
  const feat = getMorphFeatureTarget(e.target);
  const nextFeat = getMorphFeatureTarget(e.relatedTarget);
  if (!feat || feat !== activeMorphFeature || nextFeat === feat) return;
  if (nextFeat) {
    activeMorphFeature = nextFeat;
    showMorphTooltip(nextFeat);
    return;
  }
  hideMorphTooltip();
});
morphBody.addEventListener('focusin', (e) => {
  const feat = getMorphFeatureTarget(e.target);
  if (!feat) return;
  activeMorphFeature = feat;
  showMorphTooltip(feat);
});
morphBody.addEventListener('focusout', (e) => {
  const feat = getMorphFeatureTarget(e.target);
  const nextFeat = getMorphFeatureTarget(e.relatedTarget);
  if (!feat || nextFeat === feat) return;
  if (nextFeat) {
    activeMorphFeature = nextFeat;
    showMorphTooltip(nextFeat);
    return;
  }
  hideMorphTooltip();
});
morphBody.addEventListener('scroll', hideMorphTooltip);
window.addEventListener('resize', hideMorphTooltip);
translationClose.addEventListener('click', () => { translationPanel.classList.add('hidden'); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (currentPage !== 'tree') return;
    if (resetView) resetView();
    if (!morphOverlay.classList.contains('hidden')) hideMorphPanel();
    if (!translationPanel.classList.contains('hidden')) translationPanel.classList.add('hidden');
  }
});

// Keyboard nav on tree view
document.addEventListener('keydown', (e) => {
  if (currentPage !== 'tree') return;
  if (e.key === 'ArrowLeft' && activeIndex > 0) showSentence(activeIndex - 1);
  if (e.key === 'ArrowRight' && activeIndex < sentenceLayouts.length - 1) showSentence(activeIndex + 1);
});

// ── Legend ─────────────────────────────────────────────────────────────────

function buildLegend() {
  if (!treebank) return;
  const { pos, deprels } = collectLegend(treebank);

  legendPosEl.innerHTML = '';
  for (const code of [...pos].sort()) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const swatch = document.createElement('div');
    swatch.className = 'legend-swatch';
    swatch.style.background = POS_COLORS[code] || '#565f89';
    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = `${code}  ${POS_LABELS[code] || code}`;
    item.appendChild(swatch);
    item.appendChild(label);
    item.addEventListener('click', () => {
      item.classList.toggle('dimmed');
      setFilter('pos', code, item.classList.contains('dimmed'));
    });
    legendPosEl.appendChild(item);
  }

  legendDeprelEl.innerHTML = '';
  for (const code of [...deprels].sort()) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const swatch = document.createElement('div');
    swatch.className = 'legend-swatch';
    swatch.style.background = DEP_COLORS[code] || '#8892b0';
    const label = document.createElement('span');
    label.className = 'legend-label';
    const desc = DEPREL_LABELS[code] || '';
    label.textContent = `${code}${desc ? ` — ${desc}` : ''}`;
    item.appendChild(swatch);
    item.appendChild(label);
    item.addEventListener('click', () => {
      item.classList.toggle('dimmed');
      setFilter('deprel', code, item.classList.contains('dimmed'));
    });
    legendDeprelEl.appendChild(item);
  }
}

// ── Toolbar buttons ────────────────────────────────────────────────────────

btnReset.addEventListener('click', () => { if (resetView) resetView(); });

let legendOpen = false;
btnLegend.addEventListener('click', () => {
  legendOpen = !legendOpen;
  legendPanel.classList.toggle('hidden', !legendOpen);
});

btnExport.addEventListener('click', () => {
  const svgData = exportSVG();
  if (!svgData) return;
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tree-${treebank!.sentences[activeIndex].id}.svg`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Nav link clicks ────────────────────────────────────────────────────────

document.querySelectorAll('.nav-link').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const href = a.getAttribute('href')!;
    if (!href.startsWith('#')) return;
    window.location.hash = href.slice(1);
  });
});

// ── Initial route ──────────────────────────────────────────────────────────

handleRoute();

console.log('🌳 conllu-viz ready');
