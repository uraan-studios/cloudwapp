export type MessageType = 
  | "text" 
  | "image" 
  | "audio" 
  | "video" 
  | "document" 
  | "sticker" 
  | "unknown" 
  | "template" 
  | "interactive";

export interface Message {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  content: string;
  timestamp: number;
  status: "sent" | "delivered" | "read" | "failed";
  direction: "incoming" | "outgoing";
  reactions?: Record<string, string>;
  context?: { message_id: string };
  // Add some metadata for specific types
  metadata?: {
    thumbnail?: string;
    caption?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    isVoiceNote?: boolean;
    duration?: number;
  };
}

export interface Contact {
  id: string;
  name?: string;
  pushName?: string;
  customName?: string;
  isFavorite?: boolean;
  lastMessage?: Message;
  lastUserMsgTimestamp?: number;
  profilePic?: string;
}

export interface CallEvent {
  type: "call_created" | "call_incoming" | "call_answered" | "call_rejected" | "call_ended";
  data: {
    id: string;
    from?: string;
    fromName?: string;
    to?: string;
    sdp?: string;
    timestamp: number;
  };
}

export interface WhatsAppEvents {
  "status": (status: "Connected" | "Disconnected" | "Connecting") => void;
  "contacts": (contacts: Contact[]) => void;
  "contact_update": (contact: Contact) => void;
  "message": (message: Message) => void;
  "messages": (messages: Message[]) => void;
  "messages_loaded": (data: { contactId: string, messages: Message[], nextCursor?: number }) => void;
  "message_status": (data: { id: string, status: Message["status"] }) => void;
  "reaction": (data: { messageId: string, from: string, emoji: string }) => void;
  "id_update": (data: { oldId: string, newId: string }) => void;
  "call_event": (event: CallEvent) => void;
  "error": (error: string) => void;
  "typing": (data: { contactId: string, isTyping: boolean }) => void;
}
