/**
 * Reader View — Progressive enhancement reading mode.
 *
 * Displays Greek text as flowing prose. By default only the bare forms
 * are visible. The reader checks checkboxes to progressively add
 * linguistic layers (lemmas, glosses, morphology, translations, etc.).
 * All toggling is CSS-only via a `data-layers` attribute on the container.
 */

import { parseConllu, Token, Sentence, Treebank } from './types';
import { segmentGreekWord } from './segment';
import { buildMorphAnalysisHTML } from './morpho';
import { loadStore } from './store';
import { navigate, routeUrl } from './router';

import './styles/tokens.css';
import './styles/reader.css';

// ── Layer definitions ──────────────────────────────────────────────────

interface LayerDef {
  key: string;
  label: string;
  desc: string;
  group: 'sentence' | 'word' | 'visual';
}

const LAYERS: LayerDef[] = [
  { key: 'translations', label: 'Translations', desc: 'Prose & literal translations per sentence', group: 'sentence' },
  { key: 'sent-ids', label: 'Sentence IDs', desc: 'Show #perry-45-s1 labels', group: 'sentence' },
  { key: 'sent-breaks', label: 'Sentence breaks', desc: 'Visual separators between sentences', group: 'sentence' },
  { key: 'lemmas', label: 'Lemmas', desc: 'Dictionary form under each word', group: 'word' },
  { key: 'glosses', label: 'Glosses', desc: 'English gloss under each word', group: 'word' },
  { key: 'upos', label: 'POS tag', desc: 'Part-of-speech (VERB, NOUN, etc.)', group: 'word' },
  { key: 'xpos', label: 'Morph tag', desc: 'Detailed morph (verb.impf.ind.act.3pl)', group: 'word' },
  { key: 'feats', label: 'Features', desc: 'Key morph features (Imp·Ind·Act·3·Pl)', group: 'word' },
  { key: 'deps', label: 'Dependencies', desc: 'Relation + head word (nsubj ← εἷλκον)', group: 'word' },
  { key: 'pos-color', label: 'POS coloring', desc: 'Color words by part of speech', group: 'visual' },
  { key: 'segments', label: 'Morph segmentation', desc: 'Color-code segments within words', group: 'visual' },
];

const LAYER_GROUPS = [
  { label: 'Sentence', key: 'sentence' as const },
  { label: 'Word', key: 'word' as const },
  { label: 'Visual', key: 'visual' as const },
];

// ── POS colors (same as tree view) ─────────────────────────────────────

const POS_COLORS: Record<string, string> = {
  NOUN: '#e0af68', VERB: '#f7768e', ADJ: '#9ece6a', ADV: '#73daca',
  DET: '#7dcfff', PRON: '#b4f9f8', PROPN: '#ff9e64', ADP: '#bb9af7',
  CCONJ: '#9d7cd8', SCONJ: '#7aa2f7', PART: '#c0caf5', NUM: '#e06c75',
  PUNCT: '#565f89', AUX: '#f7768e', INTJ: '#ff007f', X: '#565f89',
};

// ── Persistence ────────────────────────────────────────────────────────

const LAYER_PREFS_KEY = 'conllu-viz-reader-layers';

