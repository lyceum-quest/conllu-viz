/**
 * Ancient Greek Morphological Segmenter
 *
 * Breaks Greek word forms into morpheme segments colored by the
 * grammatical feature(s) each segment encodes.
 *
 * Strategy: right-to-left layer stripping on an accent-stripped version
 * of the word, then map segment boundaries back to the original text.
 */

import { FeatureMap } from './types';

export interface WordSegment {
  text: string;
  type:
    | 'stem'
    | 'augment'
    | 'thematic'
    | 'tense'
    | 'voice'
    | 'participle'
    | 'nominalEnd'
    | 'personalEnd';
  encodes: string[];
  color: string;
}

export const SEGMENT_COLORS: Record<string, string> = {
  stem: '#ffffff',
  augment: '#e06c75',
  thematic: '#e0af68',
  tense: '#7dcfff',
  voice: '#ff9e64',
  participle: '#f7768e',
  nominalEnd: '#bb9af7',
  personalEnd: '#bb9af7',
};

// Map feature category names → the segment type that encodes them.
// Used by morpho.ts to derive category colors from SEGMENT_COLORS,
// keeping sidebar colors in sync with word-segment colors.
export const SEGMENT_CATEGORY_MAP: Record<string, string> = {
  VerbForm:   'participle',
  Tense:      'augment',
  Aspect:     'participle',
  Voice:      'voice',
  Mood:       'personalEnd',
  Number:     'nominalEnd',
  Gender:     'nominalEnd',
  Case:       'nominalEnd',
  Degree:     'stem',
  Definite:   'stem',
  Polarity:   'stem',
  PronType:   'stem',
  Person:     'personalEnd',
  Poss:       'stem',
  Animacy:    'stem',
  Reflex:     'stem',
  Clitic:     'personalEnd',
  VerbType:   'stem',
  PartForm:   'participle',
  Connegative:'stem',
  Evident:    'stem',
  Foreign:    'stem',
};

/** Derive a category's color from the segment that encodes it. */
export function segmentCategoryColor(category: string): string {
  const segType = SEGMENT_CATEGORY_MAP[category];
  return segType ? (SEGMENT_COLORS[segType] || '#c0caf5') : '#c0caf5';
}

// ── Greek text utilities ─────────────────────────────────────────────────

/**
 * Strip Greek combining diacritics (U+0300–U+036F).
 * Returns a string of base characters only.
 */
function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Build a map: for each base-character index in the stripped string,
 * gives the starting code-point index in the original NFC string.
 *
 * E.g. for "ὀν":
 *   NFC  = [ὀ(U+1F40), ν] → 2 code points
 *   NFD = [ο, ̓, ν]        → 3 code points
 *   stripped = [ο, ν]       → 2 chars
 *   basePositions[0] = 0 (ὀ starts at cp 0)
 *   basePositions[1] = 1 (ν starts at cp 1)
 */
function buildBasePositions(original: string): number[] {
  const nfd = original.normalize('NFD');
  const positions: number[] = [];
  let nfcCpIdx = 0;

  for (let i = 0; i < nfd.length; i++) {
    const code = nfd.charCodeAt(i);
    // Skip combining marks — they belong to the current NFC code point
    if (code >= 0x0300 && code <= 0x036f) continue;
    // This is a base character
    positions.push(nfcCpIdx);
    nfcCpIdx++;
  }

  // Account for the code point after the last base char
  positions.push(nfcCpIdx);

  return positions;
}

// ── Suffix pattern tables ─────────────────────────────────────────────────

interface SuffixPat {
  suffix: string;
  type: string;
  encodes: string[];
}

