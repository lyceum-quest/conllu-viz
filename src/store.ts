/**
 * Persistence layer — localStorage-backed file/SRS state plus sessionStorage
 * study-progress resume data.
 */

import { parseConllu } from './types';
import type { StudyMode } from './router';

// ── Types ────────────────────────────────────────────────────────────────

export interface StoredFile {
  id: string;
  name: string;
  source: 'upload' | 'default';
  loadedAt: number;
  content: string;          // raw conllu text
}

export interface SRSState {
  interval: number;      // days (0 for cards in learning phase, or 0 for new cards)
  ease: number;          // easiness factor (default 2.5)
  reviews: number;
  nextReview: number;    // epoch ms — when the card is next due
  lapses: number;
  learningStep: number;  // current step in learning/relearning (0-based index)
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

const STORAGE_KEY = 'conllu-viz-store';
const STUDY_PROGRESS_STORAGE_KEY = 'conllu-viz-study-progress';

function emptyStore(): AppStore {
  return { files: {}, sessions: {}, studyPrefs: {} };
}

function normalizeStore(raw: Partial<AppStore> | null | undefined): AppStore {
  return {
    files: raw?.files ?? {},
    sessions: raw?.sessions ?? {},
    studyPrefs: raw?.studyPrefs ?? {},
  };
}

export function loadStore(): AppStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeStore(JSON.parse(raw));
  } catch { /* corrupt data, start fresh */ }
  return emptyStore();
}

export function saveStore(store: AppStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
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
