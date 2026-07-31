/** Author-grouped corpus browser with per-work study progress and actions. */

import { parseConllu } from './types';
import {
  AppStore, StoredFile, loadStore, saveStore, addFile, removeFile, listFiles,
  getReviewedCount, getMasteredCount, getMasteryPct, getFileLastReview, makeAuthorId,
} from './store';
import { navigate, routeUrl } from './router';
import { loadPreloadedFiles } from './preload';

import './styles/tokens.css';
import './styles/browser.css';

type SortKey = 'recently-reviewed' | 'recently-added' | 'name' | 'most-reviewed' | 'least-reviewed' | 'most-mastered' | 'least-mastered' | 'most-words' | 'least-words';

const DEFAULT_SORT: SortKey = 'recently-reviewed';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recently-reviewed', label: 'Recently reviewed' },
  { key: 'recently-added', label: 'Recently added' },
  { key: 'name', label: 'Name A→Z' },
  { key: 'most-reviewed', label: 'Most reviewed' },
  { key: 'least-reviewed', label: 'Least reviewed' },
  { key: 'most-mastered', label: 'Most mastered' },
  { key: 'least-mastered', label: 'Least mastered' },
  { key: 'most-words', label: 'Most words' },
  { key: 'least-words', label: 'Least words' },
];

interface FileInfo {
  file: StoredFile;
  authorId: string;
  authorName: string;
  displayTitle: string;
  sentences: number;
  totalTokens: number;
  reviewed: number;
  mastered: number;
  masteryPct: number;
  lastReviewed: number;
}

interface AuthorGroup {
  id: string;
  name: string;
  files: FileInfo[];
  reviewed: number;
  mastered: number;
  totalTokens: number;
  lastReviewed: number;
  loadedAt: number;
}

let currentSort: SortKey = DEFAULT_SORT;
let activeAuthorId: string | undefined;
let store: AppStore;
let mountToken = 0;
let fileInfoCache = new Map<string, FileInfo>();

function isSortKey(value: string | undefined): value is SortKey {
  return !!value && SORT_OPTIONS.some(option => option.key === value);
}

