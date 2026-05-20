import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { DB_PATH as DB_PATH_ENV } from "astro:env/server";
import * as path from "path";
import * as fs from "fs";

const DB_PATH = DB_PATH_ENV ?? "./data/substash.db";

// Survives Vite HMR module invalidation: prevents double-open crash
const g = globalThis as typeof globalThis & {
  __substash_db?: ReturnType<typeof drizzle<typeof schema>>;
  __substash_sqlite?: InstanceType<typeof Database>;
};

function initializeDatabase() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });

  // Run migrations on startup
  try {
    migrate(db, { migrationsFolder: "./migrations" });
    console.log(
      new Date().toTimeString().slice(0, 8),
      "[app] Database migrations completed.",
    );
  } catch (error) {
    console.error("Failed to run database migrations:", error);
    process.exit(1);
  }

  // Search index tables — managed outside Drizzle (FTS5 not supported by schema DSL).
  // All CREATE statements are idempotent.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS search_cache (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      stash_id    TEXT    NOT NULL,
      media_type  TEXT    NOT NULL CHECK(media_type IN ('scene','image')),
      feed_data   TEXT    NOT NULL,
      feed_name   TEXT    NOT NULL DEFAULT '',
      subreddit   TEXT    NOT NULL DEFAULT '',
      performers  TEXT    NOT NULL DEFAULT '',
      tags_text   TEXT    NOT NULL DEFAULT '',
      studio      TEXT    NOT NULL DEFAULT '',
      path_text   TEXT    NOT NULL DEFAULT '',
      indexed_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(stash_id, media_type)
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
      feed_name,
      subreddit,
      performers,
      tags_text,
      studio,
      path_text,
      content       = search_cache,
      content_rowid = id,
      tokenize      = "unicode61 remove_diacritics 1"
    );

    CREATE TABLE IF NOT EXISTS search_entities (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      stash_id    TEXT    NOT NULL,
      entity_type TEXT    NOT NULL CHECK(entity_type IN ('tag','performer','studio')),
      name        TEXT    NOT NULL,
      image_path  TEXT,
      count       INTEGER NOT NULL DEFAULT 0,
      indexed_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(stash_id, entity_type)
    );

    CREATE INDEX IF NOT EXISTS idx_search_entities_type_name
      ON search_entities(entity_type, name);
  `);

  g.__substash_sqlite = sqlite;
  return db;
}

if (!g.__substash_db) {
  g.__substash_db = initializeDatabase();
}

export const db = g.__substash_db;
export const rawDb = g.__substash_sqlite!;
