
import { join } from "path";
import { readFile } from "fs/promises";
import { db } from "../src/services/db";

const DATA_DIR = join(import.meta.dir, "../data");
const DB_FILE = join(DATA_DIR, "db.json");

async function migrate() {
    console.log("Starting Migration...");
    try {
        const data = await readFile(DB_FILE, "utf-8");
        const json = JSON.parse(data);
        
        const insertMessage = db.prepare(`
            INSERT OR IGNORE INTO messages (id, from_id, to_id, type, content, timestamp, status, direction, context_id, is_starred)
            VALUES ($id, $from, $to, $type, $content, $timestamp, $status, $direction, $context_id, $is_starred)
        `);

        const insertReaction = db.prepare(`
            INSERT OR IGNORE INTO reactions (message_id, from_id, emoji)
            VALUES ($message_id, $from, $emoji)
        `);

        const insertContact = db.prepare(`
            INSERT OR IGNORE INTO contacts (id, name, is_favorite, tab_id)
            VALUES ($id, $name, $is_favorite, $tab_id)
        `);

        db.transaction(() => {
            // Contacts
            for (const contact of json.contacts || []) {
                insertContact.run({ 
                    $id: contact.id, 
                    $name: contact.name || contact.id,
                    $is_favorite: contact.isFavorite ? 1 : 0,
                    $tab_id: contact.tabId || null
                });
            }

            // Messages
            for (const msg of json.messages || []) {
                insertMessage.run({
                    $id: msg.id,
                    $from: msg.from,
                    $to: msg.to,
                    $type: msg.type,
                    $content: msg.content,
                    $timestamp: msg.timestamp,
                    $status: msg.status,
                    $direction: msg.direction,
                    $context_id: msg.context?.message_id || null,
                    $is_starred: msg.isStarred ? 1 : 0
                });

                // Reactions
                if (msg.reactions) {
                    for (const [from, emoji] of Object.entries(msg.reactions)) {
                        insertReaction.run({
                            $message_id: msg.id,
                            $from: from,
                            $emoji: emoji as string
                        });
                    }
                }
            }
        })();

        console.log(`Migrated ${json.contacts.length} contacts and ${json.messages.length} messages.`);
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

migrate();
