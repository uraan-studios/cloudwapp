
import { join } from "path";
import { readFile } from "fs/promises";

const DATA_DIR = join(import.meta.dir, "data");
const LOGS_FILE = join(DATA_DIR, "logs.json");
const DB_FILE = join(DATA_DIR, "db.json");

async function diagnose() {
    try {
        const logsContent = await readFile(LOGS_FILE, "utf-8");
        const lines = logsContent.trim().split("\n");
        let lastReaction = null;

        // Find last reaction
        for (let i = lines.length - 1; i >= 0; i--) {
            try {
                const log = JSON.parse(lines[i]);
                const changes = log.body?.entry?.[0]?.changes?.[0]?.value?.messages;
                if (changes) {
                    const reactionMsg = changes.find((m: any) => m.type === 'reaction');
                    if (reactionMsg) {
                        lastReaction = reactionMsg;
                        break;
                    }
                }
            } catch (e) {}
        }

        if (!lastReaction) {
            console.log("No reaction found in logs.");
            return;
        }

        const targetId = lastReaction.reaction.message_id;
        console.log(`Latest Reaction Target ID: ${targetId}`);

        const dbContent = await readFile(DB_FILE, "utf-8");
        const db = JSON.parse(dbContent);
        
        const found = db.messages.find((m: any) => m.id === targetId);
        
        if (found) {
            console.log("SUCCESS: Message found in DB with this ID.");
            console.log(`Current Reactions: ${JSON.stringify(found.reactions)}`);
        } else {
            console.log("FAILURE: Message NOT found in DB with this ID.");
            // Try to find candidate
            const candidates = db.messages.filter((m: any) => m.id.startsWith("wamid_"));
            console.log(`Found ${candidates.length} messages with temp IDs that might be the target.`);
            if (candidates.length > 0) {
                console.log("Recent temp candidates:", candidates.slice(-3).map((m:any) => `${m.id} (${m.content})`));
            }
        }

    } catch (e) {
        console.error(e);
    }
}

diagnose();
