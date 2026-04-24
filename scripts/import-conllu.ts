import Database from "better-sqlite3";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseConllu } from "../src/types";
import {
  type EditionMap,
  type EditionMapEntry,
  importConlluFile,
} from "../src/importer";
import { runMigrations } from "../src/db-schema";

// Load .env if present
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

// ── Arg parsing ────────────────────────────────────────────────

interface Args {
  path: string;
  dbPath: string;
  mapPath: string;
  dryRun: boolean;
  migrateOnly: boolean;
}

function parseArgs(args: string[]): Args {
  const result: Args = {
    path: "",
    dbPath: process.env.CONLLU_DB_PATH || "",
    mapPath: process.env.CONLLU_MAP_PATH || join(process.cwd(), "conllu-edition-map.json"),
    dryRun: false,
    migrateOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--db":
      case "-d":
        result.dbPath = args[++i];
        break;
      case "--map":
      case "-m":
        result.mapPath = args[++i];
        break;
      case "--dry-run":
        result.dryRun = true;
        break;
      case "--migrate-only":
        result.migrateOnly = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(0);
      default:
        if (!result.path) result.path = args[i];
    }
  }

  return result;
}

function printUsage() {
  console.log(`
Usage: tsx scripts/import-conllu.ts <path> [options]

Import CoNLL-U treebank data into editions.db.

Arguments:
  path          Path to a .conllu file or directory to scan

Options:
  --db, -d      Path to editions.db (required, or set CONLLU_DB_PATH)
  --map, -m     Path to conllu-edition-map.json (default: ./conllu-edition-map.json, or CONLLU_MAP_PATH)
  --dry-run     Parse and report but don't write to DB
  --migrate-only  Only apply schema migrations, then exit
  --help, -h    Show this help

Examples:
  tsx scripts/import-conllu.ts conllu/aesop/fables/perry-257.conllu
  tsx scripts/import-conllu.ts conllu/ --dry-run
  tsx scripts/import-conllu.ts . --migrate-only
`);
}

// ── Main ───────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.path && !args.migrateOnly) {
    console.error("Error: provide a path to a .conllu file or directory");
    printUsage();
    process.exit(1);
  }

  if (!args.dbPath) {
    console.error("Error: --db path or CONLLU_DB_PATH env var is required");
    printUsage();
    process.exit(1);
  }

  // Open database
  if (!existsSync(args.dbPath)) {
    console.error(`Error: editions.db not found at ${args.dbPath}`);
    process.exit(1);
  }

  const db = new Database(args.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  console.log(`[main] database: ${args.dbPath}`);

  // Apply migrations
  runMigrations(db);

  if (args.migrateOnly) {
    db.close();
    return;
  }

  // Load URN map
  let editionMap: EditionMap = {};
  if (existsSync(args.mapPath)) {
    editionMap = JSON.parse(readFileSync(args.mapPath, "utf-8"));
    console.log(`[main] loaded ${Object.keys(editionMap).length} entries from ${args.mapPath}`);
  } else {
    console.log(`[main] no URN map at ${args.mapPath} (using defaults)`);
  }

  // Collect conllu files
  const conlluFiles = resolveConlluFiles(args.path);
  if (conlluFiles.length === 0) {
    console.log("No .conllu files found.");
    db.close();
    return;
  }
  console.log(`[main] found ${conlluFiles.length} .conllu file(s)`);

  // Import each file
  let totalTokens = 0;
  let totalSegments = 0;
  let totalAligned = 0;

  for (const filePath of conlluFiles) {
    const filename = basename(filePath);
    const mapEntry = editionMap[filename];

    if (!mapEntry) {
      console.log(`[skip] ${filename} — no entry in URN map`);
      continue;
    }

    try {
      const stats = importConlluFile(db, filePath, mapEntry, args.dryRun);
      totalTokens += stats.tokensUpserted;
      totalSegments += stats.segmentsUpserted;
      totalAligned += stats.alignedSegmentsUpserted;
    } catch (err: unknown) {
      console.error(`[error] ${filename}:`, err);
    }
  }

  console.log(`\n[summary] segments: ${totalSegments}, tokens: ${totalTokens}, aligned: ${totalAligned}`);

  db.close();
}

// ── Utilities ──────────────────────────────────────────────────

/**
 * Resolve a path to a list of .conllu files.
 * If it's a directory, recurses into it.
 */
function resolveConlluFiles(path: string): string[] {
  if (!existsSync(path)) {
    console.error(`Path not found: ${path}`);
    return [];
  }

  const stat = statSync(path);
  if (stat.isDirectory()) {
    const files = scanDirectory(path).filter(f => f.endsWith(".conllu"));
    return files;
  }

  return [path];
}

function scanDirectory(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDirectory(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

main();
