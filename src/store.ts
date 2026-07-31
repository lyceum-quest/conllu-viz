/**
 * Persistence layer.
 *
 * Corpus file content lives in browser-native IndexedDB so large treebanks do
 * not blow through localStorage quota or block the UI during every save.
 * Lightweight metadata, SRS state, study prefs, and sessionStorage resume data
 * stay in Web Storage for simplicity.
 */

import { parseConllu } from './types';
import type { StudyMode } from './router';

// ── Types ────────────────────────────────────────────────────────────────

export interface StoredFile {
  id: string;
  name: string;
  source: 'upload' | 'default';
  loadedAt: number;
  content: string;          // raw conllu text, hydrated from IndexedDB at startup
}

interface StoredFileMeta extends Omit<StoredFile, 'content'> {
  content?: string;         // present only in legacy localStorage stores
}

interface FileContentRecord {
  id: string;
  content: string;
}

export interface SRSState {
  interval: number;      // days (0 for cards in learning phase, or 0 for new cards)
  ease: number;          // easiness factor (default 2.5)
  reviews: number;
  nextReview: number;    // epoch ms — when the card is next due
  lapses: number;
  learningStep: number;  // current step in learning/relearning (0-based index)
  /** Cumulative history fields are optional for compatibility with existing localStorage data. */
  firstSeen?: number;
  lastReviewed?: number;
  totalReviews?: number;
  lastRating?: number;
  ratingCounts?: Partial<Record<1 | 2 | 3 | 4, number>>;
}

export interface FileSession {
  fileId: string;
  /** key = "<sentId>:<tokenId>" */
  tokens: Record<string, SRSState>;
  lastReview?: number;
}

export interface StudyPrefs {
  selectedSentences: string[];
  updatedAt: number;
}

export interface SavedStudyProgress {
  fileId: string;
  mode: StudyMode;
  selectedSentences: string[];
  queue: string[];
  currentIdx: number;
  sessionTotal: number;
  reviewedCount: number;
  totalTimeMs: number;
  updatedAt: number;
}

export interface AppStore {
  files: Record<string, StoredFile>;
  sessions: Record<string, FileSession>;
  studyPrefs?: Record<string, StudyPrefs>;
}

interface PersistedAppStore {
  files: Record<string, StoredFileMeta>;
  sessions: Record<string, FileSession>;
  studyPrefs?: Record<string, StudyPrefs>;
}

const STORAGE_KEY = 'conllu-viz-store';
const STUDY_PROGRESS_STORAGE_KEY = 'conllu-viz-study-progress';
const DB_NAME = 'conllu-viz-db';
const DB_VERSION = 1;
const FILE_CONTENT_STORE = 'fileContents';

let currentStore: AppStore = emptyStore();
let dbPromise: Promise<IDBDatabase | null> | null = null;
let initialized = false;
let useIndexedDB = typeof indexedDB !== 'undefined';
let persistedFileContentIds = new Set<string>();
let persistedFileContentCache: Record<string, string> = {};

function emptyStore(): AppStore {
  return { files: {}, sessions: {}, studyPrefs: {} };
}

function normalizePersistedStore(raw: Partial<PersistedAppStore> | null | undefined): PersistedAppStore {
  return {
    files: raw?.files ?? {},
    sessions: raw?.sessions ?? {},
    studyPrefs: raw?.studyPrefs ?? {},
  };
}

function normalizeRuntimeStore(raw: Partial<AppStore> | null | undefined): AppStore {
  return {
    files: raw?.files ?? {},
    sessions: raw?.sessions ?? {},
    studyPrefs: raw?.studyPrefs ?? {},
  };
}

function readPersistedStore(): PersistedAppStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizePersistedStore(JSON.parse(raw));
  } catch { /* corrupt data, start fresh */ }
  return { files: {}, sessions: {}, studyPrefs: {} };
}

function toPersistedStore(store: AppStore): PersistedAppStore {
  const files: Record<string, StoredFileMeta> = {};
  for (const [id, file] of Object.entries(store.files)) {
    files[id] = {
      id: file.id,
      name: file.name,
      source: file.source,
      loadedAt: file.loadedAt,
      ...(useIndexedDB ? {} : { content: file.content }),
    };
  }
  return {
    files,
    sessions: store.sessions,
    studyPrefs: store.studyPrefs ?? {},
  };
}

function saveMetadata(store: AppStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistedStore(store)));
}

function openDB(): Promise<IDBDatabase | null> {
  if (!useIndexedDB) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_CONTENT_STORE)) {
        db.createObjectStore(FILE_CONTENT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[store] IndexedDB unavailable; falling back to localStorage for file content', request.error);
      useIndexedDB = false;
      resolve(null);
    };
    request.onblocked = () => {
      console.warn('[store] IndexedDB upgrade blocked by another tab');
    };
  });

  return dbPromise;
}

