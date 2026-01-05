"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "../lib/eden-client";
import { ChatLayout } from "../components/chat-layout";
import { MessageBubble } from "../components/message-bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchBar } from "../components/sidebar/search-bar";
import { TabsList } from "../components/sidebar/tabs-list";
// Context Menu
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Paperclip, Image as ImageIcon, FileText, Mic } from "lucide-react";

// Types matching backend storage
interface Message {
  id: string;
  from: string;
  to: string;
  type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "unknown";
  content: string;
  timestamp: number;
  status: "sent" | "delivered" | "read" | "failed";
  direction: "incoming" | "outgoing";
  reactions?: Record<string, string>;
}

interface Contact {
  id: string;
  name?: string;
  pushName?: string;
  customName?: string;
  isFavorite?: boolean;
  lastMessage?: Message;
}

export default function Home() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const activeContactRef = useRef<Contact | null>(null);

  // Sync ref with state
  useEffect(() => {
    activeContactRef.current = activeContact;
  }, [activeContact]);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Disconnected");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  // Pagination State
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  
  // Rename Dialog State
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Search & Tabs State
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");



  const chatRef = useRef<ReturnType<typeof api.chat.subscribe>>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const typingTimeoutRef = useRef<NodeJS.Timeout>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);

  const [attachmentDrafts, setAttachmentDrafts] = useState<{ file: File, preview: string, type: 'image' | 'video' | 'audio' | 'document', caption: string }[]>([]);
  const [currentDraftIndex, setCurrentDraftIndex] = useState(0);

  // Attachment Handlers
  const handleAttachmentClick = (type: 'image' | 'document') => {
      if (fileInputRef.current) {
          const images = "image/jpeg,image/png,image/webp";
          const videos = "video/mp4,video/3gpp";
          fileInputRef.current.accept = type === 'image' ? `${images},${videos}` : "*/*";
          fileInputRef.current.multiple = true;
          fileInputRef.current.click();
      }
      setIsAttachmentOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      const newDrafts = files.map(file => {
          let type: 'image' | 'video' | 'audio' | 'document' = "document";
          if (file.type.startsWith("image/")) type = "image";
          else if (file.type.startsWith("video/")) type = "video";
          else if (file.type.startsWith("audio/")) type = "audio";

          return {
              file,
              preview: URL.createObjectURL(file),
              type,
              caption: ""
          };
      });

      setAttachmentDrafts(prev => [...prev, ...newDrafts]);
      // If we were empty, start at 0. If adding more, user stays on current or goes to new? 
      // WhatsApp behavior: usually jumps to new. Let's keep it simple: stay if already open.
      
      e.target.value = "";
  };

  const removeDraft = (index: number) => {
      setAttachmentDrafts(prev => {
          const next = [...prev];
          next.splice(index, 1);
          return next;
      });
      if (currentDraftIndex >= index && currentDraftIndex > 0) {
          setCurrentDraftIndex(currentDraftIndex - 1);
      }
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunksRef.current.push(event.data);
            }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingDuration(0);
    } catch (e) {
        console.error("Error starting recording:", e);
        alert("Could not access microphone.");
    }
  };

  const stopAndSendRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.onstop = async () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // Default browser format
              const audioFile = new File([audioBlob], "voice_note.webm", { type: 'audio/webm' });
              
              // Upload Logic
              const formData = new FormData();
              formData.append("file", audioFile);

              try {
                  const res = await fetch("http://localhost:3000/upload", { method: "POST", body: formData });
                  if (res.ok) {
                      const data = await res.json();
                      chatRef.current?.send({
                          type: "audio",
                          to: activeContact!.id,
                          id: data.id,
                          caption: "",
                          fileName: "voice_note.webm",
                          isVoiceNote: true
                      });
                  }
              } catch (e) { console.error(e); }
              
              // Cleanup tracks
              mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
          };
          mediaRecorderRef.current.stop();
          setIsRecording(false);
      }
  };

  const cancelRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
      }
  };

  // Recording Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
        interval = setInterval(() => {
            setRecordingDuration(prev => prev + 1);
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);
  
  const updateCaption = (text: string) => {
      setAttachmentDrafts(prev => prev.map((d, i) => i === currentDraftIndex ? { ...d, caption: text } : d));
  };

  // Auto-scroll
  // Auto-scroll to bottom only if we're not loading old messages
  useEffect(() => {
    if (!isLoadingMore) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeContact, isLoadingMore]);

  // Initial Load when Contact Changes
  useEffect(() => {
    if (activeContact && chatRef.current) {
        setMessages([]); // Clear previous messages
        setHasMore(true); // Reset hasMore assuming there's content
        setNextCursor(null);
        chatRef.current.send({ type: 'get_messages', contactId: activeContact.id, limit: 50 });
    }
  }, [activeContact?.id]);
  


  // Infinite Scroll Handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop } = e.currentTarget;
      if (scrollTop === 0 && hasMore && !isLoadingMore && activeContact && nextCursor) {
          setIsLoadingMore(true);
          console.log("Loading more messages before:", nextCursor);
          chatRef.current?.send({ 
              type: 'get_messages', 
              contactId: activeContact.id, 
              limit: 50, 
              beforeTimestamp: nextCursor 
          });
      }
  };

  useEffect(() => {
    const chat = api.chat.subscribe();
    chatRef.current = chat;

    chat.subscribe((response: any) => {
      const data = response.data;
      const type = response.type || (data && data.type); 

      console.log("WS Received:", response);

      if (type === "contacts") {
        setContacts(data.data || data); 
      } else if (type === "messages_loaded") {
          const { contactId, data: loadedMsgs, nextCursor: newCursor } = data || response;
          // Only update if it's for current contact
          const currentContact = activeContactRef.current;
          if (currentContact && contactId === currentContact.id) {
              setMessages(prev => {
                  // If we have previous messages and this load is "older" (based on no overlap or just logic),
                  // verify if it's a prepend or replace.
                  // Simplest logic: If we sort by timestamp, merging is safe.
                  // But to keep scroll position, we assume loadedMsgs are OLDER than prev.
                  const merged = [...prev, ...loadedMsgs]; 
                  // Deduplicate just in case
                  const unique = Array.from(new Map(merged.map(m => [m.id, m])).values());
                  return unique.sort((a,b) => a.timestamp - b.timestamp);
              });
              setNextCursor(newCursor);
              setHasMore(!!newCursor);
              setIsLoadingMore(false);
          }
      } else if (type === "message") {
        const msg = data.data || data; 
        // Only append if it belongs to active chat
        const currentContact = activeContactRef.current;
        if (currentContact && (msg.from === currentContact.id || msg.to === currentContact.id)) {
             setMessages((prev) => {
                if(prev.find(m => m.id === msg.id)) return prev;
                return [...prev, msg].sort((a,b) => a.timestamp - b.timestamp);
            });
        }
        
        setContacts(prev => {
            const list = [...prev];
            const contactId = msg.direction === 'incoming' ? msg.from : msg.to;
            const idx = list.findIndex(c => c.id === contactId);
            if(idx >= 0) {
                list[idx] = { ...list[idx], lastMessage: msg };
                const item = list.splice(idx, 1)[0];
                list.unshift(item);
            } else {
                list.unshift({ id: contactId, lastMessage: msg });
            }
            return list;
        });

      } else if (type === "reaction") {
          const { messageId, from, emoji } = data || response;
          setMessages(prev => prev.map(m => {
              if (m.id === messageId) {
                  return { ...m, reactions: { ...m.reactions, [from]: emoji } };
              }
              return m;
          }));
      } else if (type === "status") {
          const { id, status } = data || response;
          setMessages(prev => prev.map(m => m.id === id ? { ...m, status } : m));
      } else if (type === "id_update") {
          const { oldId, newId } = data || response;
          setMessages(prev => prev.map(m => m.id === oldId ? { ...m, id: newId } : m));
      } else if (type === "contact_update") {
          const { id, customName } = data || data.data || response.data;
          setContacts(prev => prev.map(c => c.id === id ? { ...c, customName } : c));
          if (activeContactRef.current?.id === id) {
              setActiveContact(prev => prev ? { ...prev, customName } : prev);
          }

      } 
    });


    chat.on("open", () => {
      setStatus("Connected");
    });

    chat.on("close", () => {
      setStatus("Disconnected");
    });

    return () => {
      chat.close();
      chatRef.current = null;
    };
  }, []);
  
  // Filter messages for active chat
  const activeMessages = messages.filter(
      m => (activeContact && (m.from === activeContact.id || m.to === activeContact.id))
  );
  
  // Filter Contacts based on Search and Tabs
  const getDisplayName = (c: Contact) => c.customName || c.pushName || c.name || c.id;

  const filteredContacts = contacts.filter(c => {
      // 1. Search Filter
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const name = getDisplayName(c).toLowerCase();
          const num = c.id.toLowerCase();
          if (!name.includes(q) && !num.includes(q)) return false;
      }

      // 2. Tab Filter
      if (activeTab === 'all') return true;
      if (activeTab === 'favs') return c.isFavorite;
      
      return true;
  });

  // Read Receipts Logic
  useEffect(() => {
      if (!activeContact || !chatRef.current) return;
      
      const unread = activeMessages.filter(m => m.direction === 'incoming' && m.status !== 'read');
      if (unread.length > 0) {
          unread.forEach(m => {
              chatRef.current?.send({ type: "read", messageId: m.id });
          });
          // Optimistic local update
          setMessages(prev => prev.map(m => 
            (m.direction === 'incoming' && m.from === activeContact.id && m.status !== 'read') 
            ? { ...m, status: 'read' } 
            : m
          ));
      }
  }, [activeMessages.length, activeContact?.id]);

  // Typing Indicator Logic
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputText(e.target.value);
      
      if (!activeContact) return;

      if (!isTyping) {
          setIsTyping(true);
          chatRef.current?.send({ type: "typing", to: activeContact.id, state: true });
      }

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
          setIsTyping(false);
          chatRef.current?.send({ type: "typing", to: activeContact.id, state: false });
      }, 2000);
  };

  const sendMessage = async () => {
    if (attachmentDrafts.length > 0) {
        for (const draft of attachmentDrafts) {
             if (!activeContact) continue;
             
             const formData = new FormData();
             formData.append("file", draft.file);

             try {
                const res = await fetch("http://localhost:3000/upload", { method: "POST", body: formData });
                if (res.ok) {
                    const data = await res.json();
                    chatRef.current?.send({
                        type: draft.type,
                        to: activeContact.id,
                        id: data.id,
                        caption: draft.caption || "", 
                        fileName: draft.file.name
                    });
                }
             } catch(e) { console.error(e); }
        }
        setAttachmentDrafts([]);
        return;
    }

    if (!inputText.trim() || !activeContact) return;

    // Text Message Send Logic
    chatRef.current?.send({
      type: "text",
      to: activeContact.id,
      content: inputText,
      context: replyingTo ? { message_id: replyingTo.id } : undefined
    });
    
    setInputText("");
    setReplyingTo(null);
  };

  // Enter key in Caption Input
  const handleCaptionKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') sendMessage();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') sendMessage();
  };

  const handleReply = (msg: Message) => {
      setReplyingTo(msg);
      // focus input? basic ref usage
  };

  const handleReact = (id: string, emoji: string) => {
      if(!activeContact) return;
      // Optimistic
      setMessages(prev => prev.map(m => m.id === id ? { ...m, reactions: { ...m.reactions, "me": emoji } } : m));
      // Send via WS - Backend needs to handle 'reaction' type from client or we send via REST.
      // Current backend index.ts doesn't explicitly handler 'reaction' type FROM client in WebSocket `message` handler, 
      // it handles 'text', 'typing', 'read'. 
      // Implementation Plan check: "Reaction: Click reaction in UI -> Phone should show emoji". 
      // I probably missed adding 'reaction' handler in backend index.ts. 
      // I'll add a 'reaction' type support to WS send in next step if needed, or assume meta service handles it via REST.
      // Ideally reusing valid protocol. Let's send a custom type and hope I added it or will add it.
      // Wait, backend index.ts ONLY handles: text, typing, read.
      // I need to add 'reaction' handler to backend index.ts!
      chatRef.current?.send({ type: "reaction", to: activeContact.id, messageId: id, emoji });
  };

  const handleRenameClick = () => {
    if (!activeContact) return;
    const currentName = activeContact.customName || activeContact.pushName || activeContact.name || activeContact.id;
    setRenameValue(currentName);
    setIsRenameOpen(true);
  };

  const submitRename = () => {
    if (!activeContact) return;
    if (renameValue && renameValue !== (activeContact.customName || activeContact.pushName || activeContact.name || activeContact.id)) {
        // Optimistic update
        const updated = { ...activeContact, customName: renameValue };
        setActiveContact(updated);
        setContacts(prev => prev.map(c => c.id === activeContact.id ? updated : c));
        
        chatRef.current?.send({ type: 'update_contact', contactId: activeContact.id, name: renameValue });
    }
    setIsRenameOpen(false);
  };


  
  const toggleFavorite = (c: Contact) => {
      // Optimistic
      setContacts(prev => prev.map(con => con.id === c.id ? { ...con, isFavorite: !con.isFavorite } : con));
      chatRef.current?.send({ type: 'toggle_favorite', contactId: c.id });
  };

  const renderSidebar = (
      <div className="flex flex-col h-full">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <TabsList 
              activeTab={activeTab} 
              onTabChange={setActiveTab} 
          />
          <div className="overflow-y-auto flex-1 custom-scrollbar">
              {filteredContacts.length === 0 && <div className="p-4 text-gray-400 text-sm">No chats found</div>}
              {filteredContacts.map(c => (
                  <ContextMenu key={c.id}>
                    <ContextMenuTrigger>
                      <div 
                        onClick={() => setActiveContact(c)}
                        className={`flex items-center p-3 cursor-pointer hover:bg-[#202c33] ${activeContact?.id === c.id ? 'bg-[#2a3942]' : ''}`}
                      >
                          <div className="w-10 h-10 rounded-full bg-gray-500 mr-3 flex items-center justify-center text-white text-xs relative">
                              {c.id.slice(-2)}
                              {c.isFavorite && <span className="absolute -top-1 -right-1 text-xs">⭐</span>}
                          </div>
                          <div className="flex-1 border-b border-[#202c33] pb-3">
                              <div className="flex justify-between items-baseline">
                                  <span className="text-[#e9edef] text-base">{getDisplayName(c)}</span>
                                  <span className="text-[#8696a0] text-xs">
                                      {c.lastMessage && new Date(c.lastMessage.timestamp).toLocaleDateString()}
                                  </span>
                              </div>
                              <div className="text-[#8696a0] text-sm truncate">
                                  {c.lastMessage?.type === 'text' ? c.lastMessage.content : <i>{c.lastMessage?.type}</i>}
                              </div>
                          </div>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-[#202c33] border-gray-700 text-white">
                        <ContextMenuItem onClick={() => toggleFavorite(c)} className="hover:bg-[#2a3942]">
                            {c.isFavorite ? "Unfavorite" : "Favorite"}
                        </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
              ))}
          </div>
      </div>
  );

  const renderChat = activeContact ? (
      <>
        {/* Chat Header */}
        <div className="h-14 bg-[#202c33] flex items-center px-4 shrink-0 shadow-sm z-10">
             <div className="w-10 h-10 rounded-full bg-gray-500 mr-3 flex items-center justify-center text-white">
                 {activeContact.id.slice(-2)}
             </div> 
             <div className="flex flex-col">
                 <div className="flex items-center gap-2">
                     <span className="text-[#e9edef] font-medium">{getDisplayName(activeContact)}</span>
                     <button onClick={handleRenameClick} className="text-gray-500 hover:text-white text-xs opacity-50 hover:opacity-100" title="Rename Contact">
                        ✎
                     </button>
                 </div>
                 <span className="text-[#8696a0] text-xs">{status}</span>
             </div>
        </div>
        
        {/* Messages */}
        <div 
            className="flex-1 overflow-y-auto custom-scrollbar p-4 xl:px-20 bg-[#0b141a]"
            onScroll={handleScroll}
        >
            {isLoadingMore && <div className="text-center text-xs text-gray-500 py-2">Loading more...</div>}
            {activeMessages.length === 0 && (
                <div className="text-center text-[#8696a0] mt-10 text-sm">
                    This is the start of your conversation with {activeContact.id}
                </div>
            )}
            {activeMessages.map(msg => (
                <MessageBubble 
                    key={msg.id} 
                    message={msg as any} 
                    onReply={handleReply}
                    onReact={handleReact}
                />
            ))}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-[#202c33] min-h-[62px] flex flex-col px-4 py-2 gap-2 relative">
            {replyingTo && (
                <div className="bg-[#1d272d] p-2 rounded-t flex justify-between items-center border-l-4 border-teal-500">
                    <div className="flex flex-col text-sm">
                        <span className="text-teal-500 font-bold text-xs">{replyingTo.from === 'me' ? 'You' : activeContact.id}</span>
                        <span className="text-[#8696a0] truncate max-w-xs">{replyingTo.content}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white">✕</button>
                </div>
            )}
            
            {/* Media Editor Overlay */}
            {attachmentDrafts.length > 0 && attachmentDrafts[currentDraftIndex] && (
                <div className="fixed top-0 bottom-0 right-0 left-[400px] z-50 bg-[#0b141a] flex flex-col animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-4 bg-[#202c33] shrink-0">
                        <button onClick={() => setAttachmentDrafts([])} className="text-[#e9edef] hover:bg-[#374248] p-2 rounded-full">✕</button>
                        <span className="text-[#e9edef] font-medium truncate">{attachmentDrafts[currentDraftIndex].file.name}</span>
                        <div className="w-8"></div> {/* Spacer */}
                    </div>
    
                    {/* Main Preview */}
                    <div className="flex-1 min-h-0 flex items-center justify-center p-8 bg-[#0b141a] relative overflow-hidden">
                        {attachmentDrafts[currentDraftIndex].type === 'image' ? (
                            <img src={attachmentDrafts[currentDraftIndex].preview} className="max-w-full max-h-full object-contain shadow-lg" />
                        ) : attachmentDrafts[currentDraftIndex].type === 'video' ? (
                            <video src={attachmentDrafts[currentDraftIndex].preview} controls className="max-w-full max-h-full object-contain shadow-lg" />
                        ) : (
                             <div className="flex flex-col items-center gap-4 text-gray-400">
                                 <FileText className="w-24 h-24" />
                                 <span>No preview available</span>
                                 <span className="text-sm">{attachmentDrafts[currentDraftIndex].file.size} bytes</span>
                             </div>
                        )}
                    </div>
    
                    {/* Caption Bar */}
                    <div className="bg-[#202c33] p-2 flex justify-center shrink-0">
                        <input 
                            value={attachmentDrafts[currentDraftIndex].caption}
                            onChange={(e) => updateCaption(e.target.value)}
                            onKeyDown={handleCaptionKeyPress}
                            placeholder="Type a caption"
                            className="bg-[#2a3942] text-[#e9edef] rounded-lg px-4 py-2 w-full max-w-2xl text-center focus:outline-none placeholder-[#8696a0]"
                            autoFocus
                        />
                    </div>
    
                    {/* Thumbnails & Send */}
                    <div className="h-24 bg-[#202c33] border-t border-gray-700 flex items-center px-4 gap-2 shrink-0 overflow-x-auto pb-4 pt-2 justify-center relative">
                        {/* Add More Button */}
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-12 h-12 rounded border border-gray-600 flex items-center justify-center hover:bg-[#374248] shrink-0"
                         >
                            <span className="text-2xl text-gray-400">+</span>
                         </button>
    
                         {/* Thumbs */}
                         {attachmentDrafts.map((draft, i) => (
                             <div 
                                key={i} 
                                onClick={() => setCurrentDraftIndex(i)}
                                className={`w-12 h-12 rounded overflow-hidden cursor-pointer relative shrink-0 ${currentDraftIndex === i ? 'ring-2 ring-teal-500' : 'opacity-70 hover:opacity-100'}`}
                             >
                                 {draft.type === 'image' ? (
                                     <img src={draft.preview} className="w-full h-full object-cover" />
                                 ) : draft.type === 'video' ? (
                                    <video src={draft.preview} className="w-full h-full object-cover" />
                                 ) : (
                                    <div className="w-full h-full bg-gray-700 flex items-center justify-center"><FileText className="w-6 h-6 text-white"/></div>
                                 )}
                             </div>
                         ))}
    
                        <div className="absolute right-4 bottom-4">
                             <button 
                                onClick={sendMessage}
                                className="bg-teal-500 hover:bg-teal-600 text-white rounded-full p-3 shadow-lg"
                            >
                                <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" version="1.1"><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Attachment Menu */}
            {isAttachmentOpen && (
                <div className="absolute bottom-16 left-4 bg-[#233138] rounded-lg shadow-lg py-2 flex flex-col gap-1 w-40 animate-in fade-in slide-in-from-bottom-2 z-20">
                    <button 
                        onClick={() => handleAttachmentClick('image')}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-[#182229] text-[#e9edef] text-sm"
                    >
                        <ImageIcon className="w-5 h-5 text-purple-500" />
                        <span>Photos & Videos</span>
                    </button>
                    <button 
                        onClick={() => handleAttachmentClick('document')}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-[#182229] text-[#e9edef] text-sm"
                    >
                        <FileText className="w-5 h-5 text-indigo-500" />
                        <span>Document</span>
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2 w-full">
                <button 
                    onClick={() => setIsAttachmentOpen(!isAttachmentOpen)}
                    className={`p-2 rounded-full transition-colors ${isAttachmentOpen ? "bg-[#2a3942] text-[#e9edef]" : "text-[#8696a0] hover:text-[#e9edef]"}`}
                    title="Attach"
                >
                    <Paperclip className="w-6 h-6 rotate-45" />
                </button>

                <input 
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                />
                
                {isRecording ? (
                    <div className="flex-1 flex items-center gap-4 bg-[#2a3942] rounded-lg px-4 py-2 animate-in fade-in">
                        <span className="text-red-500 animate-pulse">● Rec</span>
                        <span className="text-[#e9edef] flex-1 text-center">
                            {formatTime(recordingDuration)}
                        </span>
                        <button onClick={cancelRecording} className="text-red-400 hover:text-red-300">
                             ✕
                        </button>
                        <button onClick={stopAndSendRecording} className="text-green-400 hover:text-green-300">
                             <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" version="1.1"><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                        </button>
                    </div>
                ) : (
                    <>
                        <input 
                            value={inputText}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyPress}
                            placeholder="Type a message"
                            className="flex-1 bg-[#2a3942] text-[#e9edef] rounded-lg px-4 py-2 text-sm focus:outline-none placeholder-[#8696a0]"
                        />
                        {inputText.trim() ? (
                            <button 
                                onClick={sendMessage}
                                className="p-2 rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors"
                            >
                                <svg viewBox="0 0 24 24" height="24" width="24" preserveAspectRatio="xMidYMid meet" className="" version="1.1" x="0px" y="0px" enableBackground="new 0 0 24 24"><title>send</title><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                            </button>
                        ) : (
                            <button 
                                onClick={startRecording}
                                className="p-2 rounded-full hover:bg-[#2a3942] text-[#8696a0] transition-colors"
                            >
                                <Mic className="w-6 h-6" />
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
      </>
  ) : (
      <div className="flex-1 flex flex-col items-center justify-center text-[#8696a0] border-b-[6px] border-[#4fb38e] box-border">
          <h1 className="text-3xl font-light text-[#e9edef] mt-10">WhatsApp Web</h1>
          <p className="mt-4">Select a chat to start messaging</p>
      </div>
  );

  return (
    <>
      <ChatLayout sidebar={renderSidebar} activeChat={renderChat} isConnected={status === "Connected"} />
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#202c33] border-gray-700 text-[#e9edef]">
          <DialogHeader>
            <DialogTitle>Rename Contact</DialogTitle>
            <DialogDescription className="text-gray-400">
              Set a custom name for this contact. This will be visible only to you.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right text-gray-300">
                Name
              </Label>
              <Input
                id="name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="col-span-3 bg-[#2a3942] border-gray-600 text-[#e9edef] focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setIsRenameOpen(false)} className="bg-gray-600 hover:bg-gray-700 text-white border-0">Cancel</Button>
            <Button type="submit" onClick={submitRename} className="bg-[#00a884] hover:bg-[#008f6f] text-white">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      

    </>
  );
}

