#!/usr/bin/env npx tsx
/**
 * Tests for the CoNLL-U linter.
 * Run: npx tsx scripts/lint-test.ts
 */

import { lintContent, Finding } from "./lint.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  } else {
    passed++;
  }
}

function rules(findings: Finding[]): string[] {
  return findings.map(f => f.rule);
}

function errors(findings: Finding[]): Finding[] {
  return findings.filter(f => f.severity === "error");
}

function warnings(findings: Finding[]): Finding[] {
  return findings.filter(f => f.severity === "warning");
}

// ─── Minimal valid Aesop file ────────────────────────────────────────────────

const AESOP_HEADERS = `
# global.columns = ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC
# source = Aesop, Fables (Chambry edition)
# source_edition = Chambry (Perry numbering)
# encoder = LLM-assisted
# editor = Brandon Lucas
# project = Lyceum Digital Library
# conversion_method = Manual annotation with LLM assistance
# gloss_type = Context-aware philological glosses
# license = CC BY-SA 4.0
# date_modified = 2026-01-01
# contact = support@lyceum.quest
`.trim();

const AESOP_SENT = `
# title = Test Fable
# sent_id = perry-999-s1
# text = ὁ ἀλώπηξ τρέχει
# parallel_id = lyceum-aesop-p999/s1
# translation_lang = en
# prose_translation = The fox runs.
# literal_translation = The fox runs.
1\tὁ\tὁ\tDET\tarticle.masc.sg.nom\tDefinite=Def|Gender=Masc|Number=Sing|Case=Nom\t2\tdet\t_\tgloss=the
2\tἀλώπηξ\tἀλώπηξ\tNOUN\tnoun.masc.sg.nom\tGender=Masc|Number=Sing|Case=Nom\t3\tnsubj\t_\tgloss=fox
3\tτρέχει\tτρέχω\tVERB\tverb.pres.ind.act.3sg\tMood=Ind|Tense=Pres|VerbForm=Fin|Voice=Act|Number=Sing|Person=3\t0\troot\t_\tgloss=runs
`.trim();

function validAesop(): string {
  return AESOP_HEADERS + "\n\n" + AESOP_SENT;
}

// ─── Test: Valid file passes ─────────────────────────────────────────────────

console.log("Valid file passes cleanly");
{
  const findings = lintContent(validAesop(), "conllu/aesop/fables/perry-999.conllu");
  assert(errors(findings).length === 0, `Expected 0 errors, got ${errors(findings).length}: ${errors(findings).map(e => e.rule).join(", ")}`);
  assert(warnings(findings).length === 0, `Expected 0 warnings, got ${warnings(findings).length}: ${warnings(findings).map(w => w.rule).join(", ")}`);
}

// ─── Test: Missing file headers ──────────────────────────────────────────────

console.log("Missing file headers detected");
{
  const content = AESOP_SENT;  // no file headers
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  const r = rules(errors(findings));
  assert(r.includes("file-header-missing"), "Should detect missing file headers");
  // Should report all 11 missing headers
  const headerErrors = errors(findings).filter(f => f.rule === "file-header-missing");
  assert(headerErrors.length === 11, `Expected 11 missing header errors, got ${headerErrors.length}`);
}

// ─── Test: Invalid global.columns ────────────────────────────────────────────

console.log("Invalid global.columns detected");
{
  const content = AESOP_HEADERS.replace(
    "ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC",
    "ID FORM LEMMA UPOS FEATS HEAD DEPREL DEPS MISC"
  ) + "\n\n" + AESOP_SENT;
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("file-header-columns"), "Should detect bad global.columns");
}

// ─── Test: Bad date format ───────────────────────────────────────────────────

console.log("Bad date_modified format detected");
{
  const content = AESOP_HEADERS.replace("2026-01-01", "Jan 1 2026") + "\n\n" + AESOP_SENT;
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("file-header-date"), "Should detect bad date format");
}

// ─── Test: Missing sentence headers ──────────────────────────────────────────

console.log("Missing sentence headers detected");
{
  // Aesop sentence missing parallel_id and literal_translation
  const content = AESOP_HEADERS + "\n\n" + `
# title = Test Fable
# sent_id = perry-999-s1
# text = ὁ ἀλώπηξ τρέχει
# translation_lang = en
# prose_translation = The fox runs.
1\tὁ\tὁ\tDET\tarticle.masc.sg.nom\tDefinite=Def|Gender=Masc|Number=Sing|Case=Nom\t2\tdet\t_\tgloss=the
2\tἀλώπηξ\tἀλώπηξ\tNOUN\tnoun.masc.sg.nom\tGender=Masc|Number=Sing|Case=Nom\t3\tnsubj\t_\tgloss=fox
3\tτρέχει\tτρέχω\tVERB\tverb.pres.ind.act.3sg\tMood=Ind|Tense=Pres|VerbForm=Fin|Voice=Act|Number=Sing|Person=3\t0\troot\t_\tgloss=runs
`.trim();
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  const r = rules(errors(findings));
  assert(r.includes("sent-header-missing"), "Should detect missing sent headers");
  assert(r.includes("sent-header-parallel"), "Should detect missing parallel_id for Aesop");
}

