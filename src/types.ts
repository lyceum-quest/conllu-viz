/**
 * CoNLL-U Parser
 * Parses CoNLL-U format into typed Treebank data model.
 */

export interface FeatureMap {
  [key: string]: string;
}

export interface MiscMap {
  [key: string]: string;
}

export interface Token {
  id: number;
  form: string;
  lemma: string;
  upos: string;
  xpos?: string;
  feats?: FeatureMap;
  head: number;
  deprel: string;
  deps?: string;
  misc?: MiscMap;
  /** Token-level gloss/translation (from MISC gloss=…) */
  gloss?: string;
}

export interface SentenceTranslation {
  lang: string;
  prose: string;
  literal: string;
}

export interface Sentence {
  id: string;
  text: string;
  tokens: Token[];
  /** Parallel collection ID (from # parallel_id) */
  parallelId?: string;
  /** Per-sentence translations keyed by language code */
  translations: Record<string, SentenceTranslation>;
}

export interface Treebank {
  sentences: Sentence[];
  source?: string;
  /** Work/document title (from # title = …) */
  title?: string;
  /** Languages that have translations in this treebank */
  translationLangs: string[];
}

function parseFeats(featsStr: string): FeatureMap | undefined {
  if (!featsStr || featsStr === '_') return undefined;
  const map: FeatureMap = {};
  for (const pair of featsStr.split('|')) {
    const eq = pair.indexOf('=');
    if (eq > 0) map[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return map;
}

function parseMisc(miscStr: string): MiscMap | undefined {
  if (!miscStr || miscStr === '_') return undefined;
  const map: MiscMap = {};
  for (const pair of miscStr.split('|')) {
    const eq = pair.indexOf('=');
    if (eq > 0) map[pair.slice(0, eq)] = pair.slice(eq + 1);
    else map[pair] = '';
  }
  return map;
}

export function parseConllu(content: string, source?: string): Treebank {
  const sentences: Sentence[] = [];
  const translationLangs = new Set<string>();
  const normalized = content.replace(/\r\n/g, '\n').trim();
  const title = normalized.match(/^#\s+title\s*=\s*(.*)$/m)?.[1]?.trim() || undefined;
  // Normalize line endings and split on blank lines
  const blocks = normalized.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    const tokens: Token[] = [];
    let sentId = '';
    let sentText = '';
    let parallelId = '';
    let transLang = '';
    let proseTranslation = '';
    let literalTranslation = '';

    for (const line of lines) {
      if (line.startsWith('#')) {
        const mId = line.match(/^#\s+sent_id\s*=\s*(.*)/);
        if (mId) sentId = mId[1];
        const mText = line.match(/^#\s+text\s*=\s*(.*)/);
        if (mText) sentText = mText[1];
        const mPar = line.match(/^#\s+parallel_id\s*=\s*(.*)/);
        if (mPar) parallelId = mPar[1];
        const mTLang = line.match(/^#\s+translation_lang\s*=\s*(.*)/);
        if (mTLang) transLang = mTLang[1];
        const mProse = line.match(/^#\s+prose_translation\s*=\s*(.*)/);
        if (mProse) proseTranslation = mProse[1];
        const mLiteral = line.match(/^#\s+literal_translation\s*=\s*(.*)/);
        if (mLiteral) literalTranslation = mLiteral[1];
        continue;
      }
      const parts = line.split('\t');
      if (parts.length < 10) continue;
      if (!/^\d+$/.test(parts[0])) continue; // skip ranges like "1-2"

      const misc = parseMisc(parts[9]);
      // Extract gloss from MISC: prefer explicit gloss=, else free-form text
      let gloss: string | undefined = misc?.gloss;
      if (!gloss && misc) {
        const miscValues = Object.entries(misc).filter(([k]) => k !== 'gloss');
        if (miscValues.length === 1) {
          const [rawKey, rawVal] = miscValues[0];
          // If it has an equals sign, treat right side as gloss
          const eq = rawKey.indexOf('=');
          if (eq > 0) gloss = rawKey.slice(eq + 1).trim();
          // Otherwise treat the whole key as gloss text
          else if (rawVal === '' && rawKey) gloss = rawKey;
        }
      }

      tokens.push({
        id: parseInt(parts[0], 10),
        form: parts[1],
        lemma: parts[2],
        upos: parts[3],
        xpos: parts[4] !== '_' ? parts[4] : undefined,
        feats: parseFeats(parts[5]),
        head: parseInt(parts[6], 10),
        deprel: parts[7],
        deps: parts[8] !== '_' ? parts[8] : undefined,
        misc,
        gloss,
      });
    }

    if (tokens.length > 0) {
      const translations: Record<string, SentenceTranslation> = {};
      if (transLang && (proseTranslation || literalTranslation)) {
        translations[transLang] = {
          lang: transLang,
          prose: proseTranslation,
          literal: literalTranslation,
        };
        translationLangs.add(transLang);
      }

      sentences.push({
        id: sentId || `s${sentences.length + 1}`,
        text: sentText,
        tokens,
        parallelId: parallelId || undefined,
        translations,
      });
    }
  }

  return { sentences, source, title, translationLangs: [...translationLangs] };
}

export function collectLegend(treebank: Treebank): { pos: Set<string>; deprels: Set<string> } {
  const pos = new Set<string>();
  const deprels = new Set<string>();
  for (const sent of treebank.sentences) {
    for (const t of sent.tokens) {
      pos.add(t.upos);
      deprels.add(t.deprel);
    }
  }
  return { pos, deprels };
}