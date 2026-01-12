
import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";

const DATA_DIR = join(import.meta.dir, "../../data");
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = join(DATA_DIR, "db.sqlite");
export const db = new Database(DB_PATH);

// Initialize Tables
db.run(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT,
    push_name TEXT,
    custom_name TEXT,
    is_favorite INTEGER DEFAULT 0
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    from_id TEXT,
    to_id TEXT,
    type TEXT,
    content TEXT,
    timestamp INTEGER,
    status TEXT,
    direction TEXT,
    context_id TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS reactions (
    message_id TEXT,
    from_id TEXT,
    emoji TEXT,
    PRIMARY KEY (message_id, from_id)
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    name TEXT,
    from_id TEXT,
    to_id TEXT,
    status TEXT,
    timestamp INTEGER,
    sdp TEXT,
    direction TEXT
  )
`);

try { db.run("ALTER TABLE calls ADD COLUMN name TEXT"); } catch (e) {}

// db.run(`
//   CREATE TABLE IF NOT EXISTS chat_tabs (
//     id TEXT PRIMARY KEY,
//     name TEXT,
//     type TEXT, -- 'system' | 'custom'
//     sort_order INTEGER
//   )
// `);

// db.run(`
//   CREATE TABLE IF NOT EXISTS chat_rules (
//     id TEXT PRIMARY KEY,
//     tab_id TEXT,
//     field TEXT,
//     operator TEXT,
//     value TEXT,
//     FOREIGN KEY(tab_id) REFERENCES chat_tabs(id) ON DELETE CASCADE
//   )
// `);

// Migrations
try { db.run("ALTER TABLE contacts ADD COLUMN push_name TEXT"); } catch (e) {}
try { db.run("ALTER TABLE contacts ADD COLUMN custom_name TEXT"); } catch (e) {}
try { db.run("ALTER TABLE contacts ADD COLUMN is_favorite INTEGER DEFAULT 0"); } catch (e) {}
