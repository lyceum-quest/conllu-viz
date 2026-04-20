/**
 * SVG Tree Renderer
 * Renders layout results into an interactive SVG tree.
 */

import { LayoutResult, LayoutNode, LayoutEdge } from './layout';
import { Token } from './types';

// ── Colors ───────────────────────────────────────────────────────────────
const POS_COLORS: Record<string, string> = {
  NOUN: '#e0af68', VERB: '#f7768e', ADJ: '#9ece6a', ADV: '#73daca',
  DET: '#7dcfff', PRON: '#b4f9f8', PROPN: '#ff9e64', ADP: '#bb9af7',
  CCONJ: '#9d7cd8', SCONJ: '#7aa2f7', PART: '#c0caf5', NUM: '#e06c75',
  PUNCT: '#565f89', AUX: '#f7768e', INTJ: '#ff007f', X: '#565f89',
};

const DEP_COLORS: Record<string, string> = {
  'root': '#7aa2f7', 'nsubj': '#f7768e', 'obj': '#9ece6a',
  'obl': '#bb9af7', 'obl:agent': '#bb9af7', 'advcl': '#73daca',
  'acl': '#ff9e64', 'advmod': '#7dcfff', 'det': '#7dcfff',
  'case': '#9d7cd8', 'conj': '#9d7cd8', 'cc': '#c0caf5',
  'mark': '#7aa2f7', 'amod': '#9ece6a', 'nummod': '#e06c75',
  'discourse': '#e0af68', 'xcomp': '#f7768e', 'ccomp': '#f7768e',
  'cop': '#c0caf5', 'aux': '#c0caf5', 'nmod': '#bb9af7',
};

function posColor(t: Token): string { return POS_COLORS[t.upos] || '#565f89'; }
function depColor(d: string): string { return DEP_COLORS[d] || '#8892b0'; }

const NS = 'http://www.w3.org/2000/svg';
function svgEl(tag: string): SVGElement {
  return document.createElementNS(NS, tag);
}

// ── DEPREL labels for tooltips ───────────────────────────────────────────
export const DEPREL_LABELS: Record<string, string> = {
  root: 'ROOT — main verb/predicate',
  nsubj: 'nominal subject — the doer',
  csubj: 'clausal subject',
  obj: 'direct object — thing acted on',
  iobj: 'indirect object — recipient',
  obl: 'oblique — indirect argument',
  'obl:agent': 'agent — "by X" (passive)',
  advcl: 'adverbial clause modifier',
  acl: 'adnominal clause — modifies a noun',
  advmod: 'adverb / adverbial modifier',
  det: 'determiner — article, demonstrative',
  case: 'case — preposition / postposition',
  conj: 'conjunct — coordinated element',
  cc: 'coordinating conjunction (and/but)',
  mark: 'marker — subordinator',
  amod: 'adjectival modifier',
  nummod: 'numeric modifier',
  discourse: 'discourse particle / interjection',
  xcomp: 'open clausal complement',
  ccomp: 'clausal complement',
  cop: 'copula — linking verb',
  aux: 'auxiliary — helper verb',
  nmod: 'nominal modifier',
  fixed: 'fixed multiword expression',
  punct: 'punctuation',
  flat: 'flat name component',
  vocative: 'vocative — direct address',
  dep: '(unlabeled dependency)',
};

// ── State ────────────────────────────────────────────────────────────────
let currentLayout: LayoutResult | null = null;
let focusId: number | null = null;
let filters: { pos: Set<string>; deprels: Set<string> } | null = null;

// ── Viewport ─────────────────────────────────────────────────────────────
const vp = { x: 0, y: 0, zoom: 1 };
let panning = false;
let panStart = { x: 0, y: 0 };
let svgElRef: SVGSVGElement | null = null;

