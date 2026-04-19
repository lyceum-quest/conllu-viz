/**
 * Morphological color-coding for CoNLL-U features.
 * Maps each feature category to a color and human-readable label.
 * Colors are derived from segment.ts so sidebar colors match word-segment colors.
 */

import { featureSegmentType, segmentCategoryColor, SEGMENT_COLORS, WordSegment, segmentGreekWord } from './segment';
import type { Token } from './types';

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

interface MorphTooltipContent {
  overview: string;
  recognition: string[];
  english: string[];
  note?: string;
}

function getMorphTooltipContent(
  key: string,
  value: string,
  categoryLabel: string,
  valueLabel: string,
): MorphTooltipContent {
  switch (key) {
    case 'Case':
      switch (value) {
        case 'Nom':
          return {
            overview: 'Nominative usually marks the subject or predicate noun: the person or thing doing the action, or the thing being identified.',
            recognition: [
              'Check agreement with the article/adjective: ὁ / ἡ / τό and οἱ / αἱ / τά are common nominative signals.',
              'In a clause, nominatives are often the noun phrase most tightly linked to the finite verb as subject.',
            ],
            english: [
              'Often left untranslated as a plain subject: “the man sees”.',
              'With “to be” verbs, it can appear as “X is Y”.',
            ],
          };
        case 'Acc':
          return {
            overview: 'Accusative usually marks the direct object, but it can also mark motion toward, extent, or the object of many prepositions.',
            recognition: [
              'Article/adjective agreement is often the safest clue: τόν / τήν / τό, τούς / τάς / τά commonly point to accusative forms.',
              'It often sits after a transitive verb as the thing directly acted on.',
            ],
            english: [
              'Usually just the direct object with no extra preposition: “he sees the lion”.',
              'With prepositions, often “into / toward / through / along”.',
            ],
          };
        case 'Gen':
          return {
            overview: 'Genitive often marks possession, source, relationship, description, or the object of certain prepositions.',
            recognition: [
              'The article is a strong clue: τοῦ / τῆς / τῶν are frequent genitive article forms.',
              'It often follows another noun to mean “of X”, or follows a preposition that regularly governs the genitive.',
            ],
            english: [
              'Commonly translated with “of” or an apostrophe-s: “the strength of the body / the body’s strength”.',
              'Depending on context, it may also mean “from”, “belonging to”, or “about”.',
            ],
          };
        case 'Dat':
          return {
            overview: 'Dative often marks the indirect object, recipient, beneficiary, instrument, or location/sphere in which something happens.',
            recognition: [
              'Article agreement is especially helpful: τῷ / τῇ / τοῖς / ταῖς are classic dative article forms.',
              'It often appears with verbs of giving, saying, helping, obeying, or with prepositions such as ἐν.',
            ],
            english: [
              'Very often “to” or “for”: “he gives to the child / for the child”.',
              'Also commonly “with / by / in / at”, depending on context.',
            ],
          };
        case 'Voc':
          return {
            overview: 'Vocative is the case of direct address: you are calling to or speaking to someone.',
            recognition: [
              'Look for someone being addressed directly, often near an exclamation or command.',
              'Greek may use a special vocative form, especially in names and some second-declension nouns.',
            ],
            english: [
              'Usually rendered by direct address: “O lord”, “friend!”, “Zeus!”.',
            ],
          };
      }
      break;
    case 'Gender':
      switch (value) {
        case 'Masc':
          return {
            overview: 'Masculine is a grammatical gender class. Sometimes it aligns with natural male sex, but often it is simply a lexical pattern that controls agreement.',
            recognition: [
              'Check agreement with the article and adjectives: ὁ is the basic masculine singular article.',
              'Gender is safer to read from the whole noun phrase than from the bare noun ending alone.',
            ],
            english: [
              'Usually not translated by a separate English word.',
              'Its main job is to make articles, adjectives, and participles agree with the noun.',
            ],
          };
        case 'Fem':
          return {
            overview: 'Feminine is a grammatical gender class. It may refer to female beings, but it also serves as a grammatical agreement pattern.',
            recognition: [
              'Check agreement with the article and adjectives: ἡ is the basic feminine singular article.',
              'As with other genders, article/adjective agreement is usually more reliable than the noun ending by itself.',
            ],
            english: [
              'Usually not translated directly in English.',
              'It mostly affects agreement inside the noun phrase.',
            ],
          };
        case 'Neut':
          return {
            overview: 'Neuter is the third major grammatical gender. It often marks things rather than persons, but many nouns are neuter simply by lexical class.',
            recognition: [
              'Check agreement with τό / τά and matching adjective forms.',
              'Neuter nominative and accusative are often identical, so syntax matters as much as form.',
            ],
            english: [
              'Usually not translated directly.',
              'It mainly controls agreement and sometimes helps explain why nominative and accusative look the same.',
            ],
          };
      }
      break;
    case 'Number':
      switch (value) {
        case 'Sing':
          return {
            overview: 'Singular means one person or thing.',
            recognition: [
              'Look for singular agreement across the phrase: noun, article, adjective, and participle will often line up together.',
              'Verb forms in singular also agree with a singular subject.',
            ],
            english: [
              'Usually translated as a singular English form: “the lion”, “he says”.',
            ],
          };
        case 'Plur':
          return {
            overview: 'Plural means more than one person or thing.',
            recognition: [
              'Look for plural agreement across the phrase: article, adjective, noun, and participle often all show plural together.',
              'Finite verbs also show plural when their subject is plural.',
            ],
            english: [
              'Usually translated as an English plural: “the lions”, “they say”.',
            ],
          };
      }
      break;
    case 'Person':
      switch (value) {
        case '1':
          return {
            overview: 'First person means the speaker: “I” or “we”.',
            recognition: [
              'Look for a finite verb ending that encodes speaker involvement.',
              'Greek often leaves the subject pronoun unstated because the verb ending already tells you the person.',
            ],
            english: [
              'Usually translated with “I / we”.',
            ],
          };
        case '2':
          return {
            overview: 'Second person means the addressee: “you”.',
            recognition: [
              'Look for finite verb endings used in commands, questions, or direct address.',
              'Greek often omits the explicit pronoun because the ending already marks the person.',
            ],
            english: [
              'Usually translated with “you”.',
            ],
          };
        case '3':
          return {
            overview: 'Third person means someone or something other than speaker and addressee: “he / she / it / they”.',
            recognition: [
              'Finite verb endings often mark third person even when no explicit subject pronoun is present.',
              'Look for a nearby noun phrase in nominative that serves as the subject.',
            ],
            english: [
              'Usually translated with “he / she / it / they”, depending on number and context.',
            ],
          };
      }
      break;
    case 'Voice':
      switch (value) {
        case 'Act':
          return {
            overview: 'Active voice presents the subject as doing the action.',
            recognition: [
              'Look for ordinary active verb endings and the absence of passive markers like -θη-.',
              'In participles, active forms often pattern like -ων / -ουσα / -ον or aorist -σας / -σασα / -σαν.',
            ],
            english: [
              'Usually translated straightforwardly: “he loosens”, “having spoken”.',
            ],
          };
        case 'Mid':
          return {
            overview: 'Middle voice presents the subject as involved in or affected by the action. In Greek it also covers many deponent verbs that look middle but translate actively.',
            recognition: [
              'Common middle/passive endings include forms in -μαι, -ται, -το, or participles in -μενος / -μένη / -μενον.',
              'Meaning must be read from the lexicon and context: some middle forms are reflexive-ish, some reciprocal, some simply lexical.',
            ],
            english: [
              'Often “for oneself / for one’s own interest”, but just as often plain active in translation.',
              'Sometimes it comes out as passive-like English depending on the verb.',
            ],
          };
        case 'Pass':
          return {
            overview: 'Passive voice presents the subject as receiving the action.',
            recognition: [
              'Greek often signals passive with markers such as -θη- or passive-looking endings, though forms vary by tense.',
              'Look for an expressed or implied agent: “by X”.',
            ],
            english: [
              'Usually translated with “is/was X-ed” or “got X-ed”.',
            ],
          };
      }
      break;
    case 'Tense':
      switch (value) {
        case 'Pres':
          return {
            overview: 'Present tense usually presents an action as current, repeated, or ongoing in the present frame.',
            recognition: [
              'Look for present-stem forms; unlike imperfect and aorist, there is usually no past augment.',
              'Context matters: Greek present often overlaps with English simple present and progressive.',
            ],
            english: [
              'Often “does / is doing”.',
            ],
          };
        case 'Imp':
          return {
            overview: 'Imperfect tense presents an action as ongoing, repeated, or attempted in past time.',
            recognition: [
              'Greek imperfect often shows an augment like ἐ- / ἠ- plus secondary endings.',
              'It is especially common for backgrounded or continuous past actions.',
            ],
            english: [
              'Often “was doing”, “kept doing”, or “used to do”.',
            ],
          };
        case 'Aor':
          return {
            overview: 'Aorist presents an action as a whole event, without zooming in on its internal duration.',
            recognition: [
              'Many aorists show a sigmatic marker -σ-, but not all do; second aorists use a different stem instead.',
              'Finite past aorists often take an augment; aorist participles commonly show patterns like -σας / -σασα / -σαν.',
            ],
            english: [
              'Often just simple past: “did”.',
              'In participles, often “having done”.',
            ],
          };
      }
      break;
    case 'Aspect':
      switch (value) {
        case 'Imp':
          return {
            overview: 'Imperfective aspect views the action as unfolding, repeated, or ongoing.',
            recognition: [
              'This is usually a meaning clue rather than something you can isolate from one ending alone.',
              'Present and imperfect forms often carry imperfective viewpoint.',
            ],
            english: [
              'Often rendered by English “is doing / was doing / keeps doing”.',
            ],
          };
        case 'Perf':
          return {
            overview: 'Perfective aspect views the action as a whole complete event.',
            recognition: [
              'In this dataset, aorist forms are often tagged perfective because they present the event as a single whole.',
              'This is more about viewpoint than about one specific ending by itself.',
            ],
            english: [
              'Often rendered by simple eventive English such as “did” or participial “having done”.',
            ],
          };
      }
      break;
    case 'Mood':
      switch (value) {
        case 'Ind':
          return {
            overview: 'Indicative is the mood of straightforward statements and questions presented as real or factual within the discourse.',
            recognition: [
              'Look for ordinary finite verb forms used in main assertions.',
              'If nothing in the syntax signals command, wish, purpose, or non-finite usage, indicative is often the default.',
            ],
            english: [
              'Usually translated as a plain English finite verb: “he says / he said”.',
            ],
          };
        case 'Sub':
        case 'Subj':
          return {
            overview: 'Subjunctive marks projected, desired, contingent, or purpose-oriented action rather than plain factual assertion.',
            recognition: [
              'It often appears after particles and conjunctions like ἵνα, ἐάν, or in deliberative/exhortative contexts.',
              'Endings can help, but syntax is safer than trying to infer it from the final letters alone.',
            ],
            english: [
              'Often rendered with “may / might / should”, or in purpose clauses with “so that”.',
            ],
          };
        case 'Imp':
          return {
            overview: 'Imperative is the mood of command, request, or exhortation.',
            recognition: [
              'Look for direct commands, often in second person, though Greek also has third-person imperatives.',
              'The sentence context usually gives the clearest signal.',
            ],
            english: [
              'Usually translated as a command: “do this”, “let him go”.',
            ],
          };
        case 'Inf':
          return {
            overview: 'Infinitive is a non-finite verbal form: it names the action without a personal subject ending.',
            recognition: [
              'Common Greek infinitive endings include -ειν, -σαι, -ναι, though exact patterns vary.',
              'It often depends on another verb or functions like a verbal noun.',
            ],
            english: [
              'Usually translated with “to X”: “to speak”, “to bear”.',
            ],
          };
        case 'Part':
          return {
            overview: 'Participle is a verbal adjective: it behaves like a verb and an adjective at once.',
            recognition: [
              'It declines for case, gender, and number like an adjective while also carrying tense/voice information.',
              'Common patterns include -ων / -ουσα / -ον, aorist -σας / -σασα / -σαν, and middle/passive -μενος / -μένη / -μενον.',
            ],
            english: [
              'Often “-ing”, “having X-ed”, or a relative clause like “who X-es / who was X-ed”.',
            ],
          };
      }
      break;
    case 'VerbForm':
      switch (value) {
        case 'Fin':
        case 'VFin':
          return {
            overview: 'Finite means this verb form is fully conjugated: it can stand as the main verb of a clause.',
            recognition: [
              'Finite forms normally carry person and number, and often mood and tense.',
              'They can anchor an independent clause by themselves.',
            ],
            english: [
              'Usually translated as an ordinary clause verb: “he says / they were going”.',
            ],
          };
      }
      break;
    case 'Degree':
      switch (value) {
        case 'Pos':
          return {
            overview: 'Positive degree is the base form of an adjective or adverb: not comparative, not superlative.',
            recognition: [
              'This is the ordinary dictionary-level degree with no “more” or “most” meaning added.',
            ],
            english: [
              'Usually translated plainly: “good”, “beautiful”, “swiftly”.',
            ],
          };
        case 'Cmp':
          return {
            overview: 'Comparative degree means “more X” or “rather X-er”.',
            recognition: [
              'Greek comparatives often show endings such as -τερος / -τερον or irregular comparative stems.',
              'Context may also include an explicit comparison phrase: “than X”.',
            ],
            english: [
              'Usually “more X” or “X-er”.',
            ],
          };
        case 'Sup':
          return {
            overview: 'Superlative degree means “most X”.',
            recognition: [
              'Greek often forms superlatives with endings such as -τατος, though irregular forms also exist.',
            ],
            english: [
              'Usually “most X” or “X-est”.',
            ],
          };
      }
      break;
    case 'Definite':
      if (value === 'Def') {
        return {
          overview: 'Definite means the form points to a specific, identifiable referent.',
          recognition: [
            'In Greek this commonly appears on the article, which also helps mark case, gender, and number.',
            'Greek articles are broader than English “the”: they can also substantivize adjectives and participles.',
          ],
          english: [
            'Often translated as “the”.',
          ],
        };
      }
      break;
    case 'PronType':
      switch (value) {
        case 'Art':
          return {
            overview: 'Article marks the definite article: the little word that helps package a noun phrase and shows agreement.',
            recognition: [
              'Forms like ὁ, ἡ, τό, τοῦ, τῷ, τόν, etc. are key agreement clues in Greek.',
              'The article is often the clearest indicator of case/gender/number inside the phrase.',
            ],
            english: [
              'Usually translated as “the”.',
              'Sometimes left untranslated when Greek uses the article more broadly than English would.',
            ],
          };
        case 'Ind':
          return {
            overview: 'Indefinite pronoun type means a form like “someone / something / any- / some-”, depending on context.',
            recognition: [
              'Look for pronouns or determiners that do not point to one specific known referent.',
            ],
            english: [
              'Often “someone / something / any / some”.',
            ],
          };
      }
      break;
    case 'Polarity':
      if (value === 'Neg') {
        return {
          overview: 'Negative polarity marks a negating word or negative setting.',
          recognition: [
            'In Greek this often corresponds to particles like οὐ / οὐκ / οὐχ or μή.',
            'The sentence context will show what is being denied or prohibited.',
          ],
          english: [
            'Usually “not”, “no”, or “never”.',
          ],
        };
      }
      break;
    case 'NumType':
      if (value === 'Card') {
        return {
          overview: 'Cardinal numeral means a counting number: one, two, three, and so on.',
          recognition: [
            'These forms answer “how many?” rather than “which one?” or “what order?”.',
          ],
          english: [
            'Usually translated as a plain number word: “one”, “two”, “three”.',
          ],
        };
      }
      break;
    case 'ConjType':
      if (value === 'Comp') {
        return {
          overview: 'Complementizer marks a conjunction introducing a content clause: a clause functioning like “that …”.',
          recognition: [
            'Look for conjunctions such as ὅτι used to introduce reported speech, thought, or explanation.',
          ],
          english: [
            'Often translated as “that”.',
          ],
        };
      }
      break;
  }

  return {
    overview: `${categoryLabel} tells you that this word is marked as ${valueLabel}.`,
    recognition: [
      'Use the whole phrase and the clause context, not just the last few letters of one word.',
      'Articles, agreement, and syntax are often safer clues than the bare ending alone.',
    ],
    english: [
      'The exact English meaning depends on context and may be expressed by word order, a helper word, or no separate word at all.',
    ],
  };
}

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

