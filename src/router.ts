/**
 * Simple hash-based router for the SPA.
 * Routes:
 *   #browser                           — conllu file browser (default)
 *   #tree:<fileId>                     — dependency tree view
 *   #study:<fileId>?sentences=…        — SRS study session
 *   #study:<fileId>?mode=cram&…        — cram session
 */

export type PageType = 'browser' | 'tree' | 'study';
export type StudyMode = 'srs' | 'cram';

export interface Route {
  page: PageType;
  fileId?: string;
  selectedSentences?: string[];
  hasSelectedSentences: boolean;
  studyMode: StudyMode;
}

export interface RouteOptions {
  selectedSentences?: Iterable<string>;
  studyMode?: StudyMode;
}

const SENTENCE_PARAM = 'sentences';
const MODE_PARAM = 'mode';
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
  const studyMode = params.get(MODE_PARAM) === 'cram' ? 'cram' : 'srs';

  if (pathPart.startsWith('tree:')) {
    return { page: 'tree', fileId: pathPart.slice(5), hasSelectedSentences, studyMode };
  }
  if (pathPart.startsWith('study:')) {
    return {
      page: 'study',
      fileId: pathPart.slice(6),
      selectedSentences,
      hasSelectedSentences,
      studyMode,
    };
  }
  return { page: 'browser', hasSelectedSentences: false, studyMode: 'srs' };
}

export function routeUrl(page: PageType, fileId?: string, options: RouteOptions = {}): string {
  if (page === 'browser') return '#browser';

  const base = fileId ? `#${page}:${fileId}` : `#${page}`;
  const params = new URLSearchParams();

  if (page === 'study') {
    if (options.studyMode === 'cram') params.set(MODE_PARAM, 'cram');
    if (options.selectedSentences !== undefined) {
      const selected = [...new Set(options.selectedSentences)];
      params.set(SENTENCE_PARAM, selected.join(SENTENCE_SEPARATOR));
    }
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function navigate(page: PageType, fileId?: string, options?: RouteOptions) {
  window.location.hash = routeUrl(page, fileId, options).slice(1);
}