function loadLayerPrefs(): Set<string> {
  try {
    const raw = localStorage.getItem(LAYER_PREFS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* corrupt */ }
  return new Set();
}

function saveLayerPrefs(layers: Set<string>) {
  localStorage.setItem(LAYER_PREFS_KEY, JSON.stringify([...layers]));
}

// ── Feature abbreviation ──────────────────────────────────────────────

const FEAT_ABBREV: Record<string, string> = {
  // Tense
  Pres: 'Pres', Aor: 'Aor', Fut: 'Fut', Pqp: 'Pqp',
  // Aspect
  Imp: 'Imp', Perf: 'Perf',
  // Mood (use context-dependent abbreviation — Mood.Imp > Impv)
  Ind: 'Ind', Sub: 'Sub', Inf: 'Inf', Part: 'Ptc',
  // Voice
  Act: 'Act', Mid: 'Mid', Pass: 'Pass',
  // Number
  Sing: 'Sg', Plur: 'Pl', Dual: 'Du',
  // Gender
  Masc: 'M', Fem: 'F', Neut: 'N',
  // Case
  Nom: 'Nom', Acc: 'Acc', Gen: 'Gen', Dat: 'Dat', Voc: 'Voc',
  // Person
  '1': '1', '2': '2', '3': '3',
  // Degree
  Pos: 'Pos', Cmp: 'Cmp', Sup: 'Sup',
  // Definite
  Def: 'Def',
  // PronType
  Art: 'Art', Rel: 'Rel', Dem: 'Dem',
  // Polarity
  Neg: 'Neg',
};

// Priority order for feature display
const FEAT_PRIORITY = [
  'VerbForm', 'Tense', 'Aspect', 'Mood', 'Voice',
  'Person', 'Number', 'Gender', 'Case', 'Degree',
  'Definite', 'Polarity', 'PronType',
];

function abbreviateFeats(feats: Record<string, string> | undefined): string {
  if (!feats || Object.keys(feats).length === 0) return '';
  const sorted = Object.entries(feats)
    .sort((a, b) => {
      const ia = FEAT_PRIORITY.indexOf(a[0]);
      const ib = FEAT_PRIORITY.indexOf(b[0]);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  return sorted.map(([, v]) => FEAT_ABBREV[v] || v).join('·');
}

// ── Helpers ────────────────────────────────────────────────────────────

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── State ──────────────────────────────────────────────────────────────

let activeLayers = loadLayerPrefs();
let treebank: Treebank | null = null;
let fileId = '';
let fileName = '';
let morphTooltipCleanup: (() => void) | null = null;
let morphCloseHandler: (() => void) | null = null;
let morphOverlayHandler: (() => void) | null = null;
let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

// ── Morph tooltip handling ─────────────────────────────────────────────

const morphOverlay = document.getElementById('morph-overlay') as HTMLElement;
const morphPanel = document.getElementById('morph-panel') as HTMLElement;
const morphBody = document.getElementById('morph-body') as HTMLElement;
const morphClose = document.getElementById('morph-close') as HTMLButtonElement;
const morphTooltip = document.getElementById('morph-tooltip') as HTMLElement;

function showMorphPanel(token: Token) {
  if (!morphOverlay || !morphBody) return;
  morphOverlay.classList.remove('hidden');
  morphBody.innerHTML = buildMorphAnalysisHTML(token, POS_COLORS[token.upos] || '#565f89');
  morphPanel.focus();
}

function hideMorphPanel() {
  hideMorphTooltip();
  morphOverlay?.classList.add('hidden');
  if (morphBody) morphBody.innerHTML = '';
}

function hideMorphTooltip() {
  if (!morphTooltip) return;
  morphTooltip.classList.remove('visible');
  morphTooltip.setAttribute('aria-hidden', 'true');
  morphTooltip.innerHTML = '';
}

function setupMorphTooltipListeners() {
  const page = document.getElementById('page');
  if (!page) return;

  const onOver = (e: MouseEvent) => {
    const feat = (e.target as Element).closest('.morph-feat') as HTMLElement | null;
    if (!feat) return;
    const template = feat.querySelector('.morph-feat-tooltip-template') as HTMLTemplateElement | null;
    if (!template || !morphTooltip) return;
    morphTooltip.innerHTML = template.innerHTML;
    morphTooltip.classList.add('visible');
    morphTooltip.setAttribute('aria-hidden', 'false');
    positionTooltip(e.clientX, e.clientY);
  };

  const onMove = (e: MouseEvent) => {
    if (!morphTooltip?.classList.contains('visible')) return;
    positionTooltip(e.clientX, e.clientY);
  };

  const onOut = () => hideMorphTooltip();

  const positionTooltip = (x: number, y: number) => {
    if (!morphTooltip) return;
    const pad = 14;
    let left = x + pad;
    let top = y - 10;
    const r = morphTooltip.getBoundingClientRect();
    if (left + r.width > window.innerWidth - 8) left = x - r.width - pad;
    if (left < 8) left = 8;
    if (top + r.height > window.innerHeight - 8) top = window.innerHeight - r.height - 8;
    if (top < 8) top = 8;
    morphTooltip.style.left = `${left}px`;
    morphTooltip.style.top = `${top}px`;
  };

  page.addEventListener('mouseover', onOver);
  page.addEventListener('mousemove', onMove);
  page.addEventListener('mouseout', onOut);

  morphTooltipCleanup = () => {
    page.removeEventListener('mouseover', onOver);
    page.removeEventListener('mousemove', onMove);
    page.removeEventListener('mouseout', onOut);
  };
}

// ── Build sentence HTML ────────────────────────────────────────────────

function buildSentenceHTML(sent: Sentence): string {
  const sid = escapeHTML(sent.id);
  const words: string[] = [];

  // Build per-sentence token map for dependency display
  const tokenMap = new Map(sent.tokens.map(t => [t.id, t]));

  for (const t of sent.tokens) {
    const color = POS_COLORS[t.upos] || '#565f89';
    const isPunct = t.upos === 'PUNCT';

    // Form with optional segmentation
    let formHTML: string;
    if (isPunct) {
      formHTML = `<span class="reader-form" data-upos="${t.upos}">${escapeHTML(t.form)}</span>`;
    } else {
      // Build segmented form (hidden until segments layer is on)
      const segs = segmentGreekWord(t.form, t.feats, t.upos);
      const segSpans = segs.map(s => {
        const title = s.encodes.length > 0 ? `${s.type}: ${s.encodes.join(', ')}` : 'Stem';
        return `<span class="segment" style="color:${s.color}" title="${escapeHTML(title)}">${escapeHTML(s.text)}</span>`;
      }).join('');
      // Plain form (no segments) — shown by default
      const plainForm = `<span class="reader-form-plain">${escapeHTML(t.form)}</span>`;
      // Segmented form — hidden until segments layer enabled
      const segForm = `<span class="reader-form-segmented" style="display:none">${segSpans}</span>`;

      formHTML = `<span class="reader-form" data-upos="${t.upos}" style="--reader-pos-color:${color}">${plainForm}${segForm}</span>`;
    }

    // Enhancement rows
    const lemmaRow = `<span class="reader-lemma">${escapeHTML(t.lemma)}</span>`;
    const glossRow = t.gloss ? `<span class="reader-gloss">${escapeHTML(t.gloss)}</span>` : '<span class="reader-gloss"></span>';
    const uposRow = `<span class="reader-upos">${escapeHTML(t.upos)}</span>`;
    const xposRow = t.xpos ? `<span class="reader-xpos">${escapeHTML(t.xpos)}</span>` : '';
    const featsRow = `<span class="reader-feats">${escapeHTML(abbreviateFeats(t.feats))}</span>`;

    // Dependency: show relation + head form
    let depText = '';
    if (t.head === 0) {
      depText = 'root';
    } else {
      const head = tokenMap.get(t.head);
      depText = head ? `${t.deprel} ← ${head.form}` : t.deprel;
    }
    const depRow = `<span class="reader-dep">${escapeHTML(depText)}</span>`;

    // Word container with data attributes for click
    const dataAttrs = [
      `data-token-id="${t.id}"`,
      `data-sent-id="${sid}"`,
      `data-upos="${t.upos}"`,
    ].join(' ');

    if (isPunct) {
      words.push(`<span class="reader-word" ${dataAttrs}>${formHTML}</span>`);
    } else {
      words.push(`<span class="reader-word" ${dataAttrs}>${formHTML}${lemmaRow}${glossRow}${uposRow}${xposRow}${featsRow}${depRow}</span>`);
    }
  }

  // Translation block
  let transHTML = '';
  const trans = sent.translations?.['en'];
  if (trans) {
    const prose = trans.prose ? `<div class="reader-translation-prose"><span class="reader-translation-prose-label">Prose</span>${escapeHTML(trans.prose)}</div>` : '';
    const literal = trans.literal ? `<div class="reader-translation-literal"><span class="reader-translation-literal-label">Lit.</span>${escapeHTML(trans.literal)}</div>` : '';
    transHTML = `<div class="reader-translation">${prose}${literal}</div>`;
  }

  return `
    <div class="reader-sentence" data-sent-id="${sid}">
      <div class="reader-sentence-id">${sid}</div>
      <div class="reader-words">${words.join(' ')}</div>
      ${transHTML}
    </div>
    <hr class="reader-sentence-break">
  `;
}

// ── Mount ──────────────────────────────────────────────────────────────

export function mount(id: string) {
  fileId = id;
  const store = loadStore();
  const file = store.files[id];
  if (!file) { navigate('browser'); return; }

  fileName = file.name;
  treebank = parseConllu(file.content, file.name);

  const page = document.getElementById('page')!;
  const app = document.getElementById('app');
  if (app) app.style.display = 'none';
  page.innerHTML = '';

  // Update nav
  const titleEl = document.getElementById('nav-title');
  if (titleEl) titleEl.textContent = treebank.title || fileName;

  const readerLink = document.getElementById('nav-reader') as HTMLAnchorElement;
  if (readerLink) {
    readerLink.style.display = '';
    readerLink.href = routeUrl('reader', fileId);
  }

  // Container
  const container = document.createElement('div');
  container.className = 'reader-container';

  // Sidebar
  const sidebar = buildSidebar();
  container.appendChild(sidebar);

  // Toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'reader-sidebar-toggle';
  toggleBtn.textContent = '⚙';
  toggleBtn.title = 'Toggle layers panel';
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  // Main text area
  const main = document.createElement('div');
  main.className = 'reader-main';

  // Title
  if (treebank.title) {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'reader-title';
    titleDiv.textContent = treebank.title;
    main.appendChild(titleDiv);

    const meta = document.createElement('div');
    meta.className = 'reader-file-meta';
    meta.textContent = `${fileName} · ${treebank.sentences.length} sentences`;
    main.appendChild(meta);
  }

  // Text container with data-layers attribute
  const textDiv = document.createElement('div');
  textDiv.id = 'reader-text';
  textDiv.setAttribute('data-layers', [...activeLayers].join(' '));

  // Render sentences — build all HTML first, then set once
  const sentencesHTML = treebank.sentences.map(sent => buildSentenceHTML(sent)).join('');
  textDiv.innerHTML = sentencesHTML;

  main.appendChild(textDiv);

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'reader-back';
  backBtn.textContent = '← Back to Files';
  backBtn.addEventListener('click', () => {
    cleanup();
    navigate('browser');
  });
  main.appendChild(backBtn);

  container.appendChild(main);
  container.appendChild(toggleBtn);

  page.appendChild(container);

  // Wire word clicks → morph panel
  textDiv.addEventListener('click', (e) => {
    const wordEl = (e.target as Element).closest('.reader-word') as HTMLElement | null;
    if (!wordEl) return;
    const upos = wordEl.dataset.upos;
    if (upos === 'PUNCT') return;

    const sentId = wordEl.dataset.sentId;
    const tokenId = parseInt(wordEl.dataset.tokenId || '0', 10);

    const sent = treebank?.sentences.find(s => s.id === sentId);
    const token = sent?.tokens.find(t => t.id === tokenId);
    if (token) showMorphPanel(token);
  });

  // Wire morph panel close
  if (morphClose) {
    const closeFn = () => hideMorphPanel();
    morphClose.addEventListener('click', closeFn);
    morphCloseHandler = () => morphClose.removeEventListener('click', closeFn);
  }
  if (morphOverlay) {
    const overlayFn = (e: Event) => {
      if (e.target === morphOverlay) hideMorphPanel();
    };
    morphOverlay.addEventListener('click', overlayFn);
    morphOverlayHandler = () => morphOverlay.removeEventListener('click', overlayFn);
  }

  // Keyboard
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (morphOverlay && !morphOverlay.classList.contains('hidden')) {
        hideMorphPanel();
      }
    }
  };
  window.addEventListener('keydown', onKeyDown);
  keydownHandler = onKeyDown;

  // Setup morph tooltip listeners for the morph panel
  setupMorphTooltipListeners();

  // Apply initial layer state
  applyLayers();

  console.log(`📖 Reader view ready — ${treebank.sentences.length} sentences`);
}

// ── Sidebar ────────────────────────────────────────────────────────────

function buildSidebar(): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'reader-sidebar';

  const heading = document.createElement('h2');
  heading.textContent = '📖 Layers';
  sidebar.appendChild(heading);

  for (const group of LAYER_GROUPS) {
    const section = document.createElement('div');
    section.className = 'reader-sidebar-section';

    const label = document.createElement('div');
    label.className = 'reader-sidebar-section-label';
    label.textContent = group.label;
    section.appendChild(label);

    for (const layer of LAYERS.filter(l => l.group === group.key)) {
      const item = document.createElement('label');
      item.className = 'reader-layer-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = activeLayers.has(layer.key);
      cb.dataset.layer = layer.key;

      const span = document.createElement('span');
      span.className = 'reader-layer-label';
      span.textContent = layer.label;

      item.appendChild(cb);
      item.appendChild(span);

      // Description
      const desc = document.createElement('div');
      desc.className = 'reader-layer-desc';
      desc.textContent = layer.desc;

      section.appendChild(item);
      section.appendChild(desc);

      // Toggle handler
      cb.addEventListener('change', () => {
        if (cb.checked) {
          activeLayers.add(layer.key);
        } else {
          activeLayers.delete(layer.key);
        }
        applyLayers();
        saveLayerPrefs(activeLayers);
      });
    }

    sidebar.appendChild(section);
  }

  return sidebar;
}