export interface WholeWordFeatureCue {
  features: MorphFeature[];
  colors: string[];
  underline: string;
  title: string;
}

/**
 * Features that cannot be localized to a substring still matter pedagogically.
 * Represent them as a whole-word underline rather than forcing fake segments.
 */
export function buildWholeWordFeatureCue(
  feats: Record<string, string> | undefined,
  segments: WordSegment[],
): WholeWordFeatureCue | null {
  if (!feats || Object.keys(feats).length === 0) return null;

  const features = Object.keys(feats)
    .filter(key => !featureSegmentType(key, feats[key], segments, false))
    .map(key => buildMorphFeature(key, feats[key]!, undefined, false));

  if (features.length === 0) return null;

  const colors = [...new Set(features.map(f => f.categoryColor))];
  const underline = colors.length === 1
    ? colors[0]
    : `linear-gradient(90deg, ${colors.join(', ')})`;
  const title = `Whole-form features: ${features.map(f => `${f.key}=${f.value}`).join(', ')}`;

  return { features, colors, underline, title };
}

// ── Segment-grouped morphology ────────────────────────────────────────────

export interface SegmentGroup {
  segmentText: string;       // the actual Greek characters
  segmentType: string;       // 'nominalEnd', 'participle', etc.
  segmentColor: string;
  features: MorphFeature[];
}

