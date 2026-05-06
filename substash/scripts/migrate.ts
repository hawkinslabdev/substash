import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as path from "path";
import * as fs from "fs";

const DB_PATH = process.env.DB_PATH ?? "./data/substash.db";
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./migrations" });
console.log("Migrations applied.");
sqlite.close();
