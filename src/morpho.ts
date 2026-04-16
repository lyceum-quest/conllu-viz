/**
 * Morphological color-coding for CoNLL-U features.
 * Maps each feature category to a color and human-readable label.
 * Colors are derived from segment.ts so sidebar colors match word-segment colors.
 */

import { featureSegmentType, segmentCategoryColor, SEGMENT_COLORS, WordSegment } from './segment';

export interface MorphFeature {
  key: string;
  value: string;
  color: string;
  label: string;
  category: string;
  categoryColor: string;
  description: string;
}

// ── Category labels ───────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  'VerbForm':    'Verb Form',
  'Tense':       'Tense',
  'Aspect':      'Aspect',
  'Voice':       'Voice',
  'Mood':        'Mood',
  'Number':      'Number',
  'Gender':      'Gender',
  'Case':        'Case',
  'Degree':      'Degree / Comparison',
  'Definite':    'Definiteness',
  'Polarity':    'Polarity / Negation',
  'PronType':    'Pronoun Type',
  'Reflex':      'Reflexivity',
  'Person':      'Person',
  'Poss':        'Possession',
  'Animacy':     'Animacy',
  'Clitic':      'Clitic',
  'VerbType':    'Verb Type',
  'Connegative': 'Connegation',
  'Evident':     'Evidentiality',
  'Foreign':     'Foreign Word',
  'Hyph':        'Hyphenated',
  'Abbr':        'Abbreviation',
  'PartForm':    'Part Form',
  'Style':       'Style Variant',
  'Typo':        'Typo',
  'Variant':     'Variant Form',
};

// ── Value-level descriptions ─────────────────────────────────────────────
const VALUE_LABELS: Record<string, string> = {
  // VerbForm
  'VFin': 'finite verb (conjugated)',
  'VInf': 'infinitive (unconjugated)',
  'VSup': 'supine',
  'VPart': 'participle',
  'VConv': 'converb / gerund',
  'Ger':  'gerund',
  'Part': 'participial',
  'Inf':  'infinitive',

  // Tense
  'Pres': 'present (happening now)',
  'Past': 'past (already happened)',
  'Fut':  'future (yet to happen)',
  'Pqp':  'pluperfect (past of past)',
  'Aor':  'aorist (simple / undefined action)',
  'Tense_Imp': 'imperfect (ongoing past action)',

  // Aspect
  'Aspect_Perf': 'perfective (completed action)',
  'Perf': 'perfective',
  'Aspect_Imp': 'imperfective (ongoing / habitual)',
  'Prog':  'progressive (in progress)',
  'Prosp': 'prospective (about to happen)',
  'Inch':  'inchoative (beginning)',

  // Mood
  'Mood_Ind': 'indicative (factual statement)',
  'Ind': 'indicative',
  'Mood_Sub': 'subjunctive (hypothetical / desired)',
  'Sub': 'subjunctive',
  'Cnd':  'conditional (would/could)',
  'Mood_Imp': 'imperative (command)',
  'Imp': 'imperative',
  'Int':  'interrogative (question)',
  'Irr':  'irrealis (non-real situation)',
  'Mood_Part': 'participle (verbal adjective)',

  // Voice
  'Act':  'active (subject does the action)',
  'Pass': 'passive (subject receives the action)',
  'Mid':  'middle (subject is both actor & affected)',

  // Number
  'Sing': 'singular (one)',
  'Plur': 'plural (more than one)',
  'Dual': 'dual (exactly two)',
  'Tri':  'trial (exactly three)',
  'Pauc': 'paucal (a few)',

  // Gender
  'Masc': 'masculine',
  'Fem':  'feminine',
  'Neut': 'neuter / neutral',
  'Gender_Com': 'common (masculine + feminine)',
  'Hum':  'human',
  'Nhum': 'non-human',

  // Case
  'Nom':   'nominative (subject)',
  'Acc':   'accusative (direct object)',
  'Gen':   'genitive (possession / "of")',
  'Dat':   'dative (indirect object)',
  'Loc':   'locative (location / "in/at")',
  'Abl':   'ablative (source / "from")',
  'Ins':   'instrumental (means / "with/by")',
  'Voc':   'vocative (direct address)',
  'Erg':   'ergative (agent of transitive)',
  'Par':   'partitive (partial / indefinite amount)',
  'Ill':   'illative (into)',
  'Ela':   'elative (out of)',
  'Ine':   'inessive (inside)',
  'All':   'allative (onto)',
  'Ade':   'adessive (on/at)',
  'Com':   'comitative (together with)',
  'Tra':   'translative (becoming / "as")',
  'Abs':   'absolutive (subject of intransitive / obj. of transitive)',
  'Equ':   'equative (comparison / "like")',
  'Tem':   'temporal ("at the time of")',
  'Ess':   'essive (temporary state / "as a")',
  'Sbl':   'sublative (onto)',
  'Del':   'delative (from on)',
  'Sup':   'superessive (on top of)',
  'SupR':  'superlative (most …)',
  'Sube':  'subessive (under)',
  'Delat': 'delative (away from surface)',

  // Degree
  'Degree_Pos': 'positive (base form)',
  'Pos': 'positive',
  'Cmp': 'comparative (more …)',
  'CmpR': 'comparative',
  'Degree_Sup': 'superlative (most …)',
  'Aug': 'augmentative (larger / greater)',
  'Dim': 'diminutive (smaller / lesser)',
  'Degree_Abs': 'absolute superlative',
  'Degree_Equ': 'equative (as … as)',

  // Definite
  'Def': 'definite (the)',
  'Definite_Ind': 'indefinite (a/an)',
  'Indefinite': 'indefinite (a/an)',
  'Definite_Com': 'compressed / contractible',

  // Person
  '1': '1st person (I, we, me, us, my)',
  '2': '2nd person (you, your)',
  '3': '3rd person (he, she, it, they, him, her}',

  // Polarity
  'Neg': 'negative (not / no)',

  // PronType
  'Person_Poss': 'personal type',
  'Pers': 'personal pronoun (I/you/he …)',
  'Prs':  'personal pronoun',
  'Art':  'article',
  'Dem':  'demonstrative (this/that)',
  'Rlt':  'relative (who/which/that)',
  'Rel':  'relative',
  'Pron_Int':  'interrogative (which/what)',
  'Pron_Ind': 'indefinite (some/any/every)',
  'Tot':  'total (all/both)',
  'Pron_Neg':  'negative (no/none)',
  'Rcp':  'reciprocal (each other)',

  // Reflex
  'Reflex_Yes': 'reflexive (same as subject)',
  'Reflex_No':  'non-reflexive',

  // Poss
  'Poss_Yes': 'possessive (has possession)',
  'Poss_No':  'non-possessive',
  'Yes': 'yes',
  'No':  'no',
};

