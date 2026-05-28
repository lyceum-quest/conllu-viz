import type { AppStore, StoredFile } from './store';

export interface PreloadFileEntry {
  id?: string;
  name: string;
  path: string;
  source?: StoredFile['source'];
}

export interface PreloadManifest {
  files: PreloadFileEntry[];
  retiredIds?: string[];
}

export interface PreloadResult {
  added: number;
  updated: number;
  removed: number;
  skipped: number;
}

export interface PreloadProgress {
  checked: number;
  total: number;
  currentPath?: string;
}

export type PreloadProgressCallback = (progress: PreloadProgress) => void;

const PRELOAD_MANIFEST_URL = '/preload/conllu-files.json';

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

function resolveManifestPath(path: string): string {
  return new URL(path, window.location.origin).toString();
}

export async function loadPreloadedFiles(store: AppStore, onProgress?: PreloadProgressCallback): Promise<PreloadResult> {
  const result: PreloadResult = { added: 0, updated: 0, removed: 0, skipped: 0 };

  let manifest: PreloadManifest;
  try {
    const res = await fetch(PRELOAD_MANIFEST_URL, { cache: 'no-cache' });
    if (res.status === 404) return result;
    if (!res.ok) throw new Error(`Failed to fetch preload manifest: ${res.status}`);
    manifest = await res.json() as PreloadManifest;
  } catch (err) {
    console.warn('[preload] unable to load preload manifest', err);
    return result;
  }

  for (const retiredId of manifest.retiredIds ?? []) {
    const existing = store.files[retiredId];
    if (existing?.source === 'default') {
      delete store.files[retiredId];
      delete store.sessions[retiredId];
      if (store.studyPrefs) delete store.studyPrefs[retiredId];
      result.removed++;
    }
  }

  const files = manifest.files ?? [];
  const total = files.length;
  let checked = 0;
  onProgress?.({ checked, total });

  for (const entry of files) {
    const currentPath = entry.path || entry.name;
    onProgress?.({ checked, total, currentPath });

    if (!entry.name || !entry.path) {
      result.skipped++;
      checked++;
      onProgress?.({ checked, total, currentPath });
      continue;
    }

    try {
      const id = entry.id || entry.name;
      const content = await fetchText(resolveManifestPath(entry.path));
      const existing = store.files[id];

      if (!existing) {
        store.files[id] = {
          id,
          name: entry.name,
          source: entry.source ?? 'default',
          loadedAt: Date.now(),
          content,
        };
        result.added++;
      } else if (existing.source === 'default' && existing.content !== content) {
        store.files[id] = {
          ...existing,
          name: entry.name,
          source: entry.source ?? existing.source,
          content,
        };
        result.updated++;
      } else {
        result.skipped++;
      }

      if (!store.sessions[id]) store.sessions[id] = { fileId: id, tokens: {} };
    } catch (err) {
      console.warn(`[preload] unable to preload ${entry.name}`, err);
      result.skipped++;
    }

    checked++;
    onProgress?.({ checked, total, currentPath });
  }

  return result;
}