// ── Apply layer state ──────────────────────────────────────────────────

const WORD_LAYERS = new Set(['lemmas', 'glosses', 'upos', 'xpos', 'feats', 'deps']);

function applyLayers() {
  const textDiv = document.getElementById('reader-text');
  if (!textDiv) return;

  // Update data-layers attribute (drives CSS visibility)
  textDiv.setAttribute('data-layers', [...activeLayers].join(' '));

  // Handle segments layer (requires JS to swap form content)
  applySegmentLayer();

  // Handle POS coloring (requires inline style override)
  applyPOSColoring();

  // Toggle bare/structured word mode
  applyBareMode(textDiv);
}

function applyBareMode(textDiv: HTMLElement) {
  const hasWordLayers = [...activeLayers].some(l => WORD_LAYERS.has(l));
  textDiv.querySelectorAll('.reader-word').forEach(el => {
    el.classList.toggle('bare', !hasWordLayers);
  });
  textDiv.querySelectorAll('.reader-words').forEach(el => {
    el.classList.toggle('bare-mode', !hasWordLayers);
  });
}

function applySegmentLayer() {
  const textDiv = document.getElementById('reader-text');
  if (!textDiv) return;

  const showSegs = activeLayers.has('segments');

  textDiv.querySelectorAll('.reader-form-plain').forEach(el => {
    (el as HTMLElement).style.display = showSegs ? 'none' : '';
  });
  textDiv.querySelectorAll('.reader-form-segmented').forEach(el => {
    (el as HTMLElement).style.display = showSegs ? '' : 'none';
  });
}