// ── API ──────────────────────────────────────────────────────────────────
export function render(sentenceLayout: LayoutResult, svg: SVGSVGElement, treeGroup: SVGGElement) {
  currentLayout = sentenceLayout;
  focusId = null;
  svgElRef = svg;
  treeGroup.innerHTML = '';

  // ViewBox
  svg.setAttribute('viewBox', `0 0 ${sentenceLayout.width} ${sentenceLayout.height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  resetViewport();

  // Edges
  for (const e of sentenceLayout.edges) {
    drawEdge(e, treeGroup);
  }

  // Nodes
  for (const n of sentenceLayout.nodes) {
    drawNode(n, treeGroup);
  }

  applyFilters();
}

// ── Edge drawing ─────────────────────────────────────────────────────────
function drawEdge(e: LayoutEdge, group: SVGGElement) {
  // Path
  const path = svgEl('path') as SVGPathElement;
  path.setAttribute('d', e.path);
  path.setAttribute('class', 'tree-edge');
  path.setAttribute('data-src', String(e.source.token.id));
  path.setAttribute('data-tgt', String(e.target.token.id));
  path.style.markerEnd = 'url(#arrowhead)';
  path.style.stroke = depColor(e.deprel);
  group.appendChild(path);

  // Label background
  const lbl = e.deprel;
  const lw = lbl.length * 5.5 + 10;
  const bg = svgEl('rect') as SVGRectElement;
  bg.setAttribute('x', String(e.labelX - lw / 2));
  bg.setAttribute('y', String(e.labelY - 7));
  bg.setAttribute('width', String(lw));
  bg.setAttribute('height', '14');
  bg.setAttribute('class', 'edge-label-bg');
  group.appendChild(bg);

  // Label text
  const text = svgEl('text') as SVGTextElement;
  text.setAttribute('x', String(e.labelX));
  text.setAttribute('y', String(e.labelY + 3));
  text.setAttribute('class', 'edge-label');
  text.style.fill = depColor(e.deprel);
  text.textContent = lbl;
  group.appendChild(text);
}

// ── Node drawing ─────────────────────────────────────────────────────────
function drawNode(n: LayoutNode, group: SVGGElement) {
  const g = svgEl('g') as SVGGElement;
  g.setAttribute('class', `tnode${n.token.head === 0 ? ' root' : ''}`);
  g.setAttribute('data-id', String(n.token.id));
  g.setAttribute('data-upos', n.token.upos);

  const w = n.width;
  const hasGloss = !!n.token.gloss;
  const h = hasGloss ? 52 : 38;
  const color = posColor(n.token);

  // Accent bar (top)
  const bar = svgEl('rect') as SVGRectElement;
  bar.setAttribute('x', String(n.x - w / 2));
  bar.setAttribute('y', String(n.y - h / 2));
  bar.setAttribute('width', String(w));
  bar.setAttribute('height', '3');
  bar.setAttribute('class', 'pos-bar');
  bar.setAttribute('fill', color);
  g.appendChild(bar);

  // Rect background
  const rect = svgEl('rect') as SVGRectElement;
  rect.setAttribute('x', String(n.x - w / 2));
  rect.setAttribute('y', String(n.y - h / 2 + 3));
  rect.setAttribute('width', String(w));
  rect.setAttribute('height', String(h - 3));
  rect.setAttribute('class', 'tnode-rect');
    (rect as SVGRectElement).style.setProperty('stroke', color);
  g.appendChild(rect);

  // Surface form
  const form = svgEl('text') as SVGTextElement;
  form.setAttribute('x', String(n.x));
  form.setAttribute('y', hasGloss ? String(n.y - 6) : String(n.y - 2));
  form.setAttribute('class', 'tnode-form');
  form.textContent = n.token.form;
  g.appendChild(form);

  // Lemma
  const lemma = svgEl('text') as SVGTextElement;
  lemma.setAttribute('x', String(n.x));
  lemma.setAttribute('y', hasGloss ? String(n.y + 8) : String(n.y + 11));
  lemma.setAttribute('class', 'tnode-lemma');
  lemma.textContent = `[${n.token.lemma}]`;
  g.appendChild(lemma);

  // Inline gloss (english translation)
  if (hasGloss) {
    const gloss = svgEl('text') as SVGTextElement;
    gloss.setAttribute('x', String(n.x));
    gloss.setAttribute('y', String(n.y + 20));
    gloss.setAttribute('class', 'tnode-gloss');
    gloss.textContent = n.token.gloss!;
    g.appendChild(gloss);
  }

  // Events
  g.addEventListener('mouseenter', (ev) => showTooltip(ev, n.token, color));
  g.addEventListener('mousemove', moveTooltip);
  g.addEventListener('mouseleave', hideTooltip);
  g.addEventListener('click', () => {
    // Emit custom detail event for morphological panel
    const event = new CustomEvent('token-focus', {
      detail: { token: n.token, color },
    });
    svgElRef?.dispatchEvent(event);
    toggleFocus(n.token.id);
  });

  group.appendChild(g);
}

// ── Tooltip ──────────────────────────────────────────────────────────────
function showTooltip(e: MouseEvent, t: Token, color: string) {
  const el = document.getElementById('tooltip')!;
  const depLabel = DEPREL_LABELS[t.deprel] || '';
  const headForm = currentLayout?.nodes.find(n => n.token.id === t.head)?.token.form;
  const headInfo = headForm ? `← ${t.deprel}(#${t.head} ${headForm})` : '(root)';

  let feats = '';
  if (t.feats) {
    feats = '<div class="tt-features">' +
      Object.entries(t.feats).map(([k, v]) => `<span class="tt-feat">${k}=${v}</span>`).join('') +
      '</div>';
  }

  let miscNote = '';
  const notes = t.misc;
  if (notes) {
    const noteStr = Object.entries(notes).filter(([k]) => k !== 'gloss').map(([k,v]) => `${k}=${v}`).join(' · ');
    if (noteStr) miscNote = `<div style="margin-top:4px;font-size:11px;color:var(--accent-warn);">✦ ${noteStr}</div>`;
  }

  const glossLine = t.gloss ? `<div style="margin-top:4px;font-size:12px;color:var(--accent-warn);">📖 ${t.gloss}</div>` : '';

  el.innerHTML = `
    <div class="tt-form" style="color:${color}">${t.form}</div>
    <div class="tt-lemma">lemma: ${t.lemma} · ${t.upos}</div>
    ${glossLine}
    <div class="tt-deprel">${headInfo}${depLabel ? ` — ${depLabel}` : ''}</div>
    ${feats}${miscNote}
  `;
  el.classList.add('visible');
  moveTooltip(e);
}

function moveTooltip(e: MouseEvent) {
  const el = document.getElementById('tooltip')!;
  const canvasRect = document.getElementById('canvas-area')!.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  let x = e.clientX - canvasRect.left + 14;
  let y = e.clientY - canvasRect.top - 10;
  if (x + r.width > canvasRect.width) x = e.clientX - canvasRect.left - r.width - 14;
  if (y + r.height > canvasRect.height) y = canvasRect.height - r.height - 10;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
}

function hideTooltip() {
  document.getElementById('tooltip')!.classList.remove('visible');
}

// ── Focus mode ───────────────────────────────────────────────────────────
function toggleFocus(id: number) {
  if (focusId === id) {
    focusId = null;
    clearHighlights();
    return;
  }
  focusId = id;

  // Trace path to root
  const pathNodes = new Set<number>();
  const pathEdges = new Set<string>();
  const tmap = new Map(currentLayout!.nodes.map(n => [n.token.id, n.token]));
  let cur: number | null = id;
  while (cur !== null) {
    pathNodes.add(cur);
    const tok = tmap.get(cur);
    if (!tok || tok.head === 0) break;
    pathEdges.add(`${tok.head}→${cur}`);
    cur = tok.head;
  }

  // Include subtree of focus node
  function addSubtree(nodeId: number) {
    for (const n of currentLayout!.nodes) {
      if (n.token.head === nodeId) {
        pathNodes.add(n.token.id);
        pathEdges.add(`${nodeId}→${n.token.id}`);
        addSubtree(n.token.id);
      }
    }
  }
  addSubtree(id);

  // Apply
  applyHighlights(pathNodes, pathEdges);
}

function clearHighlights() {
  const g = document.getElementById('tree-group')!;
  g.querySelectorAll('.tnode').forEach(n => n.classList.remove('dim', 'focus', 'hl'));
  g.querySelectorAll('.tree-edge').forEach(e => (e as SVGPathElement).classList.remove('dim', 'hl'));
  g.querySelectorAll('.edge-label').forEach(e => (e as SVGTextElement).classList.remove('hl'));
}

function applyHighlights(pathNodes: Set<number>, pathEdges: Set<string>) {
  const g = document.getElementById('tree-group')!;
  g.querySelectorAll('.tnode').forEach(n => {
    const id = parseInt(n.getAttribute('data-id')!);
    n.classList.toggle('dim', !pathNodes.has(id));
    n.classList.toggle('hl', id === focusId);
    n.classList.toggle('focus', false);
  });
  g.querySelectorAll('.tree-edge').forEach(e => {
    const src = e.getAttribute('data-src');
    const tgt = e.getAttribute('data-tgt');
    const isPath = pathEdges.has(`${src}→${tgt}`);
    (e as SVGPathElement).classList.toggle('dim', !isPath);
    (e as SVGPathElement).classList.toggle('hl', isPath);
  });
  g.querySelectorAll('.edge-label').forEach(e => {
    const parent = (e as SVGTextElement).previousElementSibling;
    // Just dim all non-highlighted labels
  });
}

// ── Filters ──────────────────────────────────────────────────────────────
export function setFilter(type: 'pos' | 'deprel', value: string, active: boolean) {
  if (!filters) filters = { pos: new Set(), deprels: new Set() };
  if (type === 'pos') {
    active ? filters.pos.delete(value) : filters.pos.add(value);
  } else {
    active ? filters.deprels.delete(value) : filters.deprels.add(value);
  }
  applyFilters();
}

function applyFilters() {
  if (!currentLayout || !filters) { clearHighlights(); return; }
  const g = document.getElementById('tree-group')!;

  g.querySelectorAll('.tnode').forEach(n => {
    const upos = n.getAttribute('data-upos');
    const dimmed = filters!.pos.has(upos || '');
    n.classList.toggle('dim', dimmed);
  });
  g.querySelectorAll('.tree-edge').forEach(e => {
    const tgt = e.getAttribute('data-tgt');
    const tgtNode = currentLayout!.nodes.find(n => n.token.id === parseInt(tgt!));
    const dimmed = tgtNode && (filters!.deprels.has(tgtNode.token.deprel) || filters!.pos.has(tgtNode.token.upos));
    (e as SVGPathElement).classList.toggle('dim', !!dimmed);
  });
}

export function clearFilters() {
  filters = null;
  clearHighlights();
}

// ── Viewport (pan + zoom) ───────────────────────────────────────────────
function resetViewport() {
  vp.x = 0; vp.y = 0; vp.zoom = 1;
  updateVP();
}

function updateVP() {
  const g = document.getElementById('tree-group');
  if (g) g.setAttribute('transform', `translate(${vp.x},${vp.y}) scale(${vp.zoom})`);
}

export function setupPanZoom(svg: SVGSVGElement) {
  svgElRef = svg;

  svg.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    panning = true;
    panStart = { x: e.clientX - vp.x, y: e.clientY - vp.y };
  });

  window.addEventListener('mousemove', e => {
    if (!panning) return;
    vp.x = e.clientX - panStart.x;
    vp.y = e.clientY - panStart.y;
    updateVP();
  });

  window.addEventListener('mouseup', () => { panning = false; });

  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const nz = Math.max(0.15, Math.min(6, vp.zoom * delta));
    const rect = (svgElRef || svg).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    vp.x = mx - (mx - vp.x) * (nz / vp.zoom);
    vp.y = my - (my - vp.y) * (nz / vp.zoom);
    vp.zoom = nz;
    updateVP();
  }, { passive: false });

  return resetViewport;
}

export function exportSVG(): string {
  const svg = document.getElementById('tree-svg') as unknown as SVGSVGElement;
  if (!svg) return '';
  const clone = svg.cloneNode(true) as unknown as SVGSVGElement;
  const style = document.createElementNS(NS, 'style');
  style.textContent = `
    .tree-edge { fill:none; stroke:#3b4261; stroke-width:1.6; }
    .tnode-form { font-family:serif; font-size:13px; fill:#c0caf5; text-anchor:middle; font-weight:600; }
    .tnode-lemma { font-family:sans-serif; font-size:9px; fill:#8892b0; text-anchor:middle; font-style:italic; }
    .tnode-gloss { font-family:sans-serif; font-size:9px; fill:#e0af68; text-anchor:middle; font-weight:500; }
    .tnode-rect { fill:#242438; stroke:#3b4261; stroke-width:1; rx:6; ry:6; }
    .edge-label-bg { fill:#1a1b26; opacity:0.8; }
    .pos-bar { rx:1; ry:1; }
    .arrowhead-fill { fill:#3b4261; }
    .edge-label { font-family:sans-serif; }
  `;
  const defs = clone.querySelector('defs');
  if (defs) defs.prepend(style);
  return new XMLSerializer().serializeToString(clone);
}