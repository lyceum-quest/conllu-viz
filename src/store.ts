/**
 * Persistence layer — localStorage-backed session + file registry.
 */



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

export interface AppStore {
  files: Record<string, StoredFile>;
  sessions: Record<string, FileSession>;
}

const STORAGE_KEY = 'conllu-viz-store';

function emptyStore(): AppStore {
  return { files: {}, sessions: {} };
}

export function loadStore(): AppStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
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
import { parseConllu } from './types';

export function getAllTokenKeys(store: AppStore, fileId: string): string[] {
  const content = getStoredContent(store, fileId);
  if (!content) return [];
  const treebank = parseConllu(content, fileId);
  return treebank.sentences.flatMap(s =>
    s.tokens.map(t => makeTokenKey(s.id, t.id))
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