async function idbGetAllFiles(): Promise<Record<string, string>> {
  const db = await openDB();
  if (!db) return {};

  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_CONTENT_STORE, 'readonly');
    const store = tx.objectStore(FILE_CONTENT_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const files: Record<string, string> = {};
      for (const record of req.result as FileContentRecord[]) {
        files[record.id] = record.content;
      }
      resolve(files);
    };
    req.onerror = () => reject(req.error);
  });
}

async function idbPutFile(id: string, content: string): Promise<void> {
  const db = await openDB();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_CONTENT_STORE, 'readwrite');
    tx.objectStore(FILE_CONTENT_STORE).put({ id, content } satisfies FileContentRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDeleteFile(id: string): Promise<void> {
  const db = await openDB();
  if (!db) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILE_CONTENT_STORE, 'readwrite');
    tx.objectStore(FILE_CONTENT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function syncFileContentsToIndexedDB(store: AppStore) {
  if (!useIndexedDB) return;
  try {
    const wantedIds = new Set(Object.keys(store.files));

    await Promise.all(Object.values(store.files)
      .filter((file) => persistedFileContentCache[file.id] !== file.content)
      .map(async (file) => {
        await idbPutFile(file.id, file.content);
        persistedFileContentIds.add(file.id);
        persistedFileContentCache[file.id] = file.content;
      }));

    await Promise.all([...persistedFileContentIds]
      .filter((id) => !wantedIds.has(id))
      .map(async (id) => {
        await idbDeleteFile(id);
        persistedFileContentIds.delete(id);
        delete persistedFileContentCache[id];
      }));
  } catch (err) {
    console.warn('[store] unable to sync file content to IndexedDB', err);
  }
}

/**
 * Must run once before mounting routes. It hydrates file content from IndexedDB
 * and migrates legacy localStorage content into IndexedDB when present.
 */
export async function initStore(): Promise<AppStore> {
  const persisted = readPersistedStore();
  const idbFiles: Record<string, string> = useIndexedDB ? await idbGetAllFiles().catch((err): Record<string, string> => {
    console.warn('[store] unable to read IndexedDB files; falling back to localStorage content', err);
    useIndexedDB = false;
    return {};
  }) : {};

  persistedFileContentIds = new Set(Object.keys(idbFiles));
  persistedFileContentCache = { ...idbFiles };

  const files: Record<string, StoredFile> = {};
  for (const [id, meta] of Object.entries(persisted.files)) {
    const content = idbFiles[id] ?? meta.content ?? '';
    files[id] = {
      id: meta.id ?? id,
      name: meta.name ?? id,
      source: meta.source ?? 'upload',
      loadedAt: meta.loadedAt ?? Date.now(),
      content,
    };
  }

  currentStore = normalizeRuntimeStore({
    files,
    sessions: persisted.sessions,
    studyPrefs: persisted.studyPrefs,
  });

  initialized = true;

  if (useIndexedDB) {
    await syncFileContentsToIndexedDB(currentStore);
    saveMetadata(currentStore); // strips legacy content from localStorage after migration
  }

  return currentStore;
}

export function loadStore(): AppStore {
  if (initialized) return currentStore;

  // Fallback for tests or unusual import paths that call loadStore before initStore.
  const persisted = readPersistedStore();
  const files: Record<string, StoredFile> = {};
  for (const [id, meta] of Object.entries(persisted.files)) {
    files[id] = {
      id: meta.id ?? id,
      name: meta.name ?? id,
      source: meta.source ?? 'upload',
      loadedAt: meta.loadedAt ?? Date.now(),
      content: meta.content ?? '',
    };
  }
  currentStore = normalizeRuntimeStore({ files, sessions: persisted.sessions, studyPrefs: persisted.studyPrefs });
  return currentStore;
}

export function saveStore(store: AppStore) {
  currentStore = store;
  saveMetadata(store);
  void syncFileContentsToIndexedDB(store);
}

// ── File helpers ─────────────────────────────────────────────────────────

export function addFile(store: AppStore, name: string, content: string, source: StoredFile['source']): AppStore {
  const id = name;
  if (store.files[id]) {
    // Update content but keep session
    store.files[id] = { ...store.files[id], content, loadedAt: Date.now() };
  } else {
    store.files[id] = { id, name, source, loadedAt: Date.now(), content };
  }
  if (!store.sessions[id]) {
    store.sessions[id] = { fileId: id, tokens: {} };
  }
  return store;
}

export function getStoredContent(store: AppStore, fileId: string): string | null {
  return store.files[fileId]?.content ?? null;
}

export function listFiles(store: AppStore): StoredFile[] {
  return Object.values(store.files).sort((a, b) => b.loadedAt - a.loadedAt);
}

export function removeFile(store: AppStore, fileId: string): AppStore {
  delete store.files[fileId];
  delete store.sessions[fileId];
  if (store.studyPrefs) delete store.studyPrefs[fileId];
  return store;
}

export function hasSession(store: AppStore, fileId: string): boolean {
  return !!(store.files[fileId] && store.sessions[fileId]);
}

export function ensureFileSession(store: AppStore, fileId: string): FileSession {
  if (!store.sessions[fileId]) {
    store.sessions[fileId] = { fileId, tokens: {} };
  }
  return store.sessions[fileId];
}

// ── Study prefs + session progress ───────────────────────────────────────

function normalizeSelectedSentences(selectedSentences: Iterable<string>): string[] {
  return [...new Set(selectedSentences)];
}

function studyProgressKey(fileId: string, mode: StudyMode, selectedSentences: Iterable<string>): string {
  return `${fileId}\u0000${mode}\u0000${[...new Set(selectedSentences)].sort().join('\u0001')}`;
}

function loadStudyProgressMap(): Record<string, SavedStudyProgress> {
  try {
    const raw = sessionStorage.getItem(STUDY_PROGRESS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, SavedStudyProgress>;
  } catch { /* corrupt data, start fresh */ }
  return {};
}

function saveStudyProgressMap(map: Record<string, SavedStudyProgress>) {
  sessionStorage.setItem(STUDY_PROGRESS_STORAGE_KEY, JSON.stringify(map));
}

export function getStudySelection(store: AppStore, fileId: string): string[] | null {
  return store.studyPrefs?.[fileId]?.selectedSentences ?? null;
}

export function setStudySelection(store: AppStore, fileId: string, selectedSentences: Iterable<string>) {
  if (!store.studyPrefs) store.studyPrefs = {};
  store.studyPrefs[fileId] = {
    selectedSentences: normalizeSelectedSentences(selectedSentences),
    updatedAt: Date.now(),
  };
}

export function loadStudyProgress(fileId: string, mode: StudyMode, selectedSentences: Iterable<string>): SavedStudyProgress | null {
  const map = loadStudyProgressMap();
  return map[studyProgressKey(fileId, mode, selectedSentences)] ?? null;
}

export function saveStudyProgress(progress: SavedStudyProgress) {
  const map = loadStudyProgressMap();
  map[studyProgressKey(progress.fileId, progress.mode, progress.selectedSentences)] = {
    ...progress,
    selectedSentences: normalizeSelectedSentences(progress.selectedSentences),
  };
  saveStudyProgressMap(map);
}

export function clearStudyProgress(fileId: string, mode: StudyMode, selectedSentences: Iterable<string>) {
  const map = loadStudyProgressMap();
  delete map[studyProgressKey(fileId, mode, selectedSentences)];
  saveStudyProgressMap(map);
}

/** Reset a work's SRS history without deleting its source file or reading preferences. */
export function resetFileStudyHistory(store: AppStore, fileId: string) {
  if (!store.files[fileId]) return;
  store.sessions[fileId] = { fileId, tokens: {} };

  const progress = loadStudyProgressMap();
  for (const [key, saved] of Object.entries(progress)) {
    if (saved.fileId === fileId) delete progress[key];
  }
  saveStudyProgressMap(progress);
}

// ── SRS state helpers ───────────────────────────────────────────────────
/**
 * Key format: "<sentId>:<tokenId>"
 */
export function makeTokenKey(sentId: string, tokenId: number): string {
  return `${sentId}:${tokenId}`;
}

export function parseTokenKey(key: string): { sentId: string; tokenId: number } {
  const colon = key.lastIndexOf(':');
  return { sentId: key.slice(0, colon), tokenId: parseInt(key.slice(colon + 1), 10) };
}

/**
 * Collect all unique token keys from a file's content for SRS tracking.
 * We use the conllu parser to get sentence ids and token ids.
 */
export function getAllTokenKeys(store: AppStore, fileId: string): string[] {
  const content = getStoredContent(store, fileId);
  if (!content) return [];
  const treebank = parseConllu(content, fileId);
  return treebank.sentences.flatMap(s =>
    s.tokens
      .filter(t => t.upos !== 'PUNCT')
      .map(t => makeTokenKey(s.id, t.id))
  );
}

/**
 * How many cards have been reviewed at least once?
 */
export function getReviewedCount(session: FileSession): number {
  return Object.values(session.tokens).filter(t => t.reviews > 0).length;
}

/**
 * How many cards have been reviewed and know the answer (interval >= 3 days)?
 */
export function getMasteredCount(session: FileSession): number {
  return Object.values(session.tokens).filter(t => t.interval >= 3).length;
}

export function getMasteryPct(session: FileSession, total: number): number {
  return total > 0 ? Math.round((getMasteredCount(session) / total) * 100) : 0;
}
