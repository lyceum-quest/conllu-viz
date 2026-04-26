#!/usr/bin/env npx tsx
/**
 * CoNLL-U Linter for the conllu-viz project.
 * Validates files against the rules defined in docs/CONLLU.md.
 *
 * Usage:
 *   npx tsx scripts/lint.ts [files...]
 *   npx tsx scripts/lint.ts conllu/aesop/fables/perry-015.conllu
 *   npx tsx scripts/lint.ts conllu/aesop/fables/*.conllu
 *   npx tsx scripts/lint.ts                  # lint all conllu/ files
 */

import * as fs from "fs";
import * as path from "path";

// ─── Constants ───────────────────────────────────────────────────────────────

const VALID_UPOS = new Set([
  "ADJ", "ADP", "ADV", "AUX", "CCONJ", "DET", "INTJ", "NOUN",
  "NUM", "PART", "PRON", "PROPN", "PUNCT", "SCONJ", "VERB",
]);

const VALID_DEPRELS = new Set([
  "root", "nsubj", "nsubj:pass", "obj", "iobj", "csubj", "csubj:pass",
  "ccomp", "xcomp", "nummod", "acl", "acl:relcl", "amod", "appos",
  "advcl", "advmod", "discourse", "vocative", "dislocated", "orphan",
  "obl", "obl:agent", "case", "det", "nmod", "compound", "flat",
  "conj", "cc", "cop", "aux", "mark", "fixed", "parataxis", "punct", "gen",
]);

const VALID_FEAT_KEYS = new Set([
  "Case", "Gender", "Number", "Person", "Tense", "Mood", "Voice",
  "Aspect", "VerbForm", "Degree", "Definite", "PronType", "Polarity",
]);

const VALID_FEAT_VALUES: Record<string, Set<string>> = {
  Case: new Set(["Nom", "Gen", "Dat", "Acc", "Voc"]),
  Gender: new Set(["Masc", "Fem", "Neut", "Com"]),
  Number: new Set(["Sing", "Plur", "Dual"]),
  Person: new Set(["1", "2", "3"]),
  Tense: new Set(["Pres", "Imp", "Aor", "Perf", "Fut"]),
  Mood: new Set(["Ind", "Sub", "Opt", "Imp", "Inf", "Part"]),
  Voice: new Set(["Act", "Mid", "Pass"]),
  Aspect: new Set(["Imp", "Perf"]),
  VerbForm: new Set(["Fin", "Inf", "Part", "Ger"]),
  Degree: new Set(["Pos", "Cmp", "Sup"]),
  Definite: new Set(["Def"]),
  PronType: new Set(["Art", "Dem", "Int", "Rel", "Prs", "Rcp", "Ind"]),
  Polarity: new Set(["Neg"]),
};

const REQUIRED_FILE_HEADERS = [
  "global.columns",
  "source",
  "source_edition",
  "encoder",
  "editor",
  "project",
  "conversion_method",
  "gloss_type",
  "license",
  "date_modified",
  "contact",
];

