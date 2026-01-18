
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
console.log("[DB] Initializing schema...");

db.run(`
  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT,
    push_name TEXT,
    custom_name TEXT,
    is_favorite INTEGER DEFAULT 0,
    tab_id TEXT,
    last_user_msg_timestamp INTEGER,
    unread_count INTEGER DEFAULT 0
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
    context_id TEXT,
    is_starred INTEGER DEFAULT 0
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

console.log("[DB] Running migrations...");
try { db.run("ALTER TABLE calls ADD COLUMN name TEXT"); } catch (e) {}
try { db.run("ALTER TABLE messages ADD COLUMN is_starred INTEGER DEFAULT 0"); } catch (e) {}

db.run(`
  CREATE TABLE IF NOT EXISTS chat_tabs (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT, -- 'system' | 'custom'
    sort_order INTEGER
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS chat_rules (
    id TEXT PRIMARY KEY,
    tab_id TEXT,
    field TEXT,
    operator TEXT,
    value TEXT,
    FOREIGN KEY(tab_id) REFERENCES chat_tabs(id) ON DELETE CASCADE
  )
`);

// Migrations
try { db.run("ALTER TABLE chat_tabs ADD COLUMN sort_order INTEGER"); } catch (e) {}
try { db.run("ALTER TABLE contacts ADD COLUMN tab_id TEXT"); } catch (e) {}
try { db.run("ALTER TABLE contacts ADD COLUMN push_name TEXT"); } catch (e) {}
try { db.run("ALTER TABLE contacts ADD COLUMN custom_name TEXT"); } catch (e) {}
try { db.run("ALTER TABLE contacts ADD COLUMN is_favorite INTEGER DEFAULT 0"); } catch (e) {}
try { db.run("ALTER TABLE contacts ADD COLUMN last_user_msg_timestamp INTEGER"); } catch (e) {}
try { db.run("ALTER TABLE contacts ADD COLUMN unread_count INTEGER DEFAULT 0"); } catch (e) {}

db.run(`
  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    contact_id TEXT,
    content TEXT,
    timestamp INTEGER,
    FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  )
`);

try { db.run("ALTER TABLE notes ADD COLUMN contact_id TEXT"); } catch (e) {}

console.log("[DB] Schema initialization complete.");

export default db;
