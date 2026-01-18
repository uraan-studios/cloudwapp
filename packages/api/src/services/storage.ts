import { db } from "./db";
import type { Message, Contact } from "@repo/chatsdk";

export { type Message, type Contact };

export interface Call {
  id: string; // WhatsApp Call ID
  name?: string; // Display name
  from: string;
  to: string;
  status: 'incoming' | 'active' | 'ended' | 'rejected' | 'missed' | 'failed';
  timestamp: number;
  sdp?: string; // Stored temporarily for handshake
  direction: 'incoming' | 'outgoing';
}

export const storage = {
  async saveCall(call: Call) {
      console.log(`[Storage] Saving call: ${call.id}`);
      const insert = db.prepare(`
          INSERT OR REPLACE INTO calls (id, name, from_id, to_id, status, timestamp, sdp, direction)
          VALUES ($id, $name, $from, $to, $status, $timestamp, $sdp, $direction)
      `);
      insert.run({
        $id: call.id,
        $name: call.name || null,
        $from: call.from,
        $to: call.to,
        $status: call.status,
        $timestamp: call.timestamp,
        $sdp: call.sdp || null,
        $direction: call.direction
      });
  },

  async updateCallStatus(id: string, status: Call['status'], sdp?: string) {
      console.log(`[Storage] Updating call ${id} status to ${status}`);
      let query = "UPDATE calls SET status = $status";
      const params: any = { $status: status, $id: id };
      
      if (sdp !== undefined) {
          query += ", sdp = $sdp";
          params.$sdp = sdp;
      }
      
      query += " WHERE id = $id";
      db.prepare(query).run(params);
  },

  async getCall(id: string): Promise<Call | null> {
      const row = db.prepare("SELECT * FROM calls WHERE id = $id").get({ $id: id }) as any;
      if (!row) return null;
      return {
          id: row.id,
          name: row.name,
          from: row.from_id,
          to: row.to_id,
          status: row.status,
          timestamp: row.timestamp,
          sdp: row.sdp,
          direction: row.direction
      };
  },

  async saveMessage(message: Message) {
    const insertMessage = db.prepare(`
        INSERT OR REPLACE INTO messages (id, from_id, to_id, type, content, timestamp, status, direction, context_id)
        VALUES ($id, $from, $to, $type, $content, $timestamp, $status, $direction, $context_id)
    `);

    const insertContact = db.prepare(`
        INSERT INTO contacts (id, name, push_name, custom_name) 
        VALUES ($id, $name, $pushName, $customName)
        ON CONFLICT(id) DO UPDATE SET 
            push_name = COALESCE(excluded.push_name, push_name),
            name = COALESCE(excluded.name, name)
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
        
        // Update last_user_msg_timestamp and increment unread_count if incoming
        if (message.direction === 'incoming') {
             const updateTimestamp = db.prepare(`
                UPDATE contacts SET 
                    last_user_msg_timestamp = $timestamp,
                    unread_count = unread_count + 1
                WHERE id = $id
             `);
             updateTimestamp.run({ $timestamp: message.timestamp, $id: contactId });
        }

        // We minimally insert contact to ensure existence, preserve existing names
        insertContact.run({ 
            $id: contactId, 
            $name: contactId, 
            $pushName: null, 
            $customName: null 
        });
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
            is_starred: !!m.is_starred,
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
            is_starred: !!m.is_starred,
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
                direction: lastMsg.direction,
                is_starred: !!lastMsg.is_starred
             };
         }
         return {
             id: c.id,
             name: c.name,
             pushName: c.push_name,
             customName: c.custom_name,
             isFavorite: !!c.is_favorite,
             tabId: c.tab_id,
             lastMessage: lm,
             lastUserMsgTimestamp: c.last_user_msg_timestamp,
             unreadCount: c.unread_count || 0
         };
    });
    
    // Sort by last message time
    return result.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
  },

  async getContact(id: string): Promise<Contact | null> {
      const contact = db.prepare("SELECT * FROM contacts WHERE id = $id").get({ $id: id }) as any;
      if (!contact) return null;
      return {
          id: contact.id,
          name: contact.name,
          pushName: contact.push_name,
          customName: contact.custom_name,
          isFavorite: !!contact.is_favorite,
          lastUserMsgTimestamp: contact.last_user_msg_timestamp
      };
  },

  async saveContact(id: string, pushName: string) {
      const stmt = db.prepare(`
        INSERT INTO contacts (id, push_name) VALUES ($id, $pushName)
        ON CONFLICT(id) DO UPDATE SET push_name = $pushName
      `);
      stmt.run({ $id: id, $pushName: pushName });
  },

  async updateContactName(id: string, name: string) {
      const stmt = db.prepare(`
        UPDATE contacts SET custom_name = $name WHERE id = $id
      `);
      stmt.run({ $id: id, $name: name });
      
      // Return updated contact info partial
      return { id, customName: name };
  },

  async toggleFavorite(id: string) {
      const contact = db.prepare("SELECT is_favorite FROM contacts WHERE id = $id").get({ $id: id }) as any;
      const newValue = contact?.is_favorite ? 0 : 1;
      
      db.prepare("UPDATE contacts SET is_favorite = $val WHERE id = $id").run({ $val: newValue, $id: id });
      return { id, isFavorite: !!newValue };
  },

  async updateMessageStatus(id: string, status: Message['status']) {
    const prev = db.prepare("SELECT status, from_id, direction FROM messages WHERE id = $id").get({ $id: id }) as any;
    
    const stmt = db.prepare("UPDATE messages SET status = $status WHERE id = $id");
    stmt.run({ $status: status, $id: id });

    // If message was incoming and marked as read, decrement unread_count
    if (status === 'read' && prev && prev.direction === 'incoming' && prev.status !== 'read') {
        db.prepare("UPDATE contacts SET unread_count = MAX(0, unread_count - 1) WHERE id = $id")
          .run({ $id: prev.from_id });
    }
  },

  async addReaction(id: string, from: string, emoji: string) {
      console.log(`Adding reaction: ID=${id}, From=${from}, Emoji=${emoji}`);
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO reactions (message_id, from_id, emoji)
        VALUES ($id, $from, $emoji)
      `);
      stmt.run({ $id: id, $from: from, $emoji: emoji });
  },

  async getTabs(): Promise<any[]> {
      const tabs = db.prepare("SELECT * FROM chat_tabs ORDER BY sort_order ASC").all() as any[];
      if (tabs.length === 0) {
          // Initialize defaults
          const init = db.transaction(() => {
              db.prepare("INSERT INTO chat_tabs (id, name, type, sort_order) VALUES ('all', 'All', 'system', 0)").run();
              db.prepare("INSERT INTO chat_tabs (id, name, type, sort_order) VALUES ('favs', 'Favorites', 'system', 1)").run();
          });
          init();
          return this.getTabs();
      }
      return tabs;
  },

  async createTab(name: string): Promise<{ id: string, name: string }> {
      const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
      db.prepare("INSERT INTO chat_tabs (id, name, type, sort_order) SELECT $id, $name, 'custom', COALESCE(MAX(sort_order), 0) + 1 FROM chat_tabs")
        .run({ $id: id, $name: name });
      return { id, name };
  },

  async deleteTab(id: string): Promise<void> {
      db.prepare("DELETE FROM chat_tabs WHERE id = $id AND type = 'custom'").run({ $id: id });
  },

  async assignContactToTab(contactId: string, tabId: string | null) {
      db.prepare("UPDATE contacts SET tab_id = $tabId WHERE id = $contactId").run({ $tabId: tabId, $contactId: contactId });
  },

  async toggleMessageStar(messageId: string, isStarred: boolean) {
      db.prepare("UPDATE messages SET is_starred = $isStarred WHERE id = $id").run({ $isStarred: isStarred ? 1 : 0, $id: messageId });
  },

  async getStarredMessages(contactId: string) {
      const msgs = db.prepare(`
          SELECT * FROM messages 
          WHERE (from_id = $contactId OR to_id = $contactId) 
          AND is_starred = 1 
          ORDER BY timestamp DESC
      `).all({ $contactId: contactId }) as any[];

      return msgs.map(m => ({
          id: m.id,
          from: m.from_id,
          to: m.to_id,
          type: m.type as any,
          content: m.content,
          timestamp: m.timestamp,
          status: m.status as any,
          direction: m.direction as any,
          is_starred: true
      }));
  },

  async getNotes(contactId: string) {
      return db.prepare("SELECT * FROM notes WHERE contact_id = $contactId ORDER BY timestamp DESC").all({ $contactId: contactId }) as any[];
  },

  async addNote(contactId: string, content: string) {
      const id = Math.random().toString(36).substr(2, 9);
      db.prepare("INSERT INTO notes (id, contact_id, content, timestamp) VALUES ($id, $contactId, $content, $timestamp)")
        .run({ $id: id, $contactId: contactId, $content: content, $timestamp: Date.now() });
      return { id, contact_id: contactId, content, timestamp: Date.now() };
  },

  async deleteNote(noteId: string) {
      db.prepare("DELETE FROM notes WHERE id = $id").run({ $id: noteId });
  },

  async updateMessageId(oldId: string, newId: string) {
      console.log(`[Storage] Updating Message ID: ${oldId} -> ${newId}`);
      
      db.transaction(() => {
          const updateMsg = db.prepare("UPDATE messages SET id = $newId WHERE id = $oldId");
          const updateReactions = db.prepare("UPDATE reactions SET message_id = $newId WHERE message_id = $oldId");
          const updateContexts = db.prepare("UPDATE messages SET context_id = $newId WHERE context_id = $oldId");
          
          updateMsg.run({ $newId: newId, $oldId: oldId });
          updateReactions.run({ $newId: newId, $oldId: oldId });
          updateContexts.run({ $newId: newId, $oldId: oldId });
      })();

      console.log(`[Storage] Successfully updated ID for message: ${oldId}`);
  }
};
