/**
 * Conllu file browser page — lists loaded files, study progress, actions.
 */

import { parseConllu } from './types';
import { AppStore, StoredFile, loadStore, saveStore, addFile, listFiles,
         getReviewedCount, getMasteredCount, getMasteryPct } from './store';
import { navigate } from './router';

import './styles/tokens.css';
import './styles/browser.css';

// ── Sort options ─────────────────────────────────────────────────────────

type SortKey = 'recent' | 'name' | 'most-reviewed' | 'least-reviewed' | 'most-mastered' | 'least-mastered' | 'most-words' | 'least-words';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recently added' },
  { key: 'name', label: 'Name A→Z' },
  { key: 'most-reviewed', label: 'Most reviewed' },
  { key: 'least-reviewed', label: 'Least reviewed' },
  { key: 'most-mastered', label: 'Most mastered' },
  { key: 'least-mastered', label: 'Least mastered' },
  { key: 'most-words', label: 'Most words' },
  { key: 'least-words', label: 'Least words' },
];

let currentSort: SortKey = 'recent';
let store: AppStore;

export function mount() {
  store = loadStore();

  const app = document.getElementById('app') as HTMLElement;
  if (app) app.style.display = 'none';

  const page = document.getElementById('page')!;
  page.innerHTML = '';
  updateNav();

  const container = createEl('div', 'browser-container');

  container.appendChild(createHeader());
  container.appendChild(createDropZone());
  container.appendChild(createActionButtons(container));
  container.appendChild(createSortControl());
  container.appendChild(createFileGrid());

  page.appendChild(container);
  setupDropZone(container);
}

function createEl(tag: string, cls?: string) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function updateNav() {
  const titleEl = document.getElementById('nav-title');
  const studyLink = document.getElementById('nav-study');
  const treeLink = document.getElementById('nav-tree');
  const treeSep = document.getElementById('nav-tree-sep');
  if (titleEl) titleEl.textContent = '';
  if (studyLink) studyLink.style.display = 'none';
  if (treeLink) treeLink.style.display = 'none';
  if (treeSep) treeSep.style.display = 'none';
}

function createHeader() {
  const div = createEl('div');
  div.innerHTML = `
    <h1>📁 Conllu Files</h1>
    <p class="browser-subtitle">Load treebank files, study vocabulary with spaced repetition.</p>
  `;
  return div;
}

function createDropZone() {
  const div = createEl('div', 'browser-drop-zone');
  div.id = 'browser-drop-zone';
  div.innerHTML = `
    <span class="drop-icon">📂</span>
    <p>Drop a <code>.conllu</code> file here or click <strong>Load File</strong></p>
  `;
  return div;
}

function setupDropZone(container: HTMLElement) {
  const zone = document.getElementById('browser-drop-zone')!;

  ['dragenter', 'dragover'].forEach(evt => {
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(evt => {
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('dragover'); });
  });

  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files[0];
    if (file) loadFileObj(file);
  });
}

function createActionButtons(container: HTMLElement) {
  const wrapper = createEl('div', 'browser-actions');

  const btn = createEl('button', 'browser-btn primary');
  btn.id = 'btn-load-file';
  btn.textContent = '📂 Load File';
  wrapper.appendChild(btn);

  const input = document.createElement('input') as HTMLInputElement;
  input.type = 'file';
  input.accept = '.conllu,.conll,.txt';
  input.hidden = true;
  input.id = 'browser-file-input';
  container.appendChild(input);

  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) loadFileObj(file);
    input.value = '';
  });

  return wrapper;
}

function loadFileObj(file: File) {
  const reader = new FileReader();
  reader.onload = () => {
    const content = reader.result as string;
    if (!content) return;
    store = loadStore();
    addFile(store, file.name, content, 'upload');
    saveStore(store);
    mount();
  };
  reader.readAsText(file);
}

function sortFiles(files: StoredFile[]): StoredFile[] {
  const sorted = [...files];

  // Pre-compute stats for each file
  const stats = new Map<string, { reviewed: number; mastered: number; totalTokens: number; name: string; loadedAt: number }>();
  for (const file of sorted) {
    let totalTokens = 0;
    let name = file.name;
    try {
      const treebank = parseConllu(file.content, file.name);
      totalTokens = treebank.sentences.reduce((a, s) => a + s.tokens.filter(t => t.upos !== 'PUNCT').length, 0);
      name = treebank.title || file.name;
    } catch { /* corrupt file */ }
    const session = store.sessions[file.id];
    stats.set(file.id, {
      reviewed: session ? getReviewedCount(session) : 0,
      mastered: session ? getMasteredCount(session) : 0,
      totalTokens,
      name: name.toLowerCase(),
      loadedAt: file.loadedAt,
    });
  }

  sorted.sort((a, b) => {
    const sa = stats.get(a.id)!;
    const sb = stats.get(b.id)!;

    switch (currentSort) {
      case 'recent': return sb.loadedAt - sa.loadedAt;
      case 'name': return sa.name.localeCompare(sb.name);
      case 'most-reviewed': return sb.reviewed - sa.reviewed;
      case 'least-reviewed': return sa.reviewed - sb.reviewed;
      case 'most-mastered': return sb.mastered - sa.mastered;
      case 'least-mastered': return sa.mastered - sb.mastered;
      case 'most-words': return sb.totalTokens - sa.totalTokens;
      case 'least-words': return sa.totalTokens - sb.totalTokens;
      default: return 0;
    }
  });

  return sorted;
}