// ─── Test: Missing Aesop title ───────────────────────────────────────────────

console.log("Missing Aesop title on first sentence");
{
  const content = AESOP_HEADERS + "\n\n" + AESOP_SENT.replace("# title = Test Fable\n", "");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("sent-header-title"), "Should detect missing title");
}

// ─── Test: Invalid UPOS ─────────────────────────────────────────────────────

console.log("Invalid UPOS detected");
{
  const content = validAesop().replace("NOUN", "CONJ");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("upos-conj"), "Should detect CONJ → CCONJ");
}

console.log("Unknown UPOS detected");
{
  const content = validAesop().replace("NOUN", "BOGUS");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("upos-invalid"), "Should detect invalid UPOS");
}

// ─── Test: Invalid DEPREL ────────────────────────────────────────────────────

console.log("Deprecated DEPREL detected");
{
  const content = validAesop().replace("nsubj", "nsubjpass");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("deprel-deprecated"), "Should detect deprecated nsubjpass");
}

console.log("Invalid DEPREL detected");
{
  const content = validAesop().replace("nsubj", "bogrel");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("deprel-invalid"), "Should detect invalid DEPREL");
}

// ─── Test: HEAD validation ───────────────────────────────────────────────────

console.log("Invalid HEAD reference detected");
{
  // Change head to non-existent token
  const content = validAesop().replace("\t2\tdet\t_", "\t99\tdet\t_");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("head-invalid"), "Should detect invalid HEAD");
}

console.log("No root detected");
{
  // Change HEAD=0 to HEAD=2 so there's no root
  const content = validAesop().replace("\t0\troot\t_", "\t2\troot\t_");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("no-root"), "Should detect missing root");
}

console.log("Multiple roots detected");
{
  // Make the noun also a root
  const content = validAesop()
    .replace("Gender=Masc|Number=Sing|Case=Nom\t3\tnsubj", "Gender=Masc|Number=Sing|Case=Nom\t0\tnsubj");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("multiple-roots"), "Should detect multiple roots");
}

// ─── Test: DEPS not "_" ─────────────────────────────────────────────────────

console.log("Non-empty DEPS flagged");
{
  const content = validAesop().replace("\troot\t_\tgloss=runs", "\troot\t0:root\tgloss=runs");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("deps-not-empty"), "Should flag non-empty DEPS");
}

// ─── Test: FEATS validation ──────────────────────────────────────────────────

console.log("Unknown feature key flagged");
{
  const content = validAesop().replace("Mood=Ind", "Mood=Ind|Foo=Bar");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("feat-unknown-key"), "Should flag unknown feat key");
}

console.log("Mood=Subj → Sub flagged");
{
  const content = validAesop().replace("Mood=Ind", "Mood=Subj");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("feat-mood-subj"), "Should flag Mood=Subj");
}

console.log("Contradictory Aspect=Perf + Tense=Fut");
{
  const content = validAesop().replace("Mood=Ind|Tense=Pres", "Mood=Ind|Tense=Fut|Aspect=Perf");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("feat-contradiction"), "Should flag Perf+Fut contradiction");
}

console.log("Unknown feature value flagged");
{
  const content = validAesop().replace("Tense=Pres", "Tense=Past");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("feat-unknown-value"), "Should flag unknown feat value");
}

// ─── Test: MISC validation ───────────────────────────────────────────────────

console.log("Missing gloss= in MISC");
{
  const content = validAesop().replace("gloss=runs", "Ref=1.1.1");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("misc-missing-gloss"), "Should flag missing gloss");
}

console.log("MISC _ with no gloss");
{
  const content = validAesop().replace("gloss=runs", "_");
  // This creates a tab issue — the MISC column gets "_" but there's extra text
  // Let's do a cleaner replacement
  const lines = content.split("\n");
  const lastTokenLine = lines.findIndex(l => l.includes("gloss=runs"));
  if (lastTokenLine >= 0) {
    const parts = lines[lastTokenLine].split("\t");
    parts[9] = "_";
    lines[lastTokenLine] = parts.join("\t");
  }
  const fixed = lines.join("\n");
  const findings = lintContent(fixed, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("misc-missing-gloss"), "Should flag MISC=_ without gloss");
}

console.log("Uppercase MISC key flagged");
{
  const content = validAesop().replace("gloss=runs", "Gloss=runs");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("misc-key-case"), "Should flag uppercase MISC key");
}

// ─── Test: DET gender mismatch ───────────────────────────────────────────────

