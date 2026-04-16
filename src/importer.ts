import Database from "better-sqlite3";
import { readFileSync, existsSync } from "node:fs";
import { parseConllu } from "./types";
import { runMigrations } from "./db-schema";

// ── Types ───────────────────────────────────────────────────────

export interface EditionMapEntry {
  editionUrn: string;
  authorUrn: string;
  authorName: string;
  workUrn: string;
  workTitle: string;
  language: string;
  editionLabel?: string;
  editionType?: string;
  editionDescription?: string;
}

export interface EditionMap {
  [filename: string]: EditionMapEntry;
}

export interface ImportStats {
  file: string;
  editionId: number;
  editionUrn: string;
  segmentsUpserted: number;
  tokensUpserted: number;
  alignedSegmentsUpserted: number;
  createdAuthor: boolean;
  createdWork: boolean;
  createdEdition: boolean;
}

// ── Importer ────────────────────────────────────────────────────

export function importConlluFile(
  db: Database.Database,
  conlluPath: string,
  mapEntry: EditionMapEntry,
  dryRun: boolean,
): ImportStats {
  runMigrations(db);

  const content = readFileSync(conlluPath, "utf-8");
  const treebank = parseConllu(content, conlluPath);
  const filename = conlluPath.split("/").pop()!;

  console.log(`\n[import] ${filename} → ${mapEntry.editionUrn}`);
  console.log(`  sentences: ${treebank.sentences.length}`);

  if (dryRun) {
    console.log("  [dry-run] skipping database writes");
    return {
      file: filename,
      editionId: 0,
      editionUrn: mapEntry.editionUrn,
      segmentsUpserted: 0,
      tokensUpserted: 0,
      alignedSegmentsUpserted: 0,
      createdAuthor: false,
      createdWork: false,
      createdEdition: false,
    };
  }

  const {
    editionId,
    createdAuthor,
    createdWork,
    createdEdition,
    segmentsUpserted,
    tokensUpserted,
    alignedSegmentsUpserted,
  } = db.transaction(() => {
    const result = ensureEdition(db, mapEntry);
    let segCount = 0;
    let tokCount = 0;
    let alignedCount = 0;

    const upsertSegment = db.prepare(
      `INSERT INTO segments (edition_id, reference, content)
       VALUES (?, ?, ?)
       ON CONFLICT(edition_id, reference) DO UPDATE SET content = excluded.content`,
    );

    const deleteExistingTokens = db.prepare(
      `DELETE FROM treebank_tokens WHERE edition_id = ? AND reference = ?`,
    );

    const insertToken = db.prepare(
      `INSERT INTO treebank_tokens
       (edition_id, reference, token_index, form, lemma, upos, xpos, feats, head, deprel, deps, misc)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    const findAlignedSegment = db.prepare(
      `SELECT id FROM aligned_segments
       WHERE source_urn = ? AND translation_urn = ? AND reference = ?`,
    );
    const insertAlignedSegment = db.prepare(
      `INSERT INTO aligned_segments
       (source_urn, translation_urn, reference, greek, generated, generator, literal_translation)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateAlignedSegment = db.prepare(
      `UPDATE aligned_segments
       SET greek = ?, generated = ?, generator = ?, literal_translation = ?
       WHERE id = ?`,
    );

    for (const sentence of treebank.sentences) {
      upsertSegment.run(result.id, sentence.id, sentence.text);
      segCount++;

      // Delete existing treebank tokens for this ref (idempotent upsert)
      deleteExistingTokens.run(result.id, sentence.id);

      for (const token of sentence.tokens) {
        insertToken.run(
          result.id,
          sentence.id,
          token.id,
          token.form,
          token.lemma || null,
          token.upos,
          token.xpos || null,
          featsToString(token.feats),
          token.head,
          token.deprel,
          token.deps || null,
          miscToString(token.misc),
        );
        tokCount++;
      }

      // Upsert aligned segment if translations exist
      for (const [lang, trans] of Object.entries(sentence.translations)) {
        const translationUrn = `${mapEntry.editionUrn}/trans/${lang}`;
        const existing = findAlignedSegment.get(
          mapEntry.editionUrn,
          translationUrn,
          sentence.id,
        ) as { id: number } | undefined;
        if (existing) {
          updateAlignedSegment.run(
            sentence.text,
            trans.prose,
            "conllu-import",
            trans.literal || null,
            existing.id,
          );
        } else {
          insertAlignedSegment.run(
            mapEntry.editionUrn,
            translationUrn,
            sentence.id,
            sentence.text,
            trans.prose,
            "conllu-import",
            trans.literal || null,
          );
        }
        alignedCount++;
      }
    }

    return {
      editionId: result.id,
      createdAuthor: result.createdAuthor,
      createdWork: result.createdWork,
      createdEdition: result.createdEdition,
      segmentsUpserted: segCount,
      tokensUpserted: tokCount,
      alignedSegmentsUpserted: alignedCount,
    };
  })();

  console.log(`  segments: ${segmentsUpserted}`);
  console.log(`  tokens: ${tokensUpserted}`);
  console.log(`  aligned segments: ${alignedSegmentsUpserted}`);
  if (createdAuthor) console.log(`  ✓ created author: ${mapEntry.authorName}`);
  if (createdWork) console.log(`  ✓ created work: ${mapEntry.workTitle}`);
  if (createdEdition)
    console.log(`  ✓ created edition: ${mapEntry.editionLabel || mapEntry.editionUrn}`);

  return {
    file: filename,
    editionId,
    editionUrn: mapEntry.editionUrn,
    segmentsUpserted,
    tokensUpserted,
    alignedSegmentsUpserted,
    createdAuthor,
    createdWork,
    createdEdition,
  };
}

// ── Edition resolution ──────────────────────────────────────────

interface EnsureResult {
  id: number;
  createdAuthor: boolean;
  createdWork: boolean;
  createdEdition: boolean;
}

const createdTracker = {
  authors: new Set<string>(),
  works: new Set<string>(),
  editions: new Set<string>(),
};

function ensureEdition(
  db: Database.Database,
  entry: EditionMapEntry,
): EnsureResult {
  let createdAuthor = false;
  let createdWork = false;
  let createdEdition = false;

  // 1. Ensure author
  const author = db
    .prepare("SELECT id FROM authors WHERE urn = ?")
    .get(entry.authorUrn) as { id: number } | undefined;

  let authorId: number;
  if (!author) {
    db.prepare("INSERT INTO authors (urn, name) VALUES (?, ?)").run(
      entry.authorUrn,
      entry.authorName,
    );
    const row = db
      .prepare("SELECT id FROM authors WHERE urn = ?")
      .get(entry.authorUrn) as { id: number };
    authorId = row.id;
    createdAuthor = true;
    createdTracker.authors.add(entry.authorUrn);
  } else {
    authorId = author.id;
  }

  // 2. Ensure work
  const work = db
    .prepare("SELECT id FROM works WHERE urn = ?")
    .get(entry.workUrn) as { id: number } | undefined;

  let workId: number;
  if (!work) {
    db.prepare(
      "INSERT INTO works (author_id, urn, title, language) VALUES (?, ?, ?, ?)",
    ).run(authorId, entry.workUrn, entry.workTitle, entry.language);
    const row = db
      .prepare("SELECT id FROM works WHERE urn = ?")
      .get(entry.workUrn) as { id: number };
    workId = row.id;
    createdWork = true;
    createdTracker.works.add(entry.workUrn);
  } else {
    workId = work.id;
  }

  // 3. Ensure edition
  const edition = db
    .prepare("SELECT id FROM editions WHERE urn = ?")
    .get(entry.editionUrn) as { id: number } | undefined;

  let editionId: number;
  if (!edition) {
    db.prepare(
      `INSERT INTO editions (work_id, urn, label, description, language, type, is_lyceum_curated)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
    ).run(
      workId,
      entry.editionUrn,
      entry.editionLabel || null,
      entry.editionDescription || null,
      entry.language,
      entry.editionType || "text",
    );
    const row = db
      .prepare("SELECT id FROM editions WHERE urn = ?")
      .get(entry.editionUrn) as { id: number };
    editionId = row.id;
    createdEdition = true;
    createdTracker.editions.add(entry.editionUrn);
  } else {
    editionId = edition.id;
  }

  return { id: editionId, createdAuthor, createdWork, createdEdition };
}

// ── Helpers ─────────────────────────────────────────────────────

function featsToString(feats: Record<string, string> | undefined): string | null {
  if (!feats || Object.keys(feats).length === 0) return null;
  return Object.entries(feats)
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

function miscToString(misc: Record<string, string> | undefined): string | null {
  if (!misc || Object.keys(misc).length === 0) return null;
  return Object.entries(misc)
    .map(([k, v]) => (v === "" ? k : `${k}=${v}`))
    .join("|");
}