// ── Public API ────────────────────────────────────────────────────────────

const UNLOCALIZED_FEATURE_COLOR = 'var(--text-secondary)';

/**
 * Build a single MorphFeature from a key/value pair.
 * Color comes from segment.ts to stay in sync with word-segment colors.
 * When strictSegmentMatch is true, unmatched features fall back to a neutral color.
 */
export function buildMorphFeature(
  key: string,
  value: string,
  segmentType?: string,
  strictSegmentMatch = false,
): MorphFeature {
  const catColor = segmentType
    ? (SEGMENT_COLORS[segmentType] || segmentCategoryColor(key))
    : (strictSegmentMatch ? UNLOCALIZED_FEATURE_COLOR : segmentCategoryColor(key));
  const catLabel = CATEGORY_LABELS[key] || key;
  let valLabel = VALUE_LABELS[`${key}_${value}`] || VALUE_LABELS[value] || value.toLowerCase();
  return {
    key, value,
    color: catColor,
    label: valLabel,
    category: catLabel,
    categoryColor: catColor,
    description: `${catLabel}: ${valLabel}`,
  };
}

/**
 * Parse a token's feats into color-coded MorphFeature objects.
 * Flat list — used where grouping isn't needed.
 */
export function parseMorphFeatures(
  feats: Record<string, string> | undefined,
  segments?: WordSegment[],
): MorphFeature[] {
  if (!feats || Object.keys(feats).length === 0) return [];
  const result: MorphFeature[] = [];
  const priority = [
    'VerbForm', 'Tense', 'Aspect', 'Voice', 'Mood',
    'Number', 'Person', 'Gender', 'Case', 'Degree',
    'Definite', 'Polarity', 'PronType', 'Reflex',
    'Poss', 'Animacy',
    'VerbType', 'PartForm', 'Connegative',
    'Clitic', 'Evident', 'Foreign', 'Hyph', 'Abbr',
    'Style', 'Typo', 'Variant',
  ];
  const sortedKeys = Object.keys(feats).sort((a, b) => {
    const ia = priority.indexOf(a), ib = priority.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  for (const key of sortedKeys) {
    const segType = segments ? featureSegmentType(key, feats[key], segments, false) : undefined;
    result.push(buildMorphFeature(key, feats[key], segType, !!segments));
  }
  return result;
}

// ── Segment-grouped morphology ────────────────────────────────────────────

export interface SegmentGroup {
  segmentText: string;       // the actual Greek characters
  segmentType: string;       // 'nominalEnd', 'participle', etc.
  segmentColor: string;
  features: MorphFeature[];
}

const SEGMENT_TYPE_LABELS: Record<string, string> = {
  stem: 'Stem',
  augment: 'Augment',
  thematic: 'Thematic vowel',
  tense: 'Tense/Aspect marker',
  voice: 'Voice marker',
  participle: 'Participial marker',
  nominalEnd: 'Nominal ending',
  personalEnd: 'Inflectional ending',
  unlocalized: 'Whole-form / inferred',
};

// Order to display groups: outer → inner matches segment order from word display
const GROUP_ORDER: string[] = [
  'augment', 'thematic', 'tense', 'voice', 'participle',
  'nominalEnd', 'personalEnd', 'unlocalized', 'stem',
];

/**
 * Group morphological features by the segment that encodes them.
 * Each segment becomes a header with its features listed beneath.
 */
export function buildSegmentGroups(
  segments: WordSegment[],
  feats: Record<string, string> | undefined,
): SegmentGroup[] {
  if (!feats || Object.keys(feats).length === 0) return [];

  // Build one group per segment type present in the word
  const groups = new Map<string, SegmentGroup>();
  for (const seg of segments) {
    if (!groups.has(seg.type)) {
      groups.set(seg.type, {
        segmentText: seg.text,
        segmentType: seg.type,
        segmentColor: SEGMENT_COLORS[seg.type] || '#c0caf5',
        features: [],
      });
    } else {
      // Concatenate text if the same segment type appears multiple times
      groups.get(seg.type)!.segmentText += seg.text;
    }
  }

  // Assign each feature category to the best matching segment on this token.
  const uncategorized: MorphFeature[] = [];
  for (const key of Object.keys(feats)) {
    const segType = featureSegmentType(key, feats[key], segments, false);
    if (segType && groups.has(segType)) {
      groups.get(segType)!.features.push(buildMorphFeature(key, feats[key]!, segType, true));
    } else {
      uncategorized.push(buildMorphFeature(key, feats[key]!, undefined, true));
    }
  }

  if (uncategorized.length > 0) {
    groups.set('unlocalized', {
      segmentText: 'whole form',
      segmentType: 'unlocalized',
      segmentColor: UNLOCALIZED_FEATURE_COLOR,
      features: uncategorized,
    });
  }

  // Sort features within each group by priority
  const priority = [
    'VerbForm', 'Tense', 'Aspect', 'Voice', 'Mood',
    'Number', 'Person', 'Gender', 'Case', 'Degree',
  ];
  for (const g of groups.values()) {
    g.features.sort((a, b) => {
      const ia = priority.indexOf(a.key), ib = priority.indexOf(b.key);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    });
  }

  // Sort groups by morphological depth: augment → thematic → markers → endings → stem
  const sorted = [...groups.values()].filter(g => g.features.length > 0);
  sorted.sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.segmentType);
    const bi = GROUP_ORDER.indexOf(b.segmentType);
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  });

  return sorted;
}