console.log("DET gender mismatch with head");
{
  // Change article to feminine but keep noun masculine
  const content = validAesop()
    .replace("article.masc.sg.nom\tDefinite=Def|Gender=Masc", "article.fem.sg.nom\tDefinite=Def|Gender=Fem");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("det-gender-mismatch"), "Should flag DET gender mismatch");
}

// ─── Test: DET → VERB head warning ───────────────────────────────────────────

console.log("DET pointing to VERB head");
{
  // Make the article point to the verb instead of the noun
  const content = validAesop().replace("\t2\tdet\t_\tgloss=the", "\t3\tdet\t_\tgloss=the");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("det-verb-head"), "Should warn about DET → VERB");
}

// ─── Test: PUNCT/deprel consistency ──────────────────────────────────────────

console.log("PUNCT with non-punct deprel");
{
  // Add a punctuation token with wrong deprel
  const sent = AESOP_SENT + "\n4\t.\t.\tPUNCT\tpunctuation\t_\t3\tadvmod\t_\tgloss=.";
  const content = AESOP_HEADERS + "\n\n" + sent;
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("punct-deprel"), "Should warn PUNCT with non-punct deprel");
}

console.log("punct deprel on non-PUNCT");
{
  // Use punct deprel on a noun
  const content = validAesop().replace("\tnsubj\t_", "\tpunct\t_");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("punct-upos"), "Should warn non-PUNCT with punct deprel");
}

// ─── Test: NOUN with Degree=Cmp ──────────────────────────────────────────────

console.log("NOUN with Degree=Cmp flagged");
{
  const content = validAesop().replace(
    "Gender=Masc|Number=Sing|Case=Nom\t3\tnsubj",
    "Gender=Masc|Number=Sing|Case=Nom|Degree=Cmp\t3\tnsubj"
  );
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("noun-degree-cmp"), "Should flag NOUN with Degree=Cmp");
}

// ─── Test: sent_id format ────────────────────────────────────────────────────

console.log("Bad Aesop sent_id format");
{
  const content = validAesop().replace("perry-999-s1", "aesop-999-s1");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("sent-id-format"), "Should flag bad Aesop sent_id");
}

// ─── Test: Xenophon-specific checks ──────────────────────────────────────────

console.log("Xenophon missing Ref= in MISC");
{
  const xenophonContent = AESOP_HEADERS
    .replace("Aesop, Fables (Chambry edition)", "Xenophon, Anabasis (Book 1)")
    .replace("Chambry (Perry numbering)", "Glaux")
    .replace("perry-999-s1", "xen-anabasis-01-s1")
    .replace("# title = Test Fable\n", "")
    .replace("# parallel_id = lyceum-aesop-p999/s1\n", "")
    + "\n\n" + AESOP_SENT.replace("perry-999-s1", "xen-anabasis-01-s1");
  const findings = lintContent(xenophonContent, "conllu/xenophon/anabasis/book-01.tb.conllu");
  assert(rules(warnings(findings)).includes("xenophon-missing-ref"), "Should flag missing Ref= for Xenophon");
}

// ─── Test: Token column count ────────────────────────────────────────────────

console.log("Too few columns in token row");
{
  const content = validAesop().replace(
    "\tVERB\tverb.pres.ind.act.3sg\tMood=Ind|Tense=Pres|VerbForm=Fin|Voice=Act|Number=Sing|Person=3\t0\troot\t_\tgloss=runs",
    "\tVERB\tverb.pres.ind.act.3sg"
  );
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("token-columns"), "Should flag wrong column count");
}

// ─── Test: Empty file ────────────────────────────────────────────────────────

console.log("Empty file detected");
{
  const findings = lintContent(AESOP_HEADERS, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(errors(findings)).includes("empty-file"), "Should flag empty file");
}

// ─── Test: translation_lang check ────────────────────────────────────────────

console.log("Non-en translation_lang flagged");
{
  const content = validAesop().replace("translation_lang = en", "translation_lang = fr");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("sent-translation-lang"), "Should flag non-en translation_lang");
}

// ─── Test: license check ─────────────────────────────────────────────────────

console.log("Non-standard license flagged");
{
  const content = validAesop().replace("CC BY-SA 4.0", "MIT");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("file-header-license"), "Should flag non-standard license");
}

// ─── Test: Ref key allowed as exception in MISC ──────────────────────────────

console.log("Ref= key in MISC is not flagged");
{
  const content = validAesop().replace("gloss=the", "Ref=1.1.1|gloss=the");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  const hasCaseWarning = warnings(findings).some(f => f.rule === "misc-key-case");
  assert(!hasCaseWarning, "Ref= should be allowed as exception in MISC");
}

// ─── Test: contact check for Aesop ───────────────────────────────────────────

console.log("Non-default Aesop contact flagged");
{
  const content = validAesop().replace("support@lyceum.quest", "other@example.com");
  const findings = lintContent(content, "conllu/aesop/fables/perry-999.conllu");
  assert(rules(warnings(findings)).includes("file-header-contact"), "Should flag non-default Aesop contact");
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