function createSortControl() {
  const wrap = createEl('div', 'browser-sort');

  const label = createEl('span', 'browser-sort-label');
  label.textContent = 'Sort by';
  wrap.appendChild(label);

  const select = document.createElement('select') as HTMLSelectElement;
  select.className = 'browser-sort-select';
  for (const opt of SORT_OPTIONS) {
    const o = document.createElement('option') as HTMLOptionElement;
    o.value = opt.key;
    o.textContent = opt.label;
    if (opt.key === currentSort) o.selected = true;
    select.appendChild(o);
  }

  select.addEventListener('change', () => {
    currentSort = select.value as SortKey;
    // Re-render just the grid
    const grid = document.querySelector('.file-grid');
    if (grid) {
      const newGrid = createFileGrid();
      grid.replaceWith(newGrid);
    }
  });

  wrap.appendChild(select);
  return wrap;
}

function createFileGrid() {
  const div = createEl('div', 'file-grid');
  const files = sortFiles(listFiles(store));

  if (files.length === 0) {
    div.innerHTML = `
      <div class="no-files" style="grid-column: 1 / -1;">
        <div class="no-files-icon">🌳</div>
        <p>No files loaded yet.</p>
        <p style="font-size:13px;">Drop a .conllu file above or click Load File.</p>
      </div>`;
    return div;
  }

  for (const file of files) {
    div.appendChild(createFileCard(file));
  }

  return div;
}

function createFileCard(file: import('./store').StoredFile) {
  const card = createEl('div', 'file-card');

  let sentences = 0;
  let totalTokens = 0;
  let workTitle: string | undefined;
  try {
    const treebank = parseConllu(file.content, file.name);
    sentences = treebank.sentences.length;
    totalTokens = treebank.sentences.reduce((a, s) => a + s.tokens.filter(t => t.upos !== 'PUNCT').length, 0);
    workTitle = treebank.title;
  } catch { /* corrupt file */ }

  const displayTitle = workTitle || file.name;
  const metaPrefix = workTitle && workTitle !== file.name
    ? `${escapeHTML(file.name)} · `
    : '';

  const session = store.sessions[file.id];
  const reviewed = session ? getReviewedCount(session) : 0;
  const mastered = session ? getMasteredCount(session) : 0;
  const pct = getMasteryPct(session || { fileId: file.id, tokens: {} }, totalTokens);

  card.innerHTML = `
    <div class="file-card-name">${escapeHTML(displayTitle)}</div>
    <div class="file-card-author">${metaPrefix}${file.source === 'upload' ? 'Uploaded' : 'Default'} · ${sentences} sentences · ${totalTokens} words</div>
    <div class="file-card-mastery"><div class="file-card-mastery-fill" style="width:${pct}%"></div></div>
    <div class="file-card-stats">
      <span>✅ ${reviewed} reviewed</span>
      <span>🧠 ${mastered} mastered (${pct}%)</span>
    </div>
    <div class="file-card-actions">
      <button class="action-study" data-action="study">📝 Study</button>
      <button class="action-cram" data-action="cram">🔥 Cram</button>
      <button data-action="reader">📖 Read</button>
      <button data-action="browse">🌳 Browse</button>
    </div>
  `;

  const studyBtn = card.querySelector('[data-action="study"]')!;
  const cramBtn = card.querySelector('[data-action="cram"]')!;
  const readerBtn = card.querySelector('[data-action="reader"]')!;
  const browseBtn = card.querySelector('[data-action="browse"]')!;

  studyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigate('study', file.id, { studyMode: 'srs' });
  });
  cramBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigate('study', file.id, { studyMode: 'cram' });
  });
  readerBtn.addEventListener('click', (e) => { e.stopPropagation(); navigate('reader', file.id); });
  browseBtn.addEventListener('click', (e) => { e.stopPropagation(); navigate('tree', file.id); });

  return card;
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