/**
 * Generate HTML for segment-grouped morphology.
 * Each segment is a colored header, with its encoded features listed beneath.
 */
export function morphSegmentHTML(groups: SegmentGroup[]): string {
  if (groups.length === 0) return '<div class="morph-empty">No morphological features</div>';

  return groups.map(g => `
    <div class="morph-segment-group" style="--seg-color:${g.segmentColor}">
      <div class="morph-segment-header">
        <span class="morph-segment-text" style="color:${g.segmentColor};border-bottom-color:${g.segmentColor}">${g.segmentText}</span>
        <span class="morph-segment-label">${SEGMENT_TYPE_LABELS[g.segmentType] || g.segmentType}</span>
      </div>
      <div class="morph-segment-features">
        ${g.features.map(f => `
          <div class="morph-feat" style="--feat-color:${f.categoryColor}">
            <span class="morph-feat-key" style="color:${f.categoryColor}">${f.key}</span>
            <span class="morph-feat-val">${f.value}</span>
            <span class="morph-feat-desc">${f.label}</span>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

/**
 * Legacy flat-list HTML (kept for compatibility).
 */
export function morphHTML(feats: MorphFeature[]): string {
  if (feats.length === 0) return '<div class="morph-empty">No morphological features</div>';
  return feats.map(f => `
    <div class="morph-feat" style="--feat-color:${f.categoryColor}">
      <span class="morph-feat-key" style="color:${f.categoryColor}">${f.key}</span>
      <span class="morph-feat-val">${f.value}</span>
      <span class="morph-feat-desc">${f.label}</span>
    </div>`).join('');
}
