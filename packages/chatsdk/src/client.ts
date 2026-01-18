import { EventEmitter, type Listener } from "./events";
import type { 
  WhatsAppEvents, 
  Message, 
  Contact, 
  MessageType,
  CallEvent
} from "./types";

export interface SDKOptions {
  debug?: boolean;
}

export class ChatSDK extends EventEmitter<WhatsAppEvents & Record<string, Listener>> {
  private contacts: Map<string, Contact> = new Map();
  private messages: Map<string, Message[]> = new Map();
  private activeContactId: string | null = null;
  private status: "Connected" | "Disconnected" | "Connecting" = "Disconnected";
  private options: SDKOptions;

  constructor(options: SDKOptions = {}) {
    super();
    this.options = options;
  }

  // --- State Management ---

  public setStatus(status: "Connected" | "Disconnected" | "Connecting") {
    this.status = status;
    this.emit("status", status);
  }

  public getStatus() {
    return this.status;
  }

  public updateContacts(contacts: Contact[]) {
    contacts.forEach(c => this.contacts.set(c.id, c));
    this.emit("contacts", Array.from(this.contacts.values()));
  }

  public updateContact(id: string, updates: Partial<Contact>) {
    const contact = this.contacts.get(id);
    if (contact) {
      const updated = { ...contact, ...updates };
      this.contacts.set(id, updated);
      this.emit("contact_update", updated);
      
      // Also update contacts list
      this.emit("contacts", Array.from(this.contacts.values()));
    }
  }

  public setActiveContact(contactId: string | null) {
    this.activeContactId = contactId;
  }

  public getContacts() {
    return Array.from(this.contacts.values());
  }

  public getMessages(contactId: string) {
    return this.messages.get(contactId) || [];
  }

  public getActiveContactId() {
    return this.activeContactId;
  }

  // --- Message Handling ---

  public handleIncomingMessage(msg: Message) {
    const contactId = msg.direction === 'incoming' ? msg.from : msg.to;
    
    // Update contact's last message
    const contact = this.contacts.get(contactId);
    if (contact) {
      this.updateContact(contactId, { 
        lastMessage: msg,
        lastUserMsgTimestamp: msg.direction === 'incoming' ? msg.timestamp : contact.lastUserMsgTimestamp
      });
    } else {
      // If contact doesn't exist, create a stub
      this.updateContacts([{
        id: contactId,
        lastMessage: msg,
        lastUserMsgTimestamp: msg.direction === 'incoming' ? msg.timestamp : 0
      }]);
    }

    // Add to message store
    const contactMsgs = this.messages.get(contactId) || [];
    if (!contactMsgs.find(m => m.id === msg.id)) {
      const updatedMsgs = [...contactMsgs, msg].sort((a, b) => a.timestamp - b.timestamp);
      this.messages.set(contactId, updatedMsgs);
      
      if (this.activeContactId === contactId) {
        this.emit("messages", updatedMsgs);
      }
    }

    this.emit("message", msg);
  }

  public handleMessagesLoaded(contactId: string, loadedMsgs: Message[], nextCursor?: number) {
    const existing = this.messages.get(contactId) || [];
    const merged = [...existing, ...loadedMsgs];
    const unique = Array.from(new Map(merged.map(m => [m.id, m])).values());
    const sorted = unique.sort((a, b) => a.timestamp - b.timestamp);
    
    this.messages.set(contactId, sorted);
    
    this.emit("messages_loaded", { contactId, messages: sorted, nextCursor });
    
    if (this.activeContactId === contactId) {
      this.emit("messages", sorted);
    }
  }

  public handleStatusUpdate(messageId: string, status: Message["status"]) {
    // Find message in all contact stores (or we could have a global map)
    for (const [contactId, msgs] of this.messages.entries()) {
      const idx = msgs.findIndex(m => m.id === messageId);
      if (idx !== -1) {
      const msgToUpdate = msgs[idx];
      if (msgToUpdate) {
        msgs[idx] = { ...msgToUpdate, status };
        if (this.activeContactId === contactId) {
          this.emit("messages", [...msgs]);
        }
        break;
      }
      }
    }
    this.emit("message_status", { id: messageId, status });
  }

  public handleReaction(messageId: string, from: string, emoji: string) {
    for (const [contactId, msgs] of this.messages.entries()) {
      const idx = msgs.findIndex(m => m.id === messageId);
      if (idx !== -1) {
      const msgToUpdate = msgs[idx];
      if (msgToUpdate) {
        const reactions = { ...(msgToUpdate.reactions || {}), [from]: emoji };
        msgs[idx] = { ...msgToUpdate, reactions };
        if (this.activeContactId === contactId) {
          this.emit("messages", [...msgs]);
        }
        break;
      }
      }
    }
    this.emit("reaction", { messageId, from, emoji });
  }

  public handleIdUpdate(oldId: string, newId: string) {
    for (const [contactId, msgs] of this.messages.entries()) {
      let changed = false;
      const updatedMsgs = msgs.map(m => {
        let updated = m;
        // Update the message ID itself
        if (m.id === oldId) {
          updated = { ...updated, id: newId };
          changed = true;
        }
        // Update any context references
        if (m.context?.message_id === oldId) {
          updated = { ...updated, context: { ...updated.context, message_id: newId } };
          changed = true;
        }
        return updated;
      });

      if (changed) {
        this.messages.set(contactId, updatedMsgs);
        if (this.activeContactId === contactId) {
          this.emit("messages", updatedMsgs);
        }
      }
    }
    this.emit("id_update", { oldId, newId });
  }


  // --- Message Builders ---

  public static createTextMessage(to: string, text: string, replyingTo?: string): Partial<Message> {
    return {
      type: "text",
      to,
      content: text,
      context: replyingTo ? { message_id: replyingTo } : undefined
    };
  }

  public static createMediaMessage(to: string, type: MessageType, id: string, caption?: string, metadata?: Message["metadata"]): Partial<Message> {
    return {
      type,
      to,
      content: id, // Assuming content stores the media ID/URL
      metadata: {
        ...metadata,
        caption
      }
    };
  }

  public static createTemplateMessage(to: string, templateName: string, language: string, components: any[]): any {
    return {
      type: "template",
      to,
      templateName,
      languageCode: language,
      components
    };
  }

  public static createButtonsMessage(to: string, bodyText: string, buttons: string[], headerText?: string, footerText?: string): any {
    return {
      type: "interactive",
      to,
      interactive: {
        type: "button",
        header: headerText ? { type: "text", text: headerText } : undefined,
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          buttons: buttons.map((title, i) => ({
            type: "reply",
            reply: { id: `btn_${i}`, title }
          }))
        }
      }
    };
  }

  public static createListMessage(to: string, bodyText: string, buttonText: string, sections: { title: string, rows: { id: string, title: string, description?: string }[] }[]): any {
    return {
      type: "interactive",
      to,
      interactive: {
        type: "list",
        body: { text: bodyText },
        action: {
          button: buttonText,
          sections
        }
      }
    };
  }


  // --- Utility ---

  private log(...args: any[]) {
    if (this.options.debug) {
      console.log("[ChatSDK]", ...args);
    }
  }
}
