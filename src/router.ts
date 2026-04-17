/**
 * Simple hash-based router for the SPA.
 * Routes:
 *   #browser                    — conllu file browser (default)
 *   #tree:<fileId>              — dependency tree view
 *   #study:<fileId>?sentences=… — SRS study session
 */

export type PageType = 'browser' | 'tree' | 'study';

export interface Route {
  page: PageType;
  fileId?: string;
  selectedSentences?: string[];
  hasSelectedSentences: boolean;
}

export interface RouteOptions {
  selectedSentences?: Iterable<string>;
}

const SENTENCE_PARAM = 'sentences';
const SENTENCE_SEPARATOR = '|';

export function parseRoute(): Route {
  const hash = window.location.hash.slice(1); // strip "#"
  const [pathPart, queryString = ''] = hash.split('?');
  const params = new URLSearchParams(queryString);
  const hasSelectedSentences = params.has(SENTENCE_PARAM);
  const rawSelected = params.get(SENTENCE_PARAM) ?? '';
  const selectedSentences = hasSelectedSentences
    ? rawSelected.split(SENTENCE_SEPARATOR).filter(Boolean)
    : undefined;

  if (pathPart.startsWith('tree:')) {
    return { page: 'tree', fileId: pathPart.slice(5), hasSelectedSentences };
  }
  if (pathPart.startsWith('study:')) {
    return {
      page: 'study',
      fileId: pathPart.slice(6),
      selectedSentences,
      hasSelectedSentences,
    };
  }
  return { page: 'browser', hasSelectedSentences: false };
}

export function routeUrl(page: PageType, fileId?: string, options: RouteOptions = {}): string {
  if (page === 'browser') return '#browser';

  const base = fileId ? `#${page}:${fileId}` : `#${page}`;
  const params = new URLSearchParams();

  if (page === 'study' && options.selectedSentences !== undefined) {
    const selected = [...new Set(options.selectedSentences)];
    params.set(SENTENCE_PARAM, selected.join(SENTENCE_SEPARATOR));
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function navigate(page: PageType, fileId?: string, options?: RouteOptions) {
  window.location.hash = routeUrl(page, fileId, options).slice(1);
}
