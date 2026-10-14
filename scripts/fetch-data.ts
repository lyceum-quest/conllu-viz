#!/usr/bin/env tsx
/**
 * fetch-data.ts — Install the preloaded treebanks from the Archeion release pinned in data.lock.json.
 *
 * Archeion (https://github.com/lyceum-quest/archeion) holds the data; this app only serves it. The archive is
 * checked against the pinned SHA-256, then replaces public/preload/ (conllu-files.json and the treebanks it lists).
 * Runs before every build.
 *
 * Usage:
 *   npx tsx scripts/fetch-data.ts
 *   CONLLU_VIZ_DATA_ARCHIVE=path/to/conllu-viz-preload.tar.gz npx tsx scripts/fetch-data.ts   # a local archive
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

interface DataLock {
  release: string;
  url: string;
  sha256: string;
}

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const lock = JSON.parse(readFileSync(path.join(root, "data.lock.json"), "utf8")) as DataLock;
const target = path.join(root, "public", "preload");

async function archiveBytes(): Promise<Buffer> {
  const local = process.env.CONLLU_VIZ_DATA_ARCHIVE;
  if (local) return readFileSync(local);
  const res = await fetch(lock.url);
  if (!res.ok) throw new Error(`Failed to fetch ${lock.url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const bytes = await archiveBytes();
  const sum = createHash("sha256").update(bytes).digest("hex");
  if (sum !== lock.sha256) {
    throw new Error(`${lock.release} has SHA-256 ${sum}, but data.lock.json pins ${lock.sha256}`);
  }

  const scratch = mkdtempSync(path.join(root, "public", ".preload-"));
  try {
    const archive = path.join(scratch, "preload.tar.gz");
    writeFileSync(archive, bytes);
    const extracted = path.join(scratch, "preload");
    execFileSync("mkdir", [extracted]);
    execFileSync("tar", ["-xzf", archive, "-C", extracted]);
    if (!existsSync(path.join(extracted, "conllu-files.json"))) {
      throw new Error(`${lock.release} has no conllu-files.json`);
    }
    rmSync(target, { recursive: true, force: true });
    renameSync(extracted, target);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  console.log(`public/preload/ is ${lock.release} (${sum})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
