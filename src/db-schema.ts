import Database from "better-sqlite3";

/**
 * Apply schema migrations needed for treebank import.
 * Idempotent — safe to re-run.
 */
export function runMigrations(db: Database.Database) {
  // 1. treebank_tokens table
  const hasTokens = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='treebank_tokens'"
    )
    .get();

  if (!hasTokens) {
    db.exec(`
      CREATE TABLE treebank_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        edition_id INTEGER NOT NULL REFERENCES editions(id),
        reference TEXT NOT NULL,
        token_index INTEGER NOT NULL,
        form TEXT NOT NULL,
        lemma TEXT,
        upos TEXT,
        xpos TEXT,
        feats TEXT,
        head INTEGER,
        deprel TEXT,
        deps TEXT,
        misc TEXT
      );
      CREATE INDEX idx_tb_tokens_ed_ref ON treebank_tokens(edition_id, reference);
      CREATE INDEX idx_tb_tokens_ed_ref_idx ON treebank_tokens(edition_id, reference, token_index);
    `);
    console.log("[migrate] created treebank_tokens table");
  } else {
    console.log("[migrate] treebank_tokens table already exists");
  }

  // 2. literal_translation column on aligned_segments
  const hasLitCol = db
    .prepare(
      "SELECT 1 FROM pragma_table_info('aligned_segments') WHERE name='literal_translation'"
    )
    .get();

  if (!hasLitCol) {
    db.exec(
      "ALTER TABLE aligned_segments ADD COLUMN literal_translation TEXT DEFAULT NULL"
    );
    console.log("[migrate] added aligned_segments.literal_translation column");
  } else {
    console.log("[migrate] aligned_segments.literal_translation already exists");
  }

  console.log("[migrate] done");
}