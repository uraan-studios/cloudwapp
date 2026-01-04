
import { join } from "path";
import { readFile, writeFile } from "fs/promises";

const DATA_DIR = join(process.cwd(), "data");
const LOGS_FILE = join(DATA_DIR, "sent.json");
const DB_FILE = join(DATA_DIR, "db.json");

async function repair() {
    console.log("Starting DB Repair...");
    
    try {
        const logsContent = await readFile(LOGS_FILE, "utf-8");
        const dbContent = await readFile(DB_FILE, "utf-8");
        
        const logs = logsContent.trim().split("\n").map(line => {
             try { return JSON.parse(line); } catch (e) { return null; }
        }).filter(Boolean);
        
        const db = JSON.parse(dbContent);
        let updates = 0;

        for (const log of logs) {
            if (log.response && log.response.messages && log.response.messages[0]) {
                const realId = log.response.messages[0].id;
                const timestamp = new Date(log.timestamp).getTime();
                
                // Find message in DB that matches vaguely
                // The log timestamp might be slightly different from DB timestamp due to processing time
                // But content and 'to' should match.
                
                const candidates = db.messages.filter((m: any) => 
                    m.direction === 'outgoing' && 
                    m.to === log.to && 
                    m.content === log.content &&
                    m.id.startsWith("wamid_") // Only fix temp IDs
                );

                console.log(`Log entry: ${log.content} to ${log.to} at ${timestamp}. Found ${candidates.length} candidates.`);
                if (candidates.length > 0) {
                     candidates.forEach((c: any) => console.log(`Candidate: ${c.id} at ${c.timestamp} (Diff: ${Math.abs(c.timestamp - timestamp)})`));
                }

                // Find the closest one in time
                let match = null;
                let minDiff = Infinity;
                
                for (const c of candidates) {
                    const diff = Math.abs(c.timestamp - timestamp);
                    if (diff < 5000) { // Within 5 seconds
                        if (diff < minDiff) {
                            minDiff = diff;
                            match = c;
                        }
                    }
                }

                if (match) {
                    console.log(`Fixing Message: ${match.id} -> ${realId}`);
                    // Update in messages array
                    match.id = realId;
                    match.status = 'sent'; // Ensure status is at least sent
                    
                    // Update in contacts if it's the last message
                    const contact = db.contacts.find((c: any) => c.id === log.to);
                    if (contact && contact.lastMessage && contact.lastMessage.timestamp === match.timestamp) {
                         contact.lastMessage.id = realId;
                    }
                    updates++;
                }
            }
        }

        if (updates > 0) {
            await writeFile(DB_FILE, JSON.stringify(db, null, 2));
            console.log(`Repaired ${updates} messages in db.json`);
        } else {
            console.log("No messages needed repair.");
        }

    } catch (error) {
        console.error("Repair failed:", error);
    }
}

repair();
