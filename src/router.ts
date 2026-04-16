/**
 * Simple hash-based router for the SPA.
 * Routes:
 *   #browser          — conllu file browser (default)
 *   #tree:<fileId>    — dependency tree view
 *   #study:<fileId>   — SRS study session
 */

export type PageType = 'browser' | 'tree' | 'study';

export interface Route {
  page: PageType;
  fileId?: string;
}

export function parseRoute(): Route {
  const hash = window.location.hash.slice(1); // strip "#"
  if (hash.startsWith('tree:')) {
    return { page: 'tree', fileId: hash.slice(5) };
  }
  if (hash.startsWith('study:')) {
    return { page: 'study', fileId: hash.slice(6) };
  }
  return { page: 'browser' };
}

export function routeUrl(page: PageType, fileId?: string): string {
  if (page === 'browser') return '#browser';
  if (fileId) return `#${page}:${fileId}`;
  return `#${page}`;
}

export function navigate(page: PageType, fileId?: string) {
  window.location.hash = page === 'browser' ? 'browser' : `${page}:${fileId}`;
}