const REQUIRED_SENTENCE_HEADERS = [
  "sent_id",
  "text",
  "translation_lang",
  "prose_translation",
  "literal_translation",
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface Finding {
  severity: "error" | "warning";
  location: string; // file:line or file:sent_id:tok
  rule: string;
  message: string;
}

interface Token {
  id: string;
  form: string;
  lemma: string;
  upos: string;
  xpos: string;
  featsStr: string;
  head: string;
  deprel: string;
  deps: string;
  misc: string;
  feats: Record<string, string>;
  lineNum: number;
}

interface Sentence {
  headers: Record<string, string>;
  tokens: Token[];
  startLine: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseFeats(str: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!str || str === "_") return map;
  for (const pair of str.split("|")) {
    const eq = pair.indexOf("=");
    if (eq > 0) map[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return map;
}

function detectWorkType(filePath: string): "aesop" | "xenophon" | "unknown" {
  if (filePath.includes("aesop")) return "aesop";
  if (filePath.includes("xenophon")) return "xenophon";
  return "unknown";
}

function loc(file: string, sentId?: string, tokId?: string, lineNum?: number): string {
  let s = file;
  if (sentId) s += `:${sentId}`;
  if (tokId) s += `[${tokId}]`;
  if (lineNum) s += `:L${lineNum}`;
  return s;
}

// ─── Linter ──────────────────────────────────────────────────────────────────

function lintFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  const fileName = path.basename(filePath);
  const workType = detectWorkType(filePath);
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  // ── Phase 1: Parse file-level headers ──
  let firstTokenLine = -1;
  const fileHeaders: Record<string, string> = {};
  let fileHeaderEnd = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("# ") && !line.startsWith("# text") && !line.startsWith("# sent_id") &&
        !line.startsWith("# parallel_id") && !line.startsWith("# translation_lang") &&
        !line.startsWith("# prose_translation") && !line.startsWith("# literal_translation") &&
        !line.startsWith("# title") && !line.startsWith("# document_id") && !line.startsWith("# subdoc") &&
        !line.startsWith("# sentence_id")) {
      const m = line.match(/^#\s+(\w+)\s*=\s*(.*)/);
      if (m) {
        fileHeaders[m[1]] = m[2].trim();
        fileHeaderEnd = i + 1;
      }
    } else if (line.startsWith("#") && !line.match(/^#\s+\w+\s*=/)) {
      // comment line not a key=value, skip
      fileHeaderEnd = i + 1;
      continue;
    } else if (line === "" || line.match(/^\d/)) {
      break;
    } else {
      fileHeaderEnd = i + 1;
    }
  }

  // Check required file-level headers
  for (const key of REQUIRED_FILE_HEADERS) {
    if (!(key in fileHeaders)) {
      findings.push({
        severity: "error",
        location: loc(fileName),
        rule: "file-header-missing",
        message: `Missing required file header: # ${key} = ...`,
      });
    }
  }

  // Validate global.columns value
  if (fileHeaders["global.columns"]) {
    const expected = "ID FORM LEMMA UPOS XPOS FEATS HEAD DEPREL DEPS MISC";
    if (fileHeaders["global.columns"] !== expected) {
      findings.push({
        severity: "error",
        location: loc(fileName),
        rule: "file-header-columns",
        message: `global.columns should be "${expected}", got "${fileHeaders["global.columns"]}"`,
      });
    }
  }

  // Validate date_modified format
  if (fileHeaders["date_modified"]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fileHeaders["date_modified"])) {
      findings.push({
        severity: "error",
        location: loc(fileName),
        rule: "file-header-date",
        message: `date_modified should be YYYY-MM-DD, got "${fileHeaders["date_modified"]}"`,
      });
    }
  }

  // Validate license
  if (fileHeaders["license"] && fileHeaders["license"] !== "CC BY-SA 4.0") {
    findings.push({
      severity: "warning",
      location: loc(fileName),
      rule: "file-header-license",
      message: `license is "${fileHeaders["license"]}", expected "CC BY-SA 4.0"`,
    });
  }

  // Validate contact default
  if (workType === "aesop" && fileHeaders["contact"] &&
      fileHeaders["contact"] !== "support@lyceum.quest") {
    findings.push({
      severity: "warning",
      location: loc(fileName),
      rule: "file-header-contact",
      message: `contact is "${fileHeaders["contact"]}", default should be "support@lyceum.quest"`,
    });
  }

  // ── Phase 2: Parse sentences ──
  const sentences: Sentence[] = [];
  let currentHeaders: Record<string, string> = {};
  let currentTokens: Token[] = [];
  let currentStartLine = 0;
  let firstSentence = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("#")) {
      const m = line.match(/^#\s+(\w+)\s*=\s*(.*)/);
      if (m) {
        if (Object.keys(currentHeaders).length === 0) currentStartLine = i + 1;
        currentHeaders[m[1]] = m[2].trim();
      }
    } else if (line === "") {
      if (currentTokens.length > 0 || Object.keys(currentHeaders).length > 0) {
        sentences.push({
          headers: currentHeaders,
          tokens: currentTokens,
          startLine: currentStartLine,
        });
        currentHeaders = {};
        currentTokens = [];
        firstSentence = false;
      }
    } else {
      // Token line
      const parts = line.split("\t");
      if (parts.length >= 10) {
        const tid = parts[0];
        // Skip multiword tokens (e.g. "1-2") and empty nodes (e.g. "1.1")
        if (/^\d+$/.test(tid)) {
          currentTokens.push({
            id: tid,
            form: parts[1],
            lemma: parts[2],
            upos: parts[3],
            xpos: parts[4],
            featsStr: parts[5],
            head: parts[6],
            deprel: parts[7],
            deps: parts[8],
            misc: parts[9],
            feats: parseFeats(parts[5]),
            lineNum: i + 1,
          });
        }
      } else if (parts.length > 1) {
        findings.push({
          severity: "error",
          location: loc(fileName, undefined, undefined, i + 1),
          rule: "token-columns",
          message: `Token row has ${parts.length} columns, expected 10`,
        });
      }
    }
  }
  // Flush last sentence
  if (currentTokens.length > 0 || Object.keys(currentHeaders).length > 0) {
    sentences.push({
      headers: currentHeaders,
      tokens: currentTokens,
      startLine: currentStartLine,
    });
  }

  // ── Phase 3: Validate sentences ──
  firstSentence = true;
  for (const sent of sentences) {
    const sid = sent.headers["sent_id"] || `L${sent.startLine}`;

    // Required sentence headers
    for (const key of REQUIRED_SENTENCE_HEADERS) {
      if (!(key in sent.headers)) {
        findings.push({
          severity: "error",
          location: loc(fileName, sid),
          rule: "sent-header-missing",
          message: `Missing required sentence header: # ${key} = ...`,
        });
      }
    }

    // Work-type-specific headers
    if (workType === "aesop") {
      if (firstSentence && !("title" in sent.headers)) {
        findings.push({
          severity: "error",
          location: loc(fileName, sid),
          rule: "sent-header-title",
          message: "Aesop first sentence must have # title = ...",
        });
      }
      if (!("parallel_id" in sent.headers)) {
        findings.push({
          severity: "error",
          location: loc(fileName, sid),
          rule: "sent-header-parallel",
          message: "Aesop sentence must have # parallel_id = ...",
        });
      }
    }
    if (workType === "xenophon") {
      if (!("document_id" in sent.headers) && !sent.headers["sentence_id"]) {
        findings.push({
          severity: "warning",
          location: loc(fileName, sid),
          rule: "sent-header-docid",
          message: "Xenophon sentence should have # document_id = ...",
        });
      }
      if (!("subdoc" in sent.headers)) {
        findings.push({
          severity: "warning",
          location: loc(fileName, sid),
          rule: "sent-header-subdoc",
          message: "Xenophon sentence should have # subdoc = ...",
        });
      }
    }

    // sent_id format
    if (sent.headers["sent_id"]) {
      const sentId = sent.headers["sent_id"];
      if (workType === "aesop" && !/^perry-\d+-s\d+$/.test(sentId)) {
        findings.push({
          severity: "warning",
          location: loc(fileName, sid),
          rule: "sent-id-format",
          message: `Aesop sent_id should match perry-NNN-sN, got "${sentId}"`,
        });
      }
      if (workType === "xenophon" && !/^xen-anabasis-\d+-s\d+$/.test(sentId) &&
          !/^\d+$/.test(sentId)) {
        findings.push({
          severity: "warning",
          location: loc(fileName, sid),
          rule: "sent-id-format",
          message: `Xenophon sent_id should match xen-anabasis-NN-sN, got "${sentId}"`,
        });
      }
    }

    // translation_lang
    if (sent.headers["translation_lang"] && sent.headers["translation_lang"] !== "en") {
      findings.push({
        severity: "warning",
        location: loc(fileName, sid),
        rule: "sent-translation-lang",
        message: `translation_lang is "${sent.headers["translation_lang"]}", expected "en"`,
      });
    }

    // ── Validate tokens ──
    const tokMap = new Map<string, Token>();
    for (const t of sent.tokens) tokMap.set(t.id, t);

    // Check for exactly one root
    const roots = sent.tokens.filter(t => t.head === "0");
    if (roots.length === 0 && sent.tokens.length > 0) {
      findings.push({
        severity: "error",
        location: loc(fileName, sid),
        rule: "no-root",
        message: "Sentence has no root token (HEAD=0)",
      });
    } else if (roots.length > 1) {
      findings.push({
        severity: "error",
        location: loc(fileName, sid),
        rule: "multiple-roots",
        message: `Sentence has ${roots.length} root tokens (HEAD=0), expected 1`,
      });
    }

    for (const t of sent.tokens) {
      const tloc = loc(fileName, sid, t.id, t.lineNum);

      // UPOS validation
      if (!VALID_UPOS.has(t.upos)) {
        // Check for common mistakes
        if (t.upos === "CONJ") {
          findings.push({
            severity: "error",
            location: tloc,
            rule: "upos-conj",
            message: `${t.form}: UPOS=CONJ (should be CCONJ)`,
          });
        } else {
          findings.push({
            severity: "error",
            location: tloc,
            rule: "upos-invalid",
            message: `${t.form}: Invalid UPOS "${t.upos}"`,
          });
        }
      }

      // DEPREL validation
      if (!VALID_DEPRELS.has(t.deprel)) {
        // Check for deprecated nsubjpass
        if (t.deprel === "nsubjpass") {
          findings.push({
            severity: "error",
            location: tloc,
            rule: "deprel-deprecated",
            message: `${t.form}: DEPREL=nsubjpass (deprecated, use nsubj:pass)`,
          });
        } else {
          findings.push({
            severity: "error",
            location: tloc,
            rule: "deprel-invalid",
            message: `${t.form}: Invalid DEPREL "${t.deprel}"`,
          });
        }
      }

      // HEAD must reference valid token or be "0"
      if (t.head !== "0") {
        if (!tokMap.has(t.head)) {
          findings.push({
            severity: "error",
            location: tloc,
            rule: "head-invalid",
            message: `${t.form}: HEAD=${t.head} does not reference a valid token ID`,
          });
        }
      }

      // DEPS must be "_"
      if (t.deps !== "_") {
        findings.push({
          severity: "warning",
          location: tloc,
          rule: "deps-not-empty",
          message: `${t.form}: DEPS="${t.deps}" (should be "_"; enhanced dependencies not used)`,
        });
      }

      // FEATS validation
      for (const [key, value] of Object.entries(t.feats)) {
        // Check known feature keys
        if (!VALID_FEAT_KEYS.has(key)) {
          findings.push({
            severity: "warning",
            location: tloc,
            rule: "feat-unknown-key",
            message: `${t.form}: Unknown feature key "${key}"`,
          });
        } else if (VALID_FEAT_VALUES[key] && !VALID_FEAT_VALUES[key].has(value)) {
          // Check for Mood=Subj → should be Sub
          if (key === "Mood" && value === "Subj") {
            findings.push({
              severity: "error",
              location: tloc,
              rule: "feat-mood-subj",
              message: `${t.form}: Mood=Subj (should be Sub)`,
            });
          } else {
            findings.push({
              severity: "warning",
              location: tloc,
              rule: "feat-unknown-value",
              message: `${t.form}: Unknown value "${value}" for feature "${key}"`,
            });
          }
        }
      }

      // Contradictory features: Aspect=Perf + Tense=Fut
      if (t.feats["Aspect"] === "Perf" && t.feats["Tense"] === "Fut") {
        findings.push({
          severity: "error",
          location: tloc,
          rule: "feat-contradiction",
          message: `${t.form}: Aspect=Perf + Tense=Fut is contradictory`,
        });
      }

      // NOUN with Degree=Cmp is suspicious
      if (t.upos === "NOUN" && t.feats["Degree"] === "Cmp") {
        findings.push({
          severity: "warning",
          location: tloc,
          rule: "noun-degree-cmp",
          message: `${t.form}: NOUN with Degree=Cmp (should this be ADJ?)`,
        });
      }

      // MISC must contain gloss=
      if (t.misc === "_" || !t.misc.includes("gloss=")) {
        findings.push({
          severity: "error",
          location: tloc,
          rule: "misc-missing-gloss",
          message: `${t.form}: MISC missing required gloss= (got "${t.misc}")`,
        });
      }

      // MISC keys should be lowercase
      if (t.misc !== "_") {
        for (const pair of t.misc.split("|")) {
          const eq = pair.indexOf("=");
          const key = eq > 0 ? pair.slice(0, eq) : pair;
          if (key !== key.toLowerCase() && key !== "Ref") {
            // Ref is a known exception for Xenophon
            findings.push({
              severity: "warning",
              location: tloc,
              rule: "misc-key-case",
              message: `${t.form}: MISC key "${key}" should be lowercase`,
            });
          }
        }
      }

      // DET gender must match head noun gender
      if (t.upos === "DET" && t.deprel === "det") {
        const headTok = tokMap.get(t.head);
        if (headTok && t.feats["Gender"] && headTok.feats["Gender"]) {
          if (t.feats["Gender"] !== headTok.feats["Gender"]) {
            findings.push({
              severity: "error",
              location: tloc,
              rule: "det-gender-mismatch",
              message: `${t.form} Gender=${t.feats["Gender"]} but head ${headTok.form} Gender=${headTok.feats["Gender"]}`,
            });
          }
        }
      }

      // DET with Case pointing to VERB without Case (likely wrong head)
      if (t.upos === "DET" && t.deprel === "det") {
        const headTok = tokMap.get(t.head);
        if (headTok && headTok.upos === "VERB" && "Case" in t.feats && !("Case" in headTok.feats)) {
          findings.push({
            severity: "warning",
            location: tloc,
            rule: "det-verb-head",
            message: `${t.form} (DET) -> ${headTok.form} (VERB) — verify head`,
          });
        }
      }

      // PUNCT should have deprel=punct and vice versa
      if (t.upos === "PUNCT" && t.deprel !== "punct") {
        findings.push({
          severity: "warning",
          location: tloc,
          rule: "punct-deprel",
          message: `${t.form}: UPOS=PUNCT but DEPREL=${t.deprel} (expected "punct")`,
        });
      }
      if (t.upos !== "PUNCT" && t.deprel === "punct") {
        findings.push({
          severity: "warning",
          location: tloc,
          rule: "punct-upos",
          message: `${t.form}: DEPREL=punct but UPOS=${t.upos} (expected "PUNCT")`,
        });
      }

      // # text should match reconstructed text from FORM fields
      // (checked per-sentence below)
    }

    // Validate # text matches reconstructed FORMs
    // CoNLL-U convention: punctuation is separate tokens but # text may have
    // them attached without spaces (e.g. "word," not "word ,")
    if (sent.headers["text"] && sent.tokens.length > 0) {
      const reconstructed = sent.tokens.map(t => t.form).join(" ");
      // Normalize for comparison: collapse whitespace, strip spaces before punctuation
      const normalize = (s: string) =>
        s.replace(/\s+/g, " ").trim()
         .replace(/ ([.,;:·?!·"()])/g, "$1")  // remove space before punct
         .replace(/" /g, '"')                   // remove space after opening quote
         .replace(/ "/g, '"');                   // remove space before closing quote
      const normExpected = normalize(sent.headers["text"]);
      const normActual = normalize(reconstructed);
      if (normExpected !== normActual) {
        findings.push({
          severity: "warning",
          location: loc(fileName, sid),
          rule: "text-mismatch",
          message: `# text doesn't match FORM tokens.\n  Expected: ${normExpected}\n  Reconstructed: ${normActual}`,
        });
      }
    }

    // Validate Ref= in MISC for Xenophon
    if (workType === "xenophon") {
      for (const t of sent.tokens) {
        if (!t.misc.includes("Ref=")) {
          findings.push({
            severity: "warning",
            location: loc(fileName, sid, t.id, t.lineNum),
            rule: "xenophon-missing-ref",
            message: `${t.form}: Xenophon token missing Ref= in MISC`,
          });
        }
      }
    }

    firstSentence = false;
  }

  // Check that the file has at least one sentence
  if (sentences.length === 0) {
    findings.push({
      severity: "error",
      location: loc(fileName),
      rule: "empty-file",
      message: "File contains no sentences",
    });
  }

  return findings;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  let files: string[];
  if (args.length > 0) {
    files = args;
  } else {
    // Find all .conllu files under conllu/
    const conlluDir = path.join(path.dirname(import.meta.url.replace("file://", "")), "..", "conllu");
    files = findConlluFiles(conlluDir);
  }

  if (files.length === 0) {
    console.log("No .conllu files found.");
    process.exit(0);
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  let cleanFiles = 0;

  for (const filePath of files) {
    const relPath = path.relative(process.cwd(), filePath) || filePath;
    const findings = lintFile(filePath);

    if (findings.length === 0) {
      console.log(`✓ ${relPath}`);
      cleanFiles++;
      continue;
    }

    const errors = findings.filter(f => f.severity === "error");
    const warnings = findings.filter(f => f.severity === "warning");
    totalErrors += errors.length;
    totalWarnings += warnings.length;

    const icon = errors.length > 0 ? "✗" : "⚠";
    console.log(`\n${icon} ${relPath} (${errors.length} errors, ${warnings.length} warnings)`);

    for (const f of findings) {
      const marker = f.severity === "error" ? "✗" : "⚠";
      console.log(`  ${marker} [${f.rule}] ${f.location}: ${f.message}`);
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Files: ${files.length} checked, ${cleanFiles} clean`);
  console.log(`Total: ${totalErrors} errors, ${totalWarnings} warnings`);

  process.exit(totalErrors > 0 ? 1 : 0);
}

function findConlluFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findConlluFiles(fullPath));
    } else if (entry.name.endsWith(".conllu")) {
      results.push(fullPath);
    }
  }
  return results;
}

main();
