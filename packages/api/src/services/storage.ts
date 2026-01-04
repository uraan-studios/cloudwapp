import { join } from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

const DATA_DIR = join(import.meta.dir, "../../data");
const DB_FILE = join(DATA_DIR, "db.json");

export interface Message {
  id: string;
  from: string;
  to: string; // The user's phone number or 'me'
  type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "unknown";
  content: string; // Text body or Media URL or ID
  timestamp: number;
  status: "sent" | "delivered" | "read" | "failed";
  direction: "incoming" | "outgoing";
  reactions?: Record<string, string>; // user -> emoji
  context?: { message_id: string }; // reply to message id
}

export interface Contact {
  id: string; // Phone number
  name?: string;
  lastMessage?: Message;
}

interface Database {
  messages: Message[];
  contacts: Contact[];
}

// Initialize DB
async function initDB() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
  if (!existsSync(DB_FILE)) {
    await writeFile(DB_FILE, JSON.stringify({ messages: [], contacts: [] }, null, 2));
  }
}

async function readDB(): Promise<Database> {
  await initDB();
  const data = await readFile(DB_FILE, "utf-8");
  return JSON.parse(data);
}

async function writeDB(data: Database) {
  await writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

export const storage = {
  async saveMessage(message: Message) {
    const db = await readDB();
    // De-duplicate loosely by ID if provided, otherwise append
    const existingIndex = db.messages.findIndex(m => m.id === message.id);
    if (existingIndex >= 0) {
      db.messages[existingIndex] = { ...db.messages[existingIndex], ...message };
    } else {
      db.messages.push(message);
    }
    
    // Update contact last message
    const contactId = message.direction === 'incoming' ? message.from : message.to;
    const contactIndex = db.contacts.findIndex(c => c.id === contactId);
    
    const contactUpdate: Contact = {
        id: contactId,
        lastMessage: message,
        name: db.contacts[contactIndex]?.name || contactId 
    };

    if (contactIndex >= 0) {
        db.contacts[contactIndex] = contactUpdate
    } else {
        db.contacts.push(contactUpdate)
    }

    await writeDB(db);
    console.log(`[Storage] Saved message: ${message.id} (${message.direction})`);
  },

  async getMessages(contactId: string) {
    const db = await readDB();
    return db.messages
        .filter(m => m.from === contactId || m.to === contactId)
        .sort((a, b) => a.timestamp - b.timestamp);
  },

  async getAllMessages() {
    const db = await readDB();
    return db.messages.sort((a, b) => a.timestamp - b.timestamp);
  },

  async getContacts() {
    const db = await readDB();
    // Sort by last message timestamp desc
    return db.contacts.sort((a, b) => {
        const timeA = a.lastMessage?.timestamp || 0;
        const timeB = b.lastMessage?.timestamp || 0;
        return timeB - timeA;
    });
  },

  async updateMessageStatus(id: string, status: Message['status']) {
    const db = await readDB();
    const msg = db.messages.find(m => m.id === id);
    if (msg) {
        msg.status = status;
        await writeDB(db);
    }
  },

  async addReaction(id: string, from: string, emoji: string) {
      console.log(`Adding reaction: ID=${id}, From=${from}, Emoji=${emoji}`);
      const db = await readDB();
      const msg = db.messages.find(m => m.id === id);
      if(msg) {
          console.log("Message found for reaction!");
          if(!msg.reactions) msg.reactions = {};
          msg.reactions[from] = emoji;
          await writeDB(db);
      } else {
          console.log("Message NOT found for reaction. Known IDs:", db.messages.map(m => m.id));
      }
  },

  async updateMessageId(oldId: string, newId: string) {
      console.log(`[Storage] Updating Message ID: ${oldId} -> ${newId}`);
      const db = await readDB();
      const msgIndex = db.messages.findIndex(m => m.id === oldId);
      if (msgIndex >= 0) {
          db.messages[msgIndex].id = newId;
          // Also update contact if it's the last message
          const msg = db.messages[msgIndex];
          const contactId = msg.direction === 'incoming' ? msg.from : msg.to;
          const contact = db.contacts.find(c => c.id === contactId);
          if (contact && contact.lastMessage?.id === oldId) {
              contact.lastMessage.id = newId;
          }
          await writeDB(db);
          console.log(`[Storage] Successfully updated ID for message: ${oldId}`);
      } else {
          console.warn(`[Storage] Failed to find message to update ID: ${oldId}`);
      }
  }
};
