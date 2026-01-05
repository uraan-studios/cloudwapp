import { db } from "./db";

// Types matching DB
export interface Message {
  id: string;
  from: string;
  to: string;
  type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "unknown";
  content: string;
  timestamp: number;
  status: "sent" | "delivered" | "read" | "failed";
  direction: "incoming" | "outgoing";
  reactions?: Record<string, string>;
  context?: { message_id: string };
}

export interface Contact {
  id: string;
  name?: string;
  lastMessage?: Message;
}

export const storage = {
  async saveMessage(message: Message) {
    const insertMessage = db.prepare(`
        INSERT OR REPLACE INTO messages (id, from_id, to_id, type, content, timestamp, status, direction, context_id)
        VALUES ($id, $from, $to, $type, $content, $timestamp, $status, $direction, $context_id)
    `);

    const insertContact = db.prepare(`
        INSERT OR IGNORE INTO contacts (id, name) VALUES ($id, $name)
    `);

    // We can update name if needed, but for now just ensure contact exists
    // const updateContactName = db.prepare(`UPDATE contacts SET name = $name WHERE id = $id AND (name IS NULL OR name = id)`);

    db.transaction(() => {
        insertMessage.run({
            $id: message.id,
            $from: message.from,
            $to: message.to,
            $type: message.type,
            $content: message.content,
            $timestamp: message.timestamp,
            $status: message.status,
            $direction: message.direction,
            $context_id: message.context?.message_id || null
        });

        const contactId = message.direction === 'incoming' ? message.from : message.to;
        insertContact.run({ $id: contactId, $name: contactId });
    })();
    
    console.log(`[Storage] Saved message: ${message.id} (${message.direction})`);
  },

  async getMessages(contactId: string, limit: number = 50, beforeTimestamp?: number) {
    let queryFn = `SELECT * FROM messages WHERE (from_id = $contactId OR to_id = $contactId)`;
    const params: any = { $contactId: contactId, $limit: limit };

    if (beforeTimestamp) {
        queryFn += ` AND timestamp < $beforeTimestamp`;
        params.$beforeTimestamp = beforeTimestamp;
    }

    // Get latest first, then reverse
    queryFn += ` ORDER BY timestamp DESC LIMIT $limit`;
    
    const query = db.prepare(queryFn);
    const reactionQuery = db.prepare(`SELECT from_id, emoji FROM reactions WHERE message_id = $msgId`);

    const msgs = query.all(params) as any[];
    
    // Reverse to chronological order
    msgs.reverse();
    
    return msgs.map(m => {
        const reactions = reactionQuery.all({ $msgId: m.id }) as any[];
        const reactionMap: Record<string, string> = {};
        reactions.forEach(r => reactionMap[r.from_id] = r.emoji);

        return {
            id: m.id,
            from: m.from_id,
            to: m.to_id,
            type: m.type as any,
            content: m.content,
            timestamp: m.timestamp,
            status: m.status as any,
            direction: m.direction as any,
            context: m.context_id ? { message_id: m.context_id } : undefined,
            reactions: Object.keys(reactionMap).length > 0 ? reactionMap : undefined
        };
    });
  },

  async getAllMessages() {
    console.log("[Storage] Getting all messages...");
    const query = db.prepare(`SELECT * FROM messages ORDER BY timestamp ASC`);
    const reactionQuery = db.prepare(`SELECT from_id, emoji FROM reactions WHERE message_id = $msgId`);
    
    const msgs = query.all() as any[];
    console.log(`[Storage] Found ${msgs.length} messages.`);
    
    return msgs.map(m => {
        const reactions = reactionQuery.all({ $msgId: m.id }) as any[];
        const reactionMap: Record<string, string> = {};
        reactions.forEach(r => reactionMap[r.from_id] = r.emoji);

        return {
            id: m.id,
            from: m.from_id,
            to: m.to_id,
            type: m.type as any,
            content: m.content,
            timestamp: m.timestamp,
            status: m.status as any,
            direction: m.direction as any,
            context: m.context_id ? { message_id: m.context_id } : undefined,
            reactions: Object.keys(reactionMap).length > 0 ? reactionMap : undefined
        };
    });
  },

  async getContacts() {
    console.log("[Storage] Getting contacts...");
    const contactsQuery = db.prepare("SELECT * FROM contacts");
    const contacts = contactsQuery.all() as any[];
    console.log(`[Storage] Found ${contacts.length} contacts.`);
    
    const lastMsgQuery = db.prepare(`
        SELECT * FROM messages 
        WHERE from_id = $id OR to_id = $id 
        ORDER BY timestamp DESC LIMIT 1
    `);

    const result: Contact[] = contacts.map(c => {
         const lastMsg = lastMsgQuery.get({ $id: c.id }) as any;
         let lm: Message | undefined;
         if (lastMsg) {
             lm = {
                id: lastMsg.id,
                from: lastMsg.from_id,
                to: lastMsg.to_id,
                type: lastMsg.type,
                content: lastMsg.content,
                timestamp: lastMsg.timestamp,
                status: lastMsg.status,
                direction: lastMsg.direction
             };
         }
         return {
             id: c.id,
             name: c.name,
             lastMessage: lm
         };
    });
    
    // Filter out contacts with no messages if desired, or keep them.
    // Sort by last message time
    return result.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
  },

  async updateMessageStatus(id: string, status: Message['status']) {
    const stmt = db.prepare("UPDATE messages SET status = $status WHERE id = $id");
    stmt.run({ $status: status, $id: id });
  },

  async addReaction(id: string, from: string, emoji: string) {
      console.log(`Adding reaction: ID=${id}, From=${from}, Emoji=${emoji}`);
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO reactions (message_id, from_id, emoji)
        VALUES ($id, $from, $emoji)
      `);
      stmt.run({ $id: id, $from: from, $emoji: emoji });
  },

  async updateMessageId(oldId: string, newId: string) {
      console.log(`[Storage] Updating Message ID: ${oldId} -> ${newId}`);
      
      db.transaction(() => {
          const updateMsg = db.prepare("UPDATE messages SET id = $newId WHERE id = $oldId");
          const updateReactions = db.prepare("UPDATE reactions SET message_id = $newId WHERE message_id = $oldId");
          
          updateMsg.run({ $newId: newId, $oldId: oldId });
          updateReactions.run({ $newId: newId, $oldId: oldId });
      })();

      console.log(`[Storage] Successfully updated ID for message: ${oldId}`);
  }
};