function createEl(tag: string, cls?: string) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function escapeHTML(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fallbackAuthor(file: StoredFile, parsedAuthor?: string): { id: string; name: string } {
  if (file.authorId && file.authorName) return { id: file.authorId, name: file.authorName };
  if (parsedAuthor) return { id: makeAuthorId(parsedAuthor), name: parsedAuthor };
  if (file.source === 'default' && file.name.includes(',')) {
    const name = file.name.split(',')[0].trim();
    if (name) return { id: makeAuthorId(name), name };
  }
  return { id: 'uploaded', name: 'Uploaded / Unknown Author' };
}

function getFileInfo(file: StoredFile): FileInfo {
  const cached = fileInfoCache.get(file.id);
  if (cached) return cached;

  let displayTitle = file.name;
  let sentences = 0;
  let totalTokens = 0;
  let parsedAuthor: string | undefined;
  try {
    const treebank = parseConllu(file.content, file.name);
    displayTitle = treebank.title || treebank.work || file.name;
    parsedAuthor = treebank.author;
    sentences = treebank.sentences.length;
    totalTokens = treebank.sentences.reduce(
      (sum, sentence) => sum + sentence.tokens.filter(token => token.upos !== 'PUNCT').length,
      0,
    );
  } catch { /* corrupt files remain visible */ }

  const author = fallbackAuthor(file, parsedAuthor);
  const session = store.sessions[file.id];
  const reviewed = session ? getReviewedCount(session) : 0;
  const mastered = session ? getMasteredCount(session) : 0;
  const info: FileInfo = {
    file,
    authorId: author.id,
    authorName: author.name,
    displayTitle,
    sentences,
    totalTokens,
    reviewed,
    mastered,
    masteryPct: getMasteryPct(session || { fileId: file.id, tokens: {} }, totalTokens),
    lastReviewed: getFileLastReview(store, file.id),
  };
  fileInfoCache.set(file.id, info);
  return info;
}

function buildAuthorGroups(): AuthorGroup[] {
  const groups = new Map<string, AuthorGroup>();
  for (const file of listFiles(store)) {
    const info = getFileInfo(file);
    let group = groups.get(info.authorId);
    if (!group) {
      group = {
        id: info.authorId,
        name: info.authorName,
        files: [],
        reviewed: 0,
        mastered: 0,
        totalTokens: 0,
        lastReviewed: 0,
        loadedAt: 0,
      };
      groups.set(info.authorId, group);
    }
    group.files.push(info);
    group.reviewed += info.reviewed;
    group.mastered += info.mastered;
    group.totalTokens += info.totalTokens;
    group.lastReviewed = Math.max(group.lastReviewed, info.lastReviewed);
    group.loadedAt = Math.max(group.loadedAt, info.file.loadedAt);
  }
  return sortAuthors([...groups.values()]);
}

function compareStats(
  a: { name: string; reviewed: number; mastered: number; totalTokens: number; lastReviewed: number; loadedAt: number },
  b: { name: string; reviewed: number; mastered: number; totalTokens: number; lastReviewed: number; loadedAt: number },
): number {
  let result = 0;
  switch (currentSort) {
    case 'recently-reviewed': result = b.lastReviewed - a.lastReviewed; break;
    case 'recently-added': result = b.loadedAt - a.loadedAt; break;
    case 'name': result = a.name.localeCompare(b.name); break;
    case 'most-reviewed': result = b.reviewed - a.reviewed; break;
    case 'least-reviewed': result = a.reviewed - b.reviewed; break;
    case 'most-mastered': result = b.mastered - a.mastered; break;
    case 'least-mastered': result = a.mastered - b.mastered; break;
    case 'most-words': result = b.totalTokens - a.totalTokens; break;
    case 'least-words': result = a.totalTokens - b.totalTokens; break;
  }
  return result || a.name.localeCompare(b.name);
}

function sortAuthors(groups: AuthorGroup[]): AuthorGroup[] {
  return groups.sort((a, b) => compareStats(
    { ...a, name: a.name.toLocaleLowerCase() },
    { ...b, name: b.name.toLocaleLowerCase() },
  ));
}

function sortFiles(files: FileInfo[]): FileInfo[] {
  return [...files].sort((a, b) => compareStats(
    {
      name: a.displayTitle.toLocaleLowerCase(),
      reviewed: a.reviewed,
      mastered: a.mastered,
      totalTokens: a.totalTokens,
      lastReviewed: a.lastReviewed,
      loadedAt: a.file.loadedAt,
    },
    {
      name: b.displayTitle.toLocaleLowerCase(),
      reviewed: b.reviewed,
      mastered: b.mastered,
      totalTokens: b.totalTokens,
      lastReviewed: b.lastReviewed,
      loadedAt: b.file.loadedAt,
    },
  ));
}

export function mount(authorId?: string, requestedSort?: string) {
  const token = ++mountToken;
  store = loadStore();
  activeAuthorId = authorId;
  currentSort = isSortKey(requestedSort) ? requestedSort : DEFAULT_SORT;
  fileInfoCache.clear();

  const app = document.getElementById('app') as HTMLElement;
  if (app) app.style.display = 'none';

  const page = document.getElementById('page')!;
  page.innerHTML = '';
  updateNav();

  const container = createEl('div', 'browser-container');
  container.appendChild(createHeader());
  const preloadStatus = createEl('div', 'preload-status');
  preloadStatus.id = 'preload-status';
  container.appendChild(preloadStatus);

  if (!activeAuthorId) {
    container.appendChild(createDropZone());
    container.appendChild(createActionButtons(container));
  }
  container.appendChild(createSortControl());
  container.appendChild(createListing());
  page.appendChild(container);

  if (!activeAuthorId) setupDropZone(container);
  void hydratePreloadedFiles(preloadStatus, token);
}

function updateNav() {
  const titleEl = document.getElementById('nav-title');
  const studyLink = document.getElementById('nav-study');
  const treeLink = document.getElementById('nav-tree');
  const treeSep = document.getElementById('nav-tree-sep');
  if (titleEl) titleEl.textContent = activeAuthorId ? 'Works by author' : '';
  if (studyLink) studyLink.style.display = 'none';
  if (treeLink) treeLink.style.display = 'none';
  if (treeSep) treeSep.style.display = 'none';
}

function createHeader() {
  const wrapper = createEl('div', 'browser-heading');
  if (!activeAuthorId) {
    wrapper.innerHTML = `
      <h1>📚 Authors</h1>
      <p class="browser-subtitle">Choose an author to browse their works, then read or continue studying where you left off.</p>`;
    return wrapper;
  }

  const author = buildAuthorGroups().find(group => group.id === activeAuthorId);
  wrapper.innerHTML = `
    <a class="browser-breadcrumb" href="${routeUrl('browser')}">← All Authors</a>
    <h1>${author ? escapeHTML(author.name) : 'Author not found'}</h1>
    <p class="browser-subtitle">${author ? `${author.files.length} ${author.files.length === 1 ? 'work' : 'works'}` : 'This author is not available in the current corpus.'}</p>`;
  return wrapper;
}

async function hydratePreloadedFiles(statusEl: HTMLElement, token: number) {
  statusEl.textContent = 'Checking corpus…';
  const nextStore = loadStore();
  const result = await loadPreloadedFiles(nextStore, ({ checked, total, currentPath }) => {
    if (token !== mountToken) return;
    if (total === 0) {
      statusEl.textContent = 'Checking corpus…';
      return;
    }
    const current = currentPath ? ` · ${currentPath.split('/').pop() || currentPath}` : '';
    statusEl.textContent = `Checking corpus… ${checked}/${total}${current}`;
  });
  // Persist corpus/metadata migrations even if navigation made this mount stale.
  // All browser mounts share the same in-memory store object.
  if (result.added || result.updated || result.removed) saveStore(nextStore);
  if (token !== mountToken) return;

  store = nextStore;
  fileInfoCache.clear();
  if (result.added || result.updated || result.removed) {
    const changes = [
      result.added ? `added ${result.added}` : '',
      result.updated ? `updated ${result.updated}` : '',
      result.removed ? `removed ${result.removed}` : '',
    ].filter(Boolean).join(', ');
    statusEl.textContent = `✨ Bundled files ${changes}.`;
    refreshHeadingAndListing();
  } else {
    statusEl.textContent = '';
  }
}

function refreshHeadingAndListing() {
  const container = document.querySelector('.browser-container');
  const heading = container?.querySelector('.browser-heading');
  const listing = container?.querySelector('.browser-listing');
  if (heading) heading.replaceWith(createHeader());
  if (listing) listing.replaceWith(createListing());
}

function createDropZone() {
  const div = createEl('div', 'browser-drop-zone');
  div.id = 'browser-drop-zone';
  div.innerHTML = `
    <span class="drop-icon">📂</span>
    <p>Drop a <code>.conllu</code> file here or click <strong>Load File</strong></p>`;
  return div;
}

function setupDropZone(container: HTMLElement) {
  const zone = document.getElementById('browser-drop-zone');
  const input = container.querySelector<HTMLInputElement>('#browser-file-input');
  if (!zone) return;
  zone.addEventListener('click', () => input?.click());
  ['dragenter', 'dragover'].forEach(eventName => {
    zone.addEventListener(eventName, event => { event.preventDefault(); zone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(eventName => {
    zone.addEventListener(eventName, event => { event.preventDefault(); zone.classList.remove('dragover'); });
  });
  zone.addEventListener('drop', event => {
    const file = event.dataTransfer?.files[0];
    if (file) loadFileObj(file);
  });
}

function createActionButtons(container: HTMLElement) {
  const wrapper = createEl('div', 'browser-actions');
  const button = createEl('button', 'browser-btn primary');
  button.id = 'btn-load-file';
  button.textContent = '📂 Load File';
  wrapper.appendChild(button);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.conllu,.conll,.txt';
  input.hidden = true;
  input.id = 'browser-file-input';
  container.appendChild(input);

  button.addEventListener('click', () => input.click());
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
    fileInfoCache.clear();
    refreshHeadingAndListing();
  };
  reader.readAsText(file);
}

function createSortControl() {
  const wrap = createEl('div', 'browser-sort');
  const label = createEl('span', 'browser-sort-label');
  label.textContent = 'Sort by';
  wrap.appendChild(label);

  const select = document.createElement('select');
  select.className = 'browser-sort-select';
  for (const option of SORT_OPTIONS) {
    const element = document.createElement('option');
    element.value = option.key;
    element.textContent = option.label;
    element.selected = option.key === currentSort;
    select.appendChild(element);
  }
  select.addEventListener('change', () => {
    currentSort = select.value as SortKey;
    const url = routeUrl('browser', undefined, {
      authorId: activeAuthorId,
      browserSort: currentSort === DEFAULT_SORT ? undefined : currentSort,
    });
    history.replaceState(null, '', url);
    const listing = document.querySelector('.browser-listing');
    if (listing) listing.replaceWith(createListing());
  });
  wrap.appendChild(select);
  return wrap;
}

function createListing(): HTMLElement {
  const wrapper = createEl('div', 'browser-listing');
  if (!activeAuthorId) {
    wrapper.appendChild(createAuthorGrid());
    return wrapper;
  }

  const author = buildAuthorGroups().find(group => group.id === activeAuthorId);
  if (!author) {
    wrapper.innerHTML = `
      <div class="no-files">
        <div class="no-files-icon">📚</div>
        <p>Author not found.</p>
        <p><a href="${routeUrl('browser')}">Return to all authors</a></p>
      </div>`;
    return wrapper;
  }
  wrapper.appendChild(createFileGrid(sortFiles(author.files)));
  return wrapper;
}

function createAuthorGrid(): HTMLElement {
  const grid = createEl('div', 'author-grid');
  const authors = buildAuthorGroups();
  if (!authors.length) {
    grid.innerHTML = `
      <div class="no-files">
        <div class="no-files-icon">🌳</div>
        <p>No works loaded yet.</p>
        <p>Drop a .conllu file above or click Load File.</p>
      </div>`;
    return grid;
  }
  authors.forEach(author => grid.appendChild(createAuthorCard(author)));
  return grid;
}

function createAuthorCard(author: AuthorGroup): HTMLElement {
  const card = createEl('a', 'author-card') as HTMLAnchorElement;
  card.href = routeUrl('browser', undefined, {
    authorId: author.id,
    browserSort: currentSort === DEFAULT_SORT ? undefined : currentSort,
  });
  const mastery = author.totalTokens > 0 ? Math.round((author.mastered / author.totalTokens) * 100) : 0;
  card.innerHTML = `
    <div class="author-card-icon">✒</div>
    <div class="author-card-body">
      <div class="author-card-name">${escapeHTML(author.name)}</div>
      <div class="author-card-meta">${author.files.length} ${author.files.length === 1 ? 'work' : 'works'} · ${author.totalTokens} words</div>
      <div class="file-card-mastery"><div class="file-card-mastery-fill" style="width:${mastery}%"></div></div>
      <div class="file-card-stats">
        <span>✅ ${author.reviewed} reviewed</span>
        <span>🧠 ${author.mastered} mastered</span>
      </div>
      <div class="author-card-recent">${author.lastReviewed ? `Last reviewed ${escapeHTML(formatReviewDate(author.lastReviewed))}` : 'Not reviewed yet'}</div>
    </div>
    <div class="author-card-arrow">→</div>`;
  return card;
}

function createFileGrid(files: FileInfo[]): HTMLElement {
  const grid = createEl('div', 'file-grid');
  files.forEach(info => grid.appendChild(createFileCard(info)));
  return grid;
}

function formatReviewDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function createFileCard(info: FileInfo): HTMLElement {
  const { file } = info;
  const card = createEl('div', 'file-card');
  const fileMeta = info.displayTitle !== file.name ? `${escapeHTML(file.name)} · ` : '';
  card.innerHTML = `
    <div class="file-card-name">${escapeHTML(info.displayTitle)}</div>
    <div class="file-card-author">${fileMeta}${info.sentences} sentences · ${info.totalTokens} words</div>
    <div class="file-card-recent">${info.lastReviewed ? `Last reviewed ${escapeHTML(formatReviewDate(info.lastReviewed))}` : 'Not reviewed yet'}</div>
    <div class="file-card-mastery"><div class="file-card-mastery-fill" style="width:${info.masteryPct}%"></div></div>
    <div class="file-card-stats">
      <span>✅ ${info.reviewed} reviewed</span>
      <span>🧠 ${info.mastered} mastered (${info.masteryPct}%)</span>
    </div>
    <div class="file-card-actions">
      <button class="action-study" data-action="study">📝 Study</button>
      <button class="action-cram" data-action="cram">🔥 Cram</button>
      <button data-action="reader">📖 Read</button>
      <button data-action="browse">🌳 Browse</button>
      <button class="action-delete" data-action="delete">🗑️</button>
    </div>`;

  card.querySelector('[data-action="study"]')?.addEventListener('click', event => {
    event.stopPropagation();
    navigate('study', file.id, { studyMode: 'srs' });
  });
  card.querySelector('[data-action="cram"]')?.addEventListener('click', event => {
    event.stopPropagation();
    navigate('study', file.id, { studyMode: 'cram' });
  });
  card.querySelector('[data-action="reader"]')?.addEventListener('click', event => {
    event.stopPropagation();
    navigate('reader', file.id);
  });
  card.querySelector('[data-action="browse"]')?.addEventListener('click', event => {
    event.stopPropagation();
    navigate('tree', file.id);
  });
  card.querySelector('[data-action="delete"]')?.addEventListener('click', event => {
    event.stopPropagation();
    if (!confirm(`Delete "${info.displayTitle}"? This removes the file and all study progress.`)) return;
    store = loadStore();
    removeFile(store, file.id);
    saveStore(store);
    fileInfoCache.clear();
    refreshHeadingAndListing();
  });
  return card;
}