export const SEGMENT_TYPE_LABELS: Record<string, string> = {
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

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function morphTooltipListHTML(title: string, items: string[]): string {
  if (items.length === 0) return '';
  return `
    <div class="morph-tooltip-section">
      <div class="morph-tooltip-section-title">${escapeHTML(title)}</div>
      <ul class="morph-tooltip-list">
        ${items.map(item => `<li>${escapeHTML(item)}</li>`).join('')}
      </ul>
    </div>`;
}

function morphFeatureTooltipHTML(feature: MorphFeature): string {
  const info = getMorphTooltipContent(feature.key, feature.value, feature.category, feature.label);
  const noteHTML = info.note
    ? `<div class="morph-tooltip-note">${escapeHTML(info.note)}</div>`
    : '';

  return `
    <template class="morph-feat-tooltip-template">
      <div class="morph-tooltip-title-row">
        <span class="morph-tooltip-title">${escapeHTML(feature.category)}</span>
        <span class="morph-tooltip-value">${escapeHTML(feature.value)}</span>
      </div>
      <div class="morph-tooltip-overview">${escapeHTML(info.overview)}</div>
      ${morphTooltipListHTML('How to recognize it', info.recognition)}
      ${morphTooltipListHTML('Common English clues', info.english)}
      ${noteHTML}
    </template>`;
}

function morphFeatureLineHTML(feature: MorphFeature): string {
  return `
    <div class="morph-feat" style="--feat-color:${feature.categoryColor}" tabindex="0">
      <div class="morph-feat-line">
        <span class="morph-feat-key" style="color:${feature.categoryColor}">${escapeHTML(feature.key)}</span>
        <span class="morph-feat-val">${escapeHTML(feature.value)}</span>
        <span class="morph-feat-desc">${escapeHTML(feature.label)}</span>
      </div>
      ${morphFeatureTooltipHTML(feature)}
    </div>`;
}

export function buildMorphAnalysisHTML(
  token: Pick<Token, 'form' | 'lemma' | 'gloss' | 'upos' | 'feats'>,
  posColor: string,
  posLabel = token.upos,
): string {
  const segments = segmentGreekWord(token.form, token.feats, token.upos);
  const groups = buildSegmentGroups(segments, token.feats);
  const unlocalizedGroup = groups.find(g => g.segmentType === 'unlocalized');
  const wholeWordCue = buildWholeWordFeatureCue(token.feats, segments);
  const segmentTypeTitles: Record<string, string> = {
    stem: 'Stem (lemma root)',
    augment: 'Augment (past tense prefix)',
    thematic: 'Thematic vowel',
    tense: 'Tense / Aspect marker',
    voice: 'Voice marker',
    participle: 'Participial marker',
    nominalEnd: 'Case / Gender / Number',
    personalEnd: 'Inflectional ending',
    unlocalized: 'Whole-form / inferred',
  };

  const segmentsHTML = segments.length > 0
    ? segments.map(seg => {
      const typeLabel = segmentTypeTitles[seg.type] || seg.type;
      const title = seg.encodes.length > 0
        ? `${typeLabel} (${seg.encodes.join(', ')})`
        : typeLabel;
      return `<span class="morph-char" style="color:${seg.color};border-bottom-color:${seg.color}" title="${escapeHTML(title)}">${escapeHTML(seg.text)}</span>`;
    }).join('')
    : `<span class="morph-char" style="color:${posColor};border-bottom-color:${posColor}" title="Whole form">${escapeHTML(token.form)}</span>`;

  const segmentsRowHTML = wholeWordCue
    ? `<span class="morph-word-underlined" style="--whole-word-underline:${wholeWordCue.underline}" title="${escapeHTML(wholeWordCue.title)}">${segmentsHTML}</span>`
    : segmentsHTML;

  const legendItems = new Map<string, { color: string; label: string; chars: string }>();
  for (const seg of segments) {
    const key = `${seg.color}|${seg.type}`;
    if (!legendItems.has(key)) {
      legendItems.set(key, {
        color: seg.color,
        label: segmentTypeTitles[seg.type] || seg.type,
        chars: seg.text,
      });
    } else {
      legendItems.get(key)!.chars += seg.text;
    }
  }
  if (unlocalizedGroup) {
    const key = `${unlocalizedGroup.segmentColor}|${unlocalizedGroup.segmentType}`;
    legendItems.set(key, {
      color: unlocalizedGroup.segmentColor,
      label: segmentTypeTitles[unlocalizedGroup.segmentType] || unlocalizedGroup.segmentType,
      chars: token.form,
    });
  }

  const legendHTML = [...legendItems.values()].map(({ color, label, chars }) => `
    <div class="morph-char-legend-item">
      <span class="morph-char-legend-swatch" style="background:${color}"></span>
      <span>${label} <span style="color:var(--text-muted);font-size:0.9em">(${escapeHTML(chars)})</span></span>
    </div>`
  ).join('');

  const definitionHTML = token.gloss
    ? `<span class="morph-word-definition">— ${escapeHTML(token.gloss)}</span>`
    : '';

  return `
    <div class="morph-word-display">
      <div class="morph-word-meta">
        <span class="morph-word-form" style="color:${posColor}">${escapeHTML(token.form)}</span>
        <span class="morph-word-lemma">[${escapeHTML(token.lemma)}]</span>
        ${definitionHTML}
        <span class="morph-word-pos">${escapeHTML(posLabel)}</span>
      </div>
      <div class="morph-char-row">${segmentsRowHTML}</div>
      ${legendHTML ? `<div class="morph-char-legend">${legendHTML}</div>` : ''}
    </div>
    <div class="morph-content">
      ${morphSegmentHTML(groups)}
    </div>
  `;
}

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
      uncategorized.push(buildMorphFeature(key, feats[key]!, undefined, false));
    }
  }

  if (uncategorized.length > 0) {
    const unlocalizedColors = [...new Set(uncategorized.map(f => f.categoryColor))];
    groups.set('unlocalized', {
      segmentText: 'whole form',
      segmentType: 'unlocalized',
      segmentColor: unlocalizedColors.length === 1 ? unlocalizedColors[0] : UNLOCALIZED_FEATURE_COLOR,
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
        ${g.features.map(morphFeatureLineHTML).join('')}
      </div>
    </div>`).join('');
}

/**
 * Legacy flat-list HTML (kept for compatibility).
 */
export function morphHTML(feats: MorphFeature[]): string {
  if (feats.length === 0) return '<div class="morph-empty">No morphological features</div>';
  return feats.map(morphFeatureLineHTML).join('');
}
