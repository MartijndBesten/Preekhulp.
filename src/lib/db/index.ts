// Eén lokale SQLite-database (ingebouwde node:sqlite, met FTS5).
// Geen ORM: het schema is klein en expliciet; migraties staan in schema.ts.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { MIGRATIES } from "./schema";

export function dataDir(): string {
  const dir = process.env.PREEKHULP_DATA_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), ".data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let _db: DatabaseSync | null = null;
let _dbPath: string | null = null;

export function openDb(file?: string): DatabaseSync {
  const p = file ?? path.join(dataDir(), "preekhulp.sqlite");
  if (_db && _dbPath === p) return _db;
  const db = new DatabaseSync(p);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migreer(db);
  _db = db;
  _dbPath = p;
  return db;
}

/** Alleen voor tests: een losse database in het geheugen of in een tijdelijk bestand. */
export function nieuweDb(file = ":memory:"): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;");
  migreer(db);
  return db;
}

export function db(): DatabaseSync {
  return openDb();
}

function migreer(db: DatabaseSync) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_versie (versie INTEGER NOT NULL)");
  const rij = db.prepare("SELECT MAX(versie) AS v FROM schema_versie").get() as { v: number | null };
  let huidig = rij?.v ?? 0;
  for (const [i, sql] of MIGRATIES.entries()) {
    const versie = i + 1;
    if (versie <= huidig) continue;
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO schema_versie (versie) VALUES (?)").run(versie);
      db.exec("COMMIT");
      huidig = versie;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

export function transactie<T>(d: DatabaseSync, fn: () => T): T {
  d.exec("BEGIN");
  try {
    const r = fn();
    d.exec("COMMIT");
    return r;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export function json<T>(s: unknown, fallback: T): T {
  if (typeof s !== "string" || !s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function nu(): string {
  return new Date().toISOString();
}

export function nieuweId(prefix = ""): string {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/** Maakt een veilige FTS5-zoekvraag van vrije tekst (geen operators van de gebruiker doorlaten). */
export function ftsVraag(tekst: string, modus: "en" | "of" = "en"): string {
  const woorden = tekst
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1)
    .slice(0, 24);
  if (!woorden.length) return "";
  return woorden.map((w) => `"${w.replace(/"/g, "")}"`).join(modus === "en" ? " AND " : " OR ");
}
