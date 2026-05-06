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
    console.log("Database migrations completed successfully.");
  } catch (error) {
    console.error("Failed to run database migrations:", error);
    process.exit(1);
  }

  return db;
}

if (!g.__substash_db) {
  g.__substash_db = initializeDatabase();
}

export const db = g.__substash_db;