// Longest-first ordering (already sorted by suffix length)
const NOMINAL_ENDINGS: SuffixPat[] = [
  { suffix: 'μένων', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'μενων', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'οις', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'αις', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ους', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ας', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ης', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ων', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ην', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ου', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ον', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ος', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'οι', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ες', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'σι', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'α', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'η', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ω', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ς', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ν', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ι', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
  { suffix: 'ε', type: 'nominalEnd', encodes: ['Case', 'Gender', 'Number'] },
];

const VERB_MARKERS: SuffixPat[] = [
  // Middle/passive participle stem
  { suffix: 'μενων', type: 'participle', encodes: ['VerbForm', 'Voice'] },
  { suffix: 'μένων', type: 'participle', encodes: ['VerbForm', 'Voice'] },
  { suffix: 'μεν', type: 'participle', encodes: ['VerbForm', 'Voice', 'Aspect'] },
  // Active participle
  { suffix: 'ντων', type: 'participle', encodes: ['VerbForm'] },
  { suffix: 'ντας', type: 'participle', encodes: ['VerbForm'] },
  { suffix: 'ντες', type: 'participle', encodes: ['VerbForm'] },
  { suffix: 'ντος', type: 'participle', encodes: ['VerbForm'] },
  { suffix: 'ντη', type: 'participle', encodes: ['VerbForm'] },
  { suffix: 'ντ', type: 'participle', encodes: ['VerbForm'] },
  // Passive voice
  { suffix: 'θην', type: 'voice', encodes: ['Voice'] },
  { suffix: 'θε', type: 'voice', encodes: ['Voice'] },
  { suffix: 'θ', type: 'voice', encodes: ['Voice'] },
  // Sigmatic (future/aorist)
  { suffix: 'σ', type: 'tense', encodes: ['Tense'] },
  // Perfect
  { suffix: 'κ', type: 'tense', encodes: ['Tense', 'Aspect'] },
];

const THEMATIC_VOWELS: SuffixPat[] = [
  { suffix: 'ου', type: 'thematic', encodes: [] },
  { suffix: 'ο', type: 'thematic', encodes: [] },
  { suffix: 'ε', type: 'thematic', encodes: [] },
];

const ENDINGS_INDICATIVE: SuffixPat[] = [
  // ── Present ──
  { suffix: 'ουσιν', type: 'personalEnd', encodes: ['Person', 'Number'] },   // 3pl act.
  { suffix: 'ουσι', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 3pl act. (short)
  { suffix: 'ονται', type: 'personalEnd', encodes: ['Person', 'Number'] },    // 3pl mid.
  { suffix: 'ομεθα', type: 'personalEnd', encodes: ['Person', 'Number'] },    // 1pl mid.
  { suffix: 'ομεν', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 1pl act.
  { suffix: 'εσθε', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 2pl mid/act.
  { suffix: 'εις', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 2sg act.
  { suffix: 'ετε', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 2pl act.
  { suffix: 'ει', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 3sg act.
  { suffix: 'ες', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 3sg act. (short)
  { suffix: 'ε', type: 'personalEnd', encodes: ['Person', 'Number'] },        // 3sg pres
  { suffix: 'ον', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 3pl impf / 1sg impf
  { suffix: 'ω', type: 'personalEnd', encodes: ['Person', 'Number'] },        // 1sg act. pres
  // ── Imperfect ──
  { suffix: 'ην', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 1sg impf
  { suffix: 'ες', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 2sg impf
  { suffix: 'εν', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 3sg impf
  // ── Imperfect middle ──
  { suffix: 'μην', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 1sg impf mid.
  { suffix: 'σο', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 2sg impf mid.
  { suffix: 'το', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 3sg impf mid.
  { suffix: 'μεθα', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 1pl impf mid.
  { suffix: 'σθε', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 2pl impf mid.
  { suffix: 'ντο', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 3pl impf mid.
  // ── Perfect middle/passive ──
  { suffix: 'νται', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 3pl perf mid
  { suffix: 'μαι', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 1sg perf mid
  { suffix: 'σαι', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 2sg perf mid
  { suffix: 'ται', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 3sg perf mid
  { suffix: 'μα', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 1sg perf (short)
  // ── Aorist active ──
  { suffix: 'αν', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 3pl aor. act.
  { suffix: 'α', type: 'personalEnd', encodes: ['Person', 'Number'] },        // 1/3sg aor. act.
  { suffix: 'ας', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 2sg aor. act.
  // ── Aorist middle ──
  { suffix: 'αμην', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 1sg aor. mid.
  { suffix: 'ασο', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 2sg aor. mid.
  { suffix: 'ατο', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 3sg aor. mid.
  { suffix: 'μεθα', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 1pl aor. mid.
  { suffix: 'ασθε', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 2pl aor. mid.
  { suffix: 'αντο', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 3pl aor. mid.
  // ── Aorist passive ──
  { suffix: 'ην', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 1sg aor. pass.
  { suffix: 'ης', type: 'personalEnd', encodes: ['Person', 'Number'] },       // 2sg aor. pass.
  { suffix: 'η', type: 'personalEnd', encodes: ['Person', 'Number'] },        // 3sg aor. pass.
  { suffix: 'ημεν', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 1pl aor. pass.
  { suffix: 'ητε', type: 'personalEnd', encodes: ['Person', 'Number'] },      // 2pl aor. pass.
  { suffix: 'ησαν', type: 'personalEnd', encodes: ['Person', 'Number'] },     // 3pl aor. pass.
];

const ENDINGS_SUBJUNCTIVE: SuffixPat[] = [
  { suffix: 'ωσι', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'ωμ', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'ητε', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'ησι', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'ης', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'η', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'ως', type: 'personalEnd', encodes: ['Person', 'Number'] },
];

const ENDINGS_OPTATIVE: SuffixPat[] = [
  { suffix: 'ευ', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'οιμι', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'οιμεν', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'οιτε', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'οιεν', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'οις', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'οι', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'ειη', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'ειην', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'ειης', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'ειημεν', type: 'personalEnd', encodes: ['Person', 'Number'] },
];

const ENDINGS_IMPERATIVE: SuffixPat[] = [
  { suffix: 'ντων', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'θων', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'τε', type: 'personalEnd', encodes: ['Person', 'Number'] },
  { suffix: 'τω', type: 'personalEnd', encodes: ['Person', 'Number'] },
];

const ENDINGS_INFINITIVE: SuffixPat[] = [
  { suffix: 'σθαι', type: 'personalEnd', encodes: ['Voice'] },
  { suffix: 'ειν', type: 'personalEnd', encodes: [] },
  { suffix: 'ουν', type: 'personalEnd', encodes: [] }, // contracted -οῦν
  { suffix: 'αν', type: 'personalEnd', encodes: [] },  // contracted -ᾶν
  { suffix: 'ιν', type: 'personalEnd', encodes: [] },
  { suffix: 'ναι', type: 'personalEnd', encodes: [] },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function matchSuffix(
  text: string,
  patterns: SuffixPat[],
  minStem: number,
): { len: number; type: string; encodes: string[] } | null {
  for (const p of patterns) {
    if (text.endsWith(p.suffix)) {
      const stemLen = text.length - p.suffix.length;
      if (stemLen >= minStem) {
        return { len: p.suffix.length, type: p.type, encodes: [...p.encodes] };
      }
    }
  }
  return null;
}

function matchAugment(text: string, minStem: number): number {
  if (text.startsWith('ηκε') && text.length - 3 >= minStem) return 3;
  if (text.startsWith('ηκ') && text.length - 2 >= minStem) return 2;
  if (text.startsWith('ει') && text.length - 2 >= minStem) return 2;
  if (text.startsWith('η') && text.length - 1 >= minStem) return 1;
  if (text.startsWith('ε') && text.length - 1 >= minStem) return 1;
  return 0;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Segment a Greek word into morpheme spans.
 * Returns segments in LEFT-to-RIGHT order with original text preserved.
 */
export function segmentGreekWord(
  form: string,
  feats: FeatureMap | undefined,
  upos: string,
): WordSegment[] {
  if (!form || form.length === 0) return [];

  const stripped = stripDiacritics(form);
  const nChars = stripped.length;
  const basePos = buildBasePositions(form);
  // basePos has nChars+1 entries: basePos[nChars] = total NFC code points

  // Segments in stripped-index space: [start, end)
  interface RawSeg {
    s: number;
    e: number;
    type: string;
    encodes: string[];
  }
  const raw: RawSeg[] = [];

  let lo = 0;
  let hi = nChars;

  const isVerb = upos === 'VERB';
  // Support both UD conventions where VerbForm can be Part/VFin/VInf or Fin/Inf
  // and where Mood=Part/Inf is used instead.
  const vform = feats?.VerbForm;
  const isPart = isVerb && (vform === 'Part' || feats?.Mood === 'Part');
  const isFin = isVerb && (
    vform === 'VFin' || vform === 'Fin' ||
    feats?.Mood === 'Ind' || feats?.Mood === 'Sub' ||
    feats?.Mood === 'Opt' || feats?.Mood === 'Imp'
  );
  const isInf = isVerb && (vform === 'VInf' || feats?.Mood === 'Inf');
  // Support Tense=Past, Tense=Pqp, AND Tense=Imp (imperfect) for past-like forms
  const isPast = feats?.Tense === 'Past' || feats?.Tense === 'Pqp' || feats?.Tense === 'Imp' || feats?.Tense === 'Aor';
  const isNominal =
    !isVerb && ['NOUN', 'ADJ', 'DET', 'PRON', 'PROPN'].includes(upos);

  if (isPart) {
    // Outermost → innermost
    const m3 = matchSuffix(stripped.slice(lo, hi), NOMINAL_ENDINGS, 1);
    if (m3) {
      hi -= m3.len;
      raw.push({ s: hi, e: hi + m3.len, type: m3.type, encodes: m3.encodes });
    }
    const m2 = matchSuffix(stripped.slice(lo, hi), VERB_MARKERS, 1);
    if (m2) {
      hi -= m2.len;
      raw.push({ s: hi, e: hi + m2.len, type: m2.type, encodes: m2.encodes });
    }
    const m1 = matchSuffix(stripped.slice(lo, hi), THEMATIC_VOWELS, 1);
    if (m1) {
      hi -= m1.len;
      raw.push({ s: hi, e: hi + m1.len, type: 'thematic', encodes: m1.encodes });
    }
    // Stem
    if (hi > lo) raw.push({ s: lo, e: hi, type: 'stem', encodes: [] });
    raw.sort((a, b) => a.s - b.s);
  } else if (isFin) {
    // Augment prefix
    let augLen = 0;
    if (isPast) {
      augLen = matchAugment(stripped, 3);
      if (augLen > 0) {
        raw.push({ s: 0, e: augLen, type: 'augment', encodes: ['Tense'] });
        lo = augLen;
      }
    }
    // Personal ending
    const mood = feats?.Mood || 'Ind';
    let endM: ReturnType<typeof matchSuffix> = null;
    if (mood === 'Sub') endM = matchSuffix(stripped.slice(lo, hi), ENDINGS_SUBJUNCTIVE, 2);
    else if (mood === 'Opt') endM = matchSuffix(stripped.slice(lo, hi), ENDINGS_OPTATIVE, 2);
    else if (mood === 'Imp') endM = matchSuffix(stripped.slice(lo, hi), ENDINGS_IMPERATIVE, 2);
    if (!endM) endM = matchSuffix(stripped.slice(lo, hi), ENDINGS_INDICATIVE, 2);
    if (!endM) endM = matchSuffix(stripped.slice(lo, hi), ENDINGS_INFINITIVE, 2);
    if (endM) {
      hi -= endM.len;
      raw.push({ s: hi, e: hi + endM.len, type: 'personalEnd', encodes: endM.encodes });
    }
    // Verb marker
    const m2 = matchSuffix(stripped.slice(lo, hi), VERB_MARKERS, 1);
    if (m2) {
      hi -= m2.len;
      raw.push({ s: hi, e: hi + m2.len, type: m2.type, encodes: m2.encodes });
    }
    // Thematic vowel
    const m1 = matchSuffix(stripped.slice(lo, hi), THEMATIC_VOWELS, 1);
    if (m1) {
      hi -= m1.len;
      raw.push({ s: hi, e: hi + m1.len, type: 'thematic', encodes: m1.encodes });
    }
    // Stem
    if (hi > lo) raw.push({ s: lo, e: hi, type: 'stem', encodes: [] });
    raw.sort((a, b) => a.s - b.s);
  } else if (isInf) {
    const m = matchSuffix(stripped, ENDINGS_INFINITIVE, 2);
    if (m) {
      const eLen = m.len;
      if (nChars - eLen > 0) {
        raw.push({ s: 0, e: nChars - eLen, type: 'stem', encodes: [] });
      }
      raw.push({ s: nChars - eLen, e: nChars, type: 'personalEnd', encodes: m.encodes });
    } else {
      raw.push({ s: 0, e: nChars, type: 'stem', encodes: [] });
    }
  } else if (isNominal) {
    const m = matchSuffix(stripped, NOMINAL_ENDINGS, 2);
    if (m) {
      const eLen = m.len;
      if (nChars - eLen > 0) {
        raw.push({ s: 0, e: nChars - eLen, type: 'stem', encodes: [] });
      }
      raw.push({ s: nChars - eLen, e: nChars, type: 'nominalEnd', encodes: m.encodes });
    } else {
      raw.push({ s: 0, e: nChars, type: 'stem', encodes: [] });
    }
  } else {
    raw.push({ s: 0, e: nChars, type: 'stem', encodes: [] });
  }

  // Convert stripped-index space to original NFC text slices
  return raw.map((seg) => {
    const startCp = basePos[seg.s] ?? 0;
    const endCp = basePos[Math.min(seg.e, nChars)] ?? 0;
    return {
      text: form.slice(startCp, endCp),
      type: seg.type as WordSegment['type'],
      encodes: seg.encodes,
      color: SEGMENT_COLORS[seg.type] || '#565f89',
    };
  });
}
