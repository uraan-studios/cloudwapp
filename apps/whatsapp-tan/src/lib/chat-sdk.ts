import { api } from "./eden-client";
import { ChatSDK as BaseSDK, type Message, type Contact } from "@repo/chatsdk";
import { useState, useEffect, useCallback, useMemo } from 'react';

export { type Message, type Contact };

export class ChatSDK extends BaseSDK {
    private chat: ReturnType<typeof api.chat.subscribe> | null = null;

    constructor() {
        super({ debug: true });
        this.init();
    }

    private init() {
        console.log("[ChatSDK] Initializing connection...");
        this.setStatus("Connecting");
        this.chat = api.chat.subscribe();
        
        this.chat.on("open", () => {
            console.log("[ChatSDK] WebSocket Open");
            this.setStatus("Connected");
            this.emit("open", {});
        });

        this.chat.on("close", () => {
            console.log("[ChatSDK] WebSocket Closed");
            this.setStatus("Disconnected");
        });

        this.chat.on("error", (err) => {
            console.error("[ChatSDK] WebSocket Error:", err);
            this.setStatus("Disconnected");
        });

        this.chat.subscribe((response: any) => {
            console.log("[ChatSDK] Received message:", response);
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
                this.updateContacts(data.data || data);
                break;
            
            case "messages_loaded":
                const { contactId, data: loadedMsgs, nextCursor } = raw;
                this.handleMessagesLoaded(contactId, loadedMsgs, nextCursor);
                break;

            case "message":
                this.handleIncomingMessage(data.data || data);
                break;

            case "status":
                const { id, status } = data || raw;
                this.handleStatusUpdate(id, status);
                break;

            case "reaction":
                const { messageId, from, emoji } = data || raw;
                this.handleReaction(messageId, from, emoji);
                break;

            case "id_update":
                const { oldId, newId } = data || raw;
                this.handleIdUpdate(oldId, newId);
                break;

            case "contact_update":
                const { id: cId, ...updates } = data || data.data || raw.data;
                this.updateContact(cId, updates);
                break;

            case "call_answered":
            case "call_incoming":
            case "call_ended":
            case "call_created":
                this.emit("call_event", { 
                    type, 
                    data: {
                        ...(data.data || data),
                        timestamp: Date.now()
                    }
                });
                break;
            
            case "error":
                this.emit("error", data.message);
                break;
        }
    }

    // --- Actions ---

    public setActiveContact(contactId: string | null) {
        super.setActiveContact(contactId);
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
        this.sendMessage(to, ChatSDK.createTextMessage(to, text, replyingToId));
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

    public reconnect() {
        this.close();
        this.init();
    }
}

const sdkInstance = new ChatSDK();

// Hook abstraction
export function useChat() {
    const sdk = sdkInstance;
    const [contacts, setContacts] = useState<Contact[]>(sdk.getContacts());
    const [messages, setMessages] = useState<Message[]>([]);
    const [status, setStatus] = useState<string>(sdk.getStatus());
    const [activeContactId, setActiveContactId] = useState<string | null>(sdk.getActiveContactId());
    const [nextCursor, setNextCursor] = useState<number | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [callEvent, setCallEvent] = useState<any | null>(null);

    useEffect(() => {
        // Sync initial messages if there's an active contact
        if (activeContactId) {
            setMessages(sdk.getMessages(activeContactId));
        }
        
        const onContacts = (c: Contact[]) => setContacts([...c]);
        const onMessages = (m: Message[]) => setMessages([...m]);
        const onStatus = (s: string) => setStatus(s);
        const onMessagesLoaded = ({ nextCursor: cursor }: any) => {
            setNextCursor(cursor);
            setHasMore(!!cursor);
        };
        const onCallEvent = (event: any) => setCallEvent(event);

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
