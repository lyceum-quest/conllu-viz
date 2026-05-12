import type { FeatureMap, Token } from './types';
import type { WordSegment } from './segment';

interface EndingPattern {
  ending: string;
  label: string;
  family: string;
  cues: string[];
  feats?: Partial<FeatureMap>;
  upos?: string[];
}

function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('el-GR');
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function featureMatches(actual: FeatureMap | undefined, expected: Partial<FeatureMap> | undefined): boolean {
  if (!expected) return true;
  if (!actual) return false;
  return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

function patternScore(token: Pick<Token, 'upos' | 'feats'>, pattern: EndingPattern): number {
  let score = 0;
  if (pattern.upos?.includes(token.upos)) score += 4;
  if (pattern.feats && featureMatches(token.feats, pattern.feats)) score += 3;
  if (pattern.ending.length > 1) score += pattern.ending.length / 10;
  return score;
}

const NOMINAL_PATTERNS: EndingPattern[] = [
  { ending: 'ος', family: '2nd declension / o-stem; also some 3rd-declension stems', label: 'masc nom sg or masc/fem nom sg', feats: { Case: 'Nom', Number: 'Sing' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Common 2nd-declension masculine nominative singular: λόγος.', 'Some 3rd-declension nouns also surface as -ος, so lemma/stem still matters.'] },
  { ending: 'ον', family: '2nd declension / o-stem', label: 'neut nom/acc sg or masc acc sg', upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Neuter nominative and accusative are identical.', 'Masculine accusative singular is also often -ον.'] },
  { ending: 'ου', family: '2nd declension / o-stem', label: 'genitive singular', feats: { Case: 'Gen', Number: 'Sing' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Very common “of/from” ending for 2nd-declension nouns and adjectives.'] },
  { ending: 'ω', family: 'dual o-stem adjective/pronominal pattern', label: 'nominative/accusative/vocative dual', feats: { Number: 'Dual' }, upos: ['NOUN', 'PROPN', 'ADJ', 'DET', 'PRON'], cues: ['This is the dual pattern in forms like ἀμφοτέρω: “both two …”.', 'Dual nominative, accusative, and vocative often share the same surface ending.', 'If the CoNLL-U tag says Dual, prefer this over the dative singular -ῳ pattern.'] },
  { ending: 'ω', family: '2nd declension / o-stem', label: 'dative singular', feats: { Case: 'Dat', Number: 'Sing' }, upos: ['NOUN', 'PROPN', 'ADJ', 'DET', 'PRON'], cues: ['Often written with iota subscript: -ῳ; accents/subscript may be hidden by normalization.', 'Without iota subscript/adscript this can look like bare -ω, so dual forms can conflict unless the Number tag is checked.'] },
  { ending: 'οι', family: '2nd declension / o-stem', label: 'masc nominative plural', feats: { Case: 'Nom', Number: 'Plur' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Common plural subject ending for masculine 2nd-declension nouns.'] },
  { ending: 'ους', family: '2nd declension / o-stem; some 3rd declension', label: 'masc accusative plural', feats: { Case: 'Acc', Number: 'Plur' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Often direct-object plural.', 'Can overlap with contracted or 3rd-declension forms.'] },
  { ending: 'οις', family: '2nd declension / o-stem', label: 'dative plural', feats: { Case: 'Dat', Number: 'Plur' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Often “to/for/in/with” plural, depending on preposition/context.'] },
  { ending: 'α', family: 'irregular/3rd-declension masculine proper-name accusative', label: 'masculine accusative singular', feats: { Case: 'Acc', Number: 'Sing', Gender: 'Masc' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Some masculine names and 3rd-declension forms have accusative singular -α.', 'This is the pattern in Δία, accusative singular of Ζεύς.'] },
  { ending: 'α', family: '1st declension / ā-ē stem; neuter plural in 2nd declension', label: 'fem nom sg, fem acc sg, or neut nom/acc pl', upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['This is highly ambiguous: -α can be feminine singular or neuter plural.', 'Use article/adjective agreement to disambiguate.'] },
  { ending: 'η', family: '1st declension / ē-stem', label: 'feminine nominative singular', feats: { Case: 'Nom', Number: 'Sing', Gender: 'Fem' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Common feminine subject ending: ἀρχή.', 'But verb endings can also end in -η, so POS matters.'] },
  { ending: 'ας', family: '1st declension / ā-stem; also 3rd declension', label: 'accusative plural or genitive singular / masc nom sg', upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['For 1st-declension feminine, -ας is often accusative plural or genitive singular.', 'Masculine 1st-declension nominative singular can also be -ας.'] },
  { ending: 'ης', family: '1st declension / ē-stem; also 3rd declension', label: 'genitive singular or masc nominative singular', upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Feminine 1st-declension genitive singular often ends -ης.', 'Masculine agent nouns can be nominative singular in -ης.'] },
  { ending: 'ην', family: '1st declension / ē-stem', label: 'accusative singular', feats: { Case: 'Acc', Number: 'Sing' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Common direct-object ending for feminine ē-stems.'] },
  { ending: 'αι', family: '1st declension / ā-ē stem', label: 'feminine nominative plural', feats: { Case: 'Nom', Number: 'Plur' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Common plural subject ending for 1st-declension feminine nouns.'] },
  { ending: 'αις', family: '1st declension / ā-ē stem', label: 'dative plural', feats: { Case: 'Dat', Number: 'Plur' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Often “to/for/in/with” plural, depending on preposition/context.'] },
  { ending: 'ων', family: '1st/2nd/3rd declension', label: 'genitive plural; or participle nominative masc sg', upos: ['NOUN', 'PROPN', 'ADJ', 'VERB'], cues: ['For nouns/adjectives, -ων is a very common genitive plural.', 'For verbs, -ων may be an active participle ending.'] },
  { ending: 'ες', family: '3rd declension consonant stems; some adjectives', label: 'nominative/accusative/vocative plural', feats: { Number: 'Plur' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Common 3rd-declension plural ending.', 'Case often needs article/adjective/syntax to decide.'] },
  { ending: 'σι', family: '3rd declension', label: 'dative plural', feats: { Case: 'Dat', Number: 'Plur' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Often appears as -σι or -σιν; stem changes before it are common.'] },
  { ending: 'ι', family: '3rd declension', label: 'dative singular', feats: { Case: 'Dat', Number: 'Sing' }, upos: ['NOUN', 'PROPN', 'ADJ'], cues: ['Common 3rd-declension dative singular ending.'] },
];

const VERBAL_PATTERNS: EndingPattern[] = [
  { ending: 'ουσιν', family: 'ω-conjugation present active', label: '3rd plural indicative', feats: { Person: '3', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Long ending often contracts/shortens to -ουσι.', 'Signals “they …” when finite.'] },
  { ending: 'ουσι', family: 'ω-conjugation present active', label: '3rd plural indicative', feats: { Person: '3', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Shorter 3rd plural present active ending.'] },
  { ending: 'ομεν', family: 'ω-conjugation present/imperfect active', label: '1st plural indicative', feats: { Person: '1', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Usually “we …”; tense depends on augment/context.'] },
  { ending: 'εις', family: 'ω-conjugation present active', label: '2nd singular indicative', feats: { Person: '2', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Usually “you …” singular.'] },
  { ending: 'ει', family: 'ω-conjugation present active', label: '3rd singular indicative', feats: { Person: '3', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Usually “he/she/it …”.'] },
  { ending: 'οι', family: 'contract verb active indicative', label: '3rd singular contracted ending', feats: { Mood: 'Ind', Person: '3', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Contract verbs can hide the expected thematic vowel + ending inside one written vowel/diphthong.', 'This is the pattern in ἐπιθυμοῖ from ἐπιθυμέω: “she/he was desiring” or “desires,” depending on tense/context.'] },
  { ending: 'εν', family: 'secondary active endings / imperfect-aorist', label: '3rd singular past indicative', feats: { Person: '3', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Common secondary active ending: “he/she/it was …ing” or “...ed”.', 'Often appears with an augment or past/aorist stem marker.'] },
  { ending: 'ες', family: 'secondary active endings / imperfect-aorist', label: '2nd singular past indicative', feats: { Person: '2', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Common secondary active ending: “you were …ing” or “you ...ed”.', 'Also overlaps with nominal plural endings, so POS matters.'] },
  { ending: 'ε', family: 'short finite active ending; secondary active or imperative', label: '3rd singular imperfect/aorist or 2nd singular imperative', upos: ['VERB', 'AUX'], cues: ['This is the pattern in forms like ὑπώπτευε: a short finite -ε ending.', 'It is ambiguous by itself; use tense tags, augment/stem, and translation to decide between “he/she was …ing” and a command “...!”.', 'The current CoNLL-U tag only says VerbForm=Fin, so the app can identify the surface pattern but not the full person/tense with certainty.'] },
  { ending: 'ω', family: 'ω-conjugation present active / subjunctive', label: '1st singular or subjunctive marker', feats: { Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Can be 1st singular indicative or subjunctive depending on mood.', 'Long vowel endings are common in subjunctive forms.'] },
  { ending: 'ομαι', family: 'middle/passive present', label: '1st singular', feats: { Person: '1', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Middle/passive personal ending: “I … myself / am …ed”.'] },
  { ending: 'εται', family: 'middle/passive present', label: '3rd singular', feats: { Person: '3', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Middle/passive “he/she/it …s/is …ed”.'] },
  { ending: 'ονται', family: 'middle/passive present', label: '3rd plural', feats: { Person: '3', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Middle/passive “they …/are …ed”.'] },
  { ending: 'μην', family: 'secondary middle endings', label: '1st singular imperfect/aorist middle', feats: { Person: '1', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Secondary endings usually pair with past/aorist systems.'] },
  { ending: 'σο', family: 'secondary middle endings', label: '2nd singular imperfect/aorist middle', feats: { Person: '2', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Often past middle; contraction can obscure the surface ending.'] },
  { ending: 'το', family: 'secondary middle endings', label: '3rd singular imperfect/aorist middle', feats: { Person: '3', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Often past middle; augment helps identify imperfect/aorist.'] },
  { ending: 'ντο', family: 'secondary middle endings', label: '3rd plural imperfect/aorist middle', feats: { Person: '3', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Past middle/passive plural ending.'] },
  { ending: 'θην', family: 'aorist passive system', label: '1st singular aorist passive', feats: { Tense: 'Aor', Voice: 'Pass' }, upos: ['VERB', 'AUX'], cues: ['The -θη- marker is the big passive/aorist clue.'] },
  { ending: 'θης', family: 'aorist passive system', label: '2nd singular aorist passive', feats: { Tense: 'Aor', Voice: 'Pass' }, upos: ['VERB', 'AUX'], cues: ['The -θη- marker is more diagnostic than the final personal ending alone.'] },
  { ending: 'θη', family: 'aorist passive system', label: '3rd singular aorist passive', feats: { Tense: 'Aor', Voice: 'Pass' }, upos: ['VERB', 'AUX'], cues: ['The -θη- marker usually tells you this belongs to the passive aorist system.'] },
  { ending: 'θησαν', family: 'aorist passive system', label: '3rd plural aorist passive', feats: { Tense: 'Aor', Voice: 'Pass' }, upos: ['VERB', 'AUX'], cues: ['Clear aorist passive plural pattern.'] },
  { ending: 'μαι', family: 'perfect or present middle/passive', label: '1st singular middle/passive', feats: { Person: '1', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Can be present middle/passive or perfect middle/passive; tense/aspect marker decides.'] },
  { ending: 'ται', family: 'perfect or present middle/passive', label: '3rd singular middle/passive', feats: { Person: '3', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Very common middle/passive ending; check tense/aspect.'] },
  { ending: 'νται', family: 'perfect or present middle/passive', label: '3rd plural middle/passive', feats: { Person: '3', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Plural middle/passive; can belong to multiple tense systems.'] },
  { ending: 'ειν', family: 'present/aorist infinitive', label: 'active infinitive', upos: ['VERB', 'AUX'], cues: ['Often translated “to …”.', 'Infinitives do not carry person/number.'] },
  { ending: 'ναι', family: 'aorist/perfect infinitive', label: 'active infinitive', upos: ['VERB', 'AUX'], cues: ['Often translated “to …”; tense system comes from the stem.'] },
  { ending: 'σθαι', family: 'middle/passive infinitive', label: 'middle/passive infinitive', upos: ['VERB', 'AUX'], cues: ['Infinitive plus middle/passive voice.'] },
  { ending: 'μενη', family: 'middle/passive participle', label: 'feminine nominative singular participle', feats: { VerbForm: 'Part', Case: 'Nom', Gender: 'Fem', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['The -μεν- participial marker plus feminine -η ending works like an adjective ending.', 'This is the pattern in forms like θεασαμένη: “having seen” modifying a feminine singular noun/person.'] },
  { ending: 'μενην', family: 'middle/passive participle', label: 'feminine accusative singular participle', feats: { VerbForm: 'Part', Case: 'Acc', Gender: 'Fem', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['The participle has a verbal stem plus an adjectival case/gender/number ending.'] },
  { ending: 'μενος', family: 'middle/passive participle', label: 'masculine nominative singular participle', feats: { VerbForm: 'Part', Case: 'Nom', Gender: 'Masc', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['The -μεν- marker often signals a middle/passive participle; the final ending declines like an adjective.'] },
  { ending: 'μενον', family: 'middle/passive participle', label: 'neuter nominative/accusative singular or masculine accusative singular participle', feats: { VerbForm: 'Part', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['Participles stack verbal information with adjective-like case/gender/number endings.'] },
  { ending: 'μενου', family: 'middle/passive participle', label: 'genitive singular participle', feats: { VerbForm: 'Part', Case: 'Gen', Number: 'Sing' }, upos: ['VERB', 'AUX'], cues: ['The final -ου is nominal/adjectival; the -μεν- marks the participle family.'] },
  { ending: 'μενων', family: 'middle/passive participle', label: 'genitive plural participle', feats: { VerbForm: 'Part', Case: 'Gen', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['The -μεν- marker plus -ων behaves like an adjective genitive plural ending.'] },
  { ending: 'μενοι', family: 'middle/passive participle', label: 'masculine nominative plural participle', feats: { VerbForm: 'Part', Case: 'Nom', Gender: 'Masc', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Participle marker plus 2nd-declension masculine nominative plural ending.'] },
  { ending: 'μεναι', family: 'middle/passive participle', label: 'feminine nominative plural participle', feats: { VerbForm: 'Part', Case: 'Nom', Gender: 'Fem', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Participle marker plus 1st-declension feminine nominative plural ending.'] },
  { ending: 'μενους', family: 'middle/passive participle', label: 'masculine accusative plural participle', feats: { VerbForm: 'Part', Case: 'Acc', Gender: 'Masc', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Participle marker plus masculine accusative plural ending.'] },
  { ending: 'ων', family: 'active participle', label: 'masculine nominative singular participle', feats: { VerbForm: 'Part' }, upos: ['VERB', 'AUX'], cues: ['Participles decline like adjectives, so verbal + nominal endings stack.'] },
  { ending: 'ουσα', family: 'active participle', label: 'feminine nominative singular participle', feats: { VerbForm: 'Part' }, upos: ['VERB', 'AUX'], cues: ['Participle marker plus 1st-declension feminine ending.'] },
  { ending: 'ομεθα', family: 'middle/passive present or secondary endings', label: '1st plural middle/passive', feats: { Person: '1', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Usually “we … ourselves / are …ed”; tense comes from the stem/augment.'] },
  { ending: 'εσθε', family: 'middle/passive present or imperative', label: '2nd plural middle/passive', feats: { Person: '2', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Usually “you all … yourselves / are …ed”; mood depends on the larger form.'] },
  { ending: 'ετε', family: 'ω-conjugation active', label: '2nd plural present/imperative or past pattern', feats: { Person: '2', Number: 'Plur' }, upos: ['VERB', 'AUX'], cues: ['Common 2nd plural active ending.', 'Can be indicative or imperative, depending on context and tags.'] },
  { ending: 'ον', family: 'active participle or finite secondary ending', label: 'neuter participle nom/acc sg or 1st/3rd plural imperfect', upos: ['VERB', 'AUX'], cues: ['Highly ambiguous: can be nominal participle ending or finite past ending.', 'Use VerbForm/Mood and syntax.'] },
  { ending: 'α', family: 'aorist active / perfect active / participle', label: '1st singular or 3rd singular/plural-like aorist pattern', upos: ['VERB', 'AUX'], cues: ['A bare -α is common in aorist active but not enough alone.', 'Look for sigma/augment/stem change.'] },
  { ending: 'ας', family: 'aorist active / participle', label: '2nd singular finite or masculine participle nom sg', upos: ['VERB', 'AUX'], cues: ['Can be finite aorist active or participial depending on VerbForm/Mood.'] },
  { ending: 'αν', family: 'aorist active / infinitive-like contracted forms', label: '3rd plural aorist active or infinitive contraction', upos: ['VERB', 'AUX'], cues: ['Often “they …ed” in aorist active when finite.'] },
];

function matchingPatterns(form: string, token: Pick<Token, 'upos' | 'feats'>, patterns: EndingPattern[]): EndingPattern[] {
  const normalized = stripDiacritics(form);
  return patterns
    .filter((pattern) => normalized.endsWith(stripDiacritics(pattern.ending)))
    .sort((a, b) => patternScore(token, b) - patternScore(token, a) || b.ending.length - a.ending.length)
    .slice(0, 4);
}

function actualEnding(token: Pick<Token, 'form' | 'upos' | 'feats'>, segments: WordSegment[]): string | null {
  const isParticiple = (token.upos === 'VERB' || token.upos === 'AUX') && token.feats?.VerbForm === 'Part';
  if (isParticiple) {
    const participleIndex = segments.findIndex((s) => s.type === 'participle');
    if (participleIndex >= 0) {
      return segments.slice(participleIndex).map((s) => s.text).join('');
    }
  }

  const preferred = token.upos === 'VERB' || token.upos === 'AUX'
    ? ['personalEnd', 'participle', 'voice', 'tense']
    : ['nominalEnd'];
  for (const type of preferred) {
    const seg = [...segments].reverse().find((s) => s.type === type);
    if (seg?.text) return seg.text;
  }
  return null;
}

function patternListHTML(patterns: EndingPattern[], token: Pick<Token, 'feats'>): string {
  return patterns.map((pattern, idx) => {
    const confidence = pattern.feats && featureMatches(token.feats, pattern.feats) ? 'matches current tag' : 'possible surface match';
    const cues = pattern.cues.map((cue) => `<li>${escapeHTML(cue)}</li>`).join('');
    return `
      <div class="ending-pattern ${idx === 0 ? 'primary' : ''}">
        <div class="ending-pattern-title">
          <span class="ending-pattern-ending">-${escapeHTML(pattern.ending)}</span>
          <span class="ending-pattern-label">${escapeHTML(pattern.label)}</span>
        </div>
        <div class="ending-pattern-family">${escapeHTML(pattern.family)} · ${escapeHTML(confidence)}</div>
        <ul>${cues}</ul>
      </div>`;
  }).join('');
}

export function buildEndingPatternHTML(
  token: Pick<Token, 'form' | 'lemma' | 'upos' | 'feats'>,
  segments: WordSegment[],
): string {
  const isVerbal = token.upos === 'VERB' || token.upos === 'AUX';
  const isNominal = ['NOUN', 'PROPN', 'ADJ', 'DET', 'PRON'].includes(token.upos);
  if (!isVerbal && !isNominal) return '';

  const patterns = matchingPatterns(
    token.form,
    token,
    isVerbal ? VERBAL_PATTERNS : NOMINAL_PATTERNS,
  );

  const ending = actualEnding(token, segments) || patterns[0]?.ending;
  if (patterns.length === 0) {
    if (!ending) return '';
    const isParticiple = isVerbal && token.feats?.VerbForm === 'Part';
    const fallbackFamily = isParticiple ? 'participle surface ending' : isVerbal ? 'verb surface ending' : 'nominal surface ending';
    const fallbackLabel = isParticiple ? 'participle pattern not in the table yet' : isVerbal ? 'not in the pattern table yet' : 'not in the declension table yet';
    patterns.push({
      ending,
      family: fallbackFamily,
      label: fallbackLabel,
      upos: [token.upos],
      cues: [
        'The app found an inflectional ending segment, but this exact surface ending is not in its explanatory table yet.',
        'Trust the CoNLL-U features shown below, and use lemma/stem plus context for the full analysis.',
      ],
    });
  }

  const title = isVerbal ? 'Verb ending pattern' : 'Declension / ending pattern';
  const note = '';

  return `
    <section class="ending-pattern-card">
      <div class="ending-pattern-card-head">
        <span>${escapeHTML(title)}</span>
        <span class="ending-pattern-chip">ending ${escapeHTML(ending)}</span>
      </div>
      ${note ? `<div class="ending-pattern-note">${escapeHTML(note)}</div>` : ''}
      ${patternListHTML(patterns, token)}
    </section>`;
}
