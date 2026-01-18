import { api } from "./eden-client";
type Listener = (...args: any[]) => void;

class EventEmitter {
  private events: Map<string, Listener[]> = new Map();

  on(event: string, listener: Listener) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
    return this;
  }

  off(event: string, listener: Listener) {
    const listeners = this.events.get(event);
    if (listeners) {
      this.events.set(event, listeners.filter((l) => l !== listener));
    }
    return this;
  }

  emit(event: string, ...args: any[]) {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach((l) => l(...args));
    }
    return true;
  }
}


export interface Message {
  id: string;
  from: string;
  to: string;
  type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "unknown" | "template" | "interactive";
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
  pushName?: string;
  customName?: string;
  isFavorite?: boolean;
  lastMessage?: Message;
  lastUserMsgTimestamp?: number;
}

export interface CallState {
    isOpen: boolean;
    type: 'incoming' | 'outgoing' | 'active';
    callId?: string;
    remoteSdp?: string;
    contactName: string;
    stream?: MediaStream;
}

export class ChatSDK extends EventEmitter {
    private chat: ReturnType<typeof api.chat.subscribe> | null = null;
    private contacts: Contact[] = [];
    private messages: Message[] = [];
    private activeContactId: string | null = null;
    private status: "Connected" | "Disconnected" = "Disconnected";

    constructor() {
        super();
        this.init();
    }

    private init() {
        this.chat = api.chat.subscribe();
        
        this.chat.on("open", () => {
            this.status = "Connected";
            this.emit("status", this.status);
        });

        this.chat.on("close", () => {
            this.status = "Disconnected";
            this.emit("status", this.status);
        });

        this.chat.subscribe((response: any) => {
            let parsed: any = {};
            try {
                if (response && response.data && typeof response.data === 'string') {
                    parsed = JSON.parse(response.data);
                } else if (response && response.data) {
                    parsed = response.data;
                } else {
                    parsed = response;
                }
            } catch (e) {
                console.error("WS Parse Error:", e);
                return;
            }

            const type = parsed.type;
            const data = parsed.data || parsed;

            this.handleWebSocketMessage(type, data, parsed);
        });
    }

    private handleWebSocketMessage(type: string, data: any, raw: any) {
        switch (type) {
            case "contacts":
                this.contacts = data.data || data;
                this.emit("contacts", this.contacts);
                break;
            
            case "messages_loaded":
                const { contactId, data: loadedMsgs, nextCursor } = raw;
                if (contactId === this.activeContactId) {
                    this.appendMessages(loadedMsgs);
                    this.emit("messages_loaded", { contactId, messages: this.messages, nextCursor });
                }
                break;

            case "message":
                const msg = data.data || data;
                this.updateMessageInList(msg);
                this.updateContactWithNewMessage(msg);
                break;

            case "status":
                const { id, status } = data || raw;
                this.messages = this.messages.map(m => m.id === id ? { ...m, status } : m);
                this.emit("messages", this.messages);
                break;

            case "reaction":
                const { messageId, from, emoji } = data || raw;
                this.messages = this.messages.map(m => {
                    if (m.id === messageId) {
                        return { ...m, reactions: { ...m.reactions, [from]: emoji } };
                    }
                    return m;
                });
                this.emit("messages", this.messages);
                break;

            case "id_update":
                const { oldId, newId } = data || raw;
                this.messages = this.messages.map(m => {
                    let updated = m.id === oldId ? { ...m, id: newId } : m;
                    if (updated.context?.message_id === oldId) {
                        updated = { ...updated, context: { ...updated.context, message_id: newId } };
                    }
                    return updated;
                });
                this.emit("messages", this.messages);
                break;

            case "contact_update":
                const { id: cId, customName } = data || data.data || raw.data;
                this.contacts = this.contacts.map(c => c.id === cId ? { ...c, customName } : c);
                this.emit("contacts", this.contacts);
                break;

            case "call_answered":
            case "call_incoming":
            case "call_ended":
            case "call_created":
                this.emit("call_event", { type, data: data.data || data });
                break;
            
            case "error":
                this.emit("error", data.message);
                break;
        }
    }

    private updateMessageInList(msg: Message) {
        if (this.activeContactId && (msg.from === this.activeContactId || msg.to === this.activeContactId)) {
            if (this.messages.find(m => m.id === msg.id)) return;
            this.messages = [...this.messages, msg].sort((a, b) => a.timestamp - b.timestamp);
            this.emit("messages", this.messages);
        }
    }