function applyPOSColoring() {
  const textDiv = document.getElementById('reader-text');
  if (!textDiv) return;

  const showColor = activeLayers.has('pos-color');

  textDiv.querySelectorAll('.reader-form').forEach(el => {
    const form = el as HTMLElement;
    const posColor = form.style.getPropertyValue('--reader-pos-color');
    if (showColor && posColor) {
      form.style.color = posColor;
    } else {
      form.style.color = '';
    }
  });
}

// ── Cleanup ────────────────────────────────────────────────────────────

export function cleanup() {
  if (morphTooltipCleanup) {
    morphTooltipCleanup();
    morphTooltipCleanup = null;
  }
  if (morphCloseHandler) {
    morphCloseHandler();
    morphCloseHandler = null;
  }
  if (morphOverlayHandler) {
    morphOverlayHandler();
    morphOverlayHandler = null;
  }
  if (keydownHandler) {
    window.removeEventListener('keydown', keydownHandler);
    keydownHandler = null;
  }
  hideMorphPanel();
  hideMorphTooltip();

  const readerLink = document.getElementById('nav-reader') as HTMLAnchorElement;
  if (readerLink) readerLink.style.display = 'none';

  const titleEl = document.getElementById('nav-title');
  if (titleEl) titleEl.textContent = '';
}
