/**
 * Simple hash-based router for the SPA.
 * Routes:
 *   #browser                           — conllu file browser (default)
 *   #tree:<fileId>                     — dependency tree view
 *   #reader:<fileId>                   — progressive reader view
 *   #study:<fileId>?sentences=…        — SRS study session
 *   #study:<fileId>?mode=cram&…        — cram session
 *   #global-study                      — due cards from every encountered work
 */

export type PageType = 'browser' | 'tree' | 'reader' | 'study' | 'global-study';
export type StudyMode = 'srs' | 'cram';

export interface Route {
  page: PageType;
  fileId?: string;
  selectedSentences?: string[];
  hasSelectedSentences: boolean;
  studyMode: StudyMode;
  targetSentence?: string;
  targetTokenId?: number;
  authorId?: string;
  browserSort?: string;
}

export interface RouteOptions {
  selectedSentences?: Iterable<string>;
  studyMode?: StudyMode;
  targetSentence?: string;
  targetTokenId?: number;
  authorId?: string;
  browserSort?: string;
}

const SENTENCE_PARAM = 'sentences';
const MODE_PARAM = 'mode';
const SENTENCE_SEPARATOR = '|';

function decodeFileId(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

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
  const targetSentence = params.get('sentence') || undefined;
  const rawTargetToken = params.get('token');
  const targetTokenId = rawTargetToken && /^\d+$/.test(rawTargetToken)
    ? Number(rawTargetToken)
    : undefined;
  const authorId = params.get('author') || undefined;
  const browserSort = params.get('sort') || undefined;

  if (pathPart === 'global-study') {
    return { page: 'global-study', hasSelectedSentences: false, studyMode: 'srs' };
  }
  if (pathPart.startsWith('tree:')) {
    return { page: 'tree', fileId: decodeFileId(pathPart.slice(5)), hasSelectedSentences, studyMode };
  }
  if (pathPart.startsWith('reader:')) {
    return {
      page: 'reader',
      fileId: decodeFileId(pathPart.slice(7)),
      hasSelectedSentences,
      studyMode,
      targetSentence,
      targetTokenId,
    };
  }
  if (pathPart.startsWith('study:')) {
    return {
      page: 'study',
      fileId: decodeFileId(pathPart.slice(6)),
      selectedSentences,
      hasSelectedSentences,
      studyMode,
    };
  }
  return { page: 'browser', hasSelectedSentences: false, studyMode: 'srs', authorId, browserSort };
}

export function routeUrl(page: PageType, fileId?: string, options: RouteOptions = {}): string {
  if (page === 'global-study') return '#global-study';

  const base = fileId ? `#${page}:${encodeURIComponent(fileId)}` : `#${page}`;
  const params = new URLSearchParams();

  if (page === 'browser') {
    if (options.authorId) params.set('author', options.authorId);
    if (options.browserSort) params.set('sort', options.browserSort);
  } else if (page === 'study') {
    if (options.studyMode === 'cram') params.set(MODE_PARAM, 'cram');
    if (options.selectedSentences !== undefined) {
      const selected = [...new Set(options.selectedSentences)];
      params.set(SENTENCE_PARAM, selected.join(SENTENCE_SEPARATOR));
    }
  } else if (page === 'reader') {
    if (options.targetSentence) params.set('sentence', options.targetSentence);
    if (options.targetTokenId !== undefined) params.set('token', String(options.targetTokenId));
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function navigate(page: PageType, fileId?: string, options?: RouteOptions) {
  window.location.hash = routeUrl(page, fileId, options).slice(1);
}