    private updateContactWithNewMessage(msg: Message) {
        const contactId = msg.direction === 'incoming' ? msg.from : msg.to;
        const idx = this.contacts.findIndex(c => c.id === contactId);
        
        let updatedContact: Contact;
        if(idx >= 0) {
            updatedContact = { 
                ...this.contacts[idx], 
                lastMessage: msg,
                lastUserMsgTimestamp: msg.direction === 'incoming' ? msg.timestamp : this.contacts[idx].lastUserMsgTimestamp
            };
            this.contacts.splice(idx, 1);
            this.contacts.unshift(updatedContact);
        } else {
            updatedContact = { 
                id: contactId, 
                lastMessage: msg,
                lastUserMsgTimestamp: msg.direction === 'incoming' ? msg.timestamp : 0
            };
            this.contacts.unshift(updatedContact);
        }
        this.emit("contacts", this.contacts);
    }

    private appendMessages(loadedMsgs: Message[]) {
        const merged = [...this.messages, ...loadedMsgs];
        const unique = Array.from(new Map(merged.map(m => [m.id, m])).values());
        this.messages = unique.sort((a, b) => a.timestamp - b.timestamp);
        this.emit("messages", this.messages);
    }

    // Public Methods
    public setActiveContact(contactId: string | null) {
        this.activeContactId = contactId;
        this.messages = [];
        this.emit("messages", this.messages);
        if (contactId) {
            this.chat?.send({ type: 'get_messages', contactId, limit: 50 });
        }
    }

    public loadMoreMessages(contactId: string, beforeTimestamp: number) {
        this.chat?.send({ 
            type: 'get_messages', 
            contactId, 
            limit: 50, 
            beforeTimestamp 
        });
    }

    public sendMessage(to: string, payload: any) {
        this.chat?.send({
            ...payload,
            to
        });
    }

    public sendText(to: string, text: string, replyingToId?: string) {
        this.sendMessage(to, {
            type: "text",
            content: text,
            context: replyingToId ? { message_id: replyingToId } : undefined
        });
    }

    public sendTyping(to: string, state: boolean) {
        this.chat?.send({ type: "typing", to, state });
    }

    public sendReadReceipt(messageId: string) {
        this.chat?.send({ type: "read", messageId });
    }

    public sendReaction(to: string, messageId: string, emoji: string) {
        this.chat?.send({ type: "reaction", to, messageId, emoji });
    }

    public updateContactName(contactId: string, name: string) {
        this.chat?.send({ type: 'update_contact', contactId, name });
    }

    public toggleFavorite(contactId: string) {
        this.chat?.send({ type: 'toggle_favorite', contactId });
    }

    // Signaling for calls
    public startCall(to: string, sdp: string) {
        this.chat?.send({ type: 'call_start', to, sdp });
    }

    public acceptCall(callId: string, sdp: string) {
        this.chat?.send({ type: 'call_accept', callId, sdp });
    }

    public rejectCall(callId: string) {
        this.chat?.send({ type: 'call_reject', callId });
    }

    public close() {
        this.chat?.close();
    }
}

// Hook abstraction
import { useState, useEffect, useCallback, useMemo } from 'react';

export function useChat() {
    const sdk = useMemo(() => new ChatSDK(), []);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [status, setStatus] = useState<string>("Disconnected");
    const [activeContactId, setActiveContactId] = useState<string | null>(null);
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [callEvent, setCallEvent] = useState<{type: string, data: any} | null>(null);

    useEffect(() => {
        const onContacts = (c: Contact[]) => setContacts([...c]);
        const onMessages = (m: Message[]) => setMessages([...m]);
        const onStatus = (s: string) => setStatus(s);
        const onMessagesLoaded = ({ nextCursor: cursor }: any) => {
            setNextCursor(cursor);
            setHasMore(!!cursor);
        };
        const onCallEvent = (event: {type: string, data: any}) => setCallEvent(event);

        sdk.on("contacts", onContacts);
        sdk.on("messages", onMessages);
        sdk.on("status", onStatus);
        sdk.on("messages_loaded", onMessagesLoaded);
        sdk.on("call_event", onCallEvent);

        return () => {
            sdk.off("contacts", onContacts);
            sdk.off("messages", onMessages);
            sdk.off("status", onStatus);
            sdk.off("messages_loaded", onMessagesLoaded);
            sdk.off("call_event", onCallEvent);
            sdk.close();
        };
    }, [sdk]);

    const selectContact = useCallback((id: string | null) => {
        setActiveContactId(id);
        sdk.setActiveContact(id);
        setNextCursor(null);
        setHasMore(false);
    }, [sdk]);

    const loadMore = useCallback(() => {
        if (activeContactId && nextCursor) {
            sdk.loadMoreMessages(activeContactId, nextCursor);
        }
    }, [sdk, activeContactId, nextCursor]);

    const activeContact = useMemo(() => 
        contacts.find(c => c.id === activeContactId) || (activeContactId ? { id: activeContactId } as Contact : null)
    , [contacts, activeContactId]);

    return {
        contacts,
        messages,
        status,
        activeContact,
        selectContact,
        loadMore,
        hasMore,
        sdk,
        callEvent
    };
}
