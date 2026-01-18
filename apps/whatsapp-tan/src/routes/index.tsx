import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef, useMemo } from "react";
import { ChatLayout } from "../components/chat-layout";
import { MessageBubble } from "../components/message-bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchBar } from "../components/sidebar/search-bar";
import { TabsList } from "../components/sidebar/tabs-list";
import { CallModal } from "../components/call-modal";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Paperclip, FileText, Mic, Phone, Video, Trash2, Star, Edit2, Image, Camera, Zap, PlusCircle, MessageSquarePlus } from "lucide-react";
import { useChat, type Message, type Contact } from "../lib/chat-sdk";
import { useWebRTC } from "../lib/use-webrtc";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreVertical, Settings, LogOut, User, Archive, BellOff, MessageSquare } from "lucide-react";

export const Route = createFileRoute('/')({
  component: Home,
})

const ChatTooltip = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="bg-[#202c33] border-white/10 text-[#e9edef]">{label}</TooltipContent>
    </Tooltip>
);

function Home() {
  const { 
    contacts, 
    messages, 
    status, 
    activeContact, 
    selectContact, 
    loadMore, 
    hasMore, 
    sdk,
    callEvent 
  } = useChat();

  // Pure UI States
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [newChatValue, setNewChatValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
  const [attachmentDrafts, setAttachmentDrafts] = useState<{ file: File, preview: string, type: 'image' | 'video' | 'audio' | 'document', caption: string }[]>([]);
  const [currentDraftIndex, setCurrentDraftIndex] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ id: string, content: string, timestamp: number }[]>([]);

  // Template/Interactive States
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [headerParams, setHeaderParams] = useState<string[]>([]);
  const [buttonParams, setButtonParams] = useState<Record<number, string>>({});
  const [headerMedia, setHeaderMedia] = useState<{ file: File | null, id: string | null, type: string | null, preview: string | null }>({ file: null, id: null, type: null, preview: null });
  const [isInteractiveDrawerOpen, setIsInteractiveDrawerOpen] = useState(false);
  const [interactiveDraft, setInteractiveDraft] = useState<{ body: string, footer: string, buttons: string[], header: string }>({ 
      body: "", 
      footer: "", 
      buttons: ["", ""],
      header: ""
  });

  // Call States
  const [callState, setCallState] = useState<{
      isOpen: boolean;
      type: 'incoming' | 'outgoing' | 'active';
      callId?: string;
      remoteSdp?: string;
      contactName: string;
  }>({
      isOpen: false,
      type: 'incoming',
      contactName: '',
  });
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<string>("init");
  const [lastError] = useState<string>("");
  const [iceState, setIceState] = useState<string>("");

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // WebRTC Hook
  const { createOffer, createAnswer, handleAnswer, cleanup: webrtcCleanup, toggleMute: webrtcToggleMute } = useWebRTC({
    onRemoteStream: (stream) => {
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
            remoteAudioRef.current.play().catch(console.error);
        }
    },
    onIceCandidate: () => {},
    onConnectionStateChange: (state) => setConnectionStatus(state),
    onIceConnectionStateChange: (state) => setIceState(state)
  });

  // Call duratings effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState.type === 'active' && connectionStatus === 'connected') {
        interval = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    } else {
        if (callState.type !== 'active') setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [callState.type, connectionStatus]);

  // Handle Call Events from SDK
  useEffect(() => {
    if (!callEvent) return;
    const { type, data } = callEvent;

    if (type === 'call_answered') {
        if (data.sdp) handleAnswer(data.sdp);
    } else if (type === 'call_incoming') {
        setCallState({
            isOpen: true,
            type: 'incoming',
            contactName: data.fromName || data.from || 'Unknown',
            callId: data.id,
            remoteSdp: data.sdp || data.session?.sdp
        });
    } else if (type === 'call_ended') {
        endCallCleanup();
    } else if (type === 'call_created') {
        setCallState(prev => ({ ...prev, callId: data.callId }));
    }
  }, [callEvent]);

  // Auto-scroll
  useEffect(() => {
    if (!isLoadingMore) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeContact, isLoadingMore]);

  // Read Receipts
  const activeMessages = useMemo(() => 
    messages.filter(m => (activeContact && (m.from === activeContact.id || m.to === activeContact.id))),
    [messages, activeContact]
  );

  useEffect(() => {
      if (!activeContact) return;
      const unread = activeMessages.filter(m => m.direction === 'incoming' && m.status !== 'read');
      if (unread.length > 0) {
          unread.forEach(m => sdk.sendReadReceipt(m.id));
      }
  }, [activeMessages.length, activeContact?.id]);

  // Helpers
  const getDisplayName = (c: Contact) => c.customName || c.pushName || c.name || c.id;
  const isWindowOpen = activeContact ? (Date.now() - (activeContact.lastUserMsgTimestamp || 0) < 24 * 60 * 60 * 1000) : true;
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const scrollToMessage = (id: string) => {
      const element = document.getElementById(`msg-${id}`);
      if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedMessageId(id);
          setTimeout(() => setHighlightedMessageId(null), 2500);
      }
  };

  // Actions
  const handleAddNote = (content: string) => {
      setNotes(prev => [{ id: Math.random().toString(36).substr(2, 9), content, timestamp: Date.now() }, ...prev]);
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        mediaRecorderRef.current.start();
        setIsRecording(true);
        setRecordingDuration(0);
    } catch (e) {
        alert("Could not access microphone.");
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
        interval = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const stopAndSendRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.onstop = async () => {
              const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); 
              const formData = new FormData();
              formData.append("file", new File([audioBlob], "voice_note.webm", { type: 'audio/webm' }));
              try {
                  const res = await fetch("http://localhost:3000/upload", { method: "POST", body: formData });
                  if (res.ok) {
                      const data = await res.json();
                      sdk.sendMessage(activeContact!.id, { type: "audio", id: data.id, caption: "", fileName: "voice_note.ogg", isVoiceNote: true });
                  }
              } catch (e) { console.error(e); }
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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop } = e.currentTarget;
      if (scrollTop === 0 && hasMore && !isLoadingMore && activeContact) {
          setIsLoadingMore(true);
          loadMore();
          setTimeout(() => setIsLoadingMore(false), 500);
      }
  };

  const startCall = async () => {
      if (!activeContact) return;
      const sdp = await createOffer();
      setCallState({ isOpen: true, type: 'outgoing', contactName: getDisplayName(activeContact) });
      sdk.startCall(activeContact.id, sdp);
  };

  const acceptCall = async () => {
      if (!callState.remoteSdp || !callState.callId) return;
      const sdp = await createAnswer(callState.remoteSdp);
      setCallState(prev => ({ ...prev, type: 'active' }));
      sdk.acceptCall(callState.callId, sdp);
  };

  const rejectCall = () => {
      if (callState.callId) sdk.rejectCall(callState.callId);
      endCallCleanup();
  };

  const endCallCleanup = () => {
      webrtcCleanup();
      setCallState(prev => ({ ...prev, isOpen: false }));
  };

  const toggleMute = () => {
      webrtcToggleMute(!isMuted);
      setIsMuted(!isMuted);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setInputText(val);
      if (val === "/buttons" || val === "/quick") { setIsInteractiveDrawerOpen(true); setInputText(""); return; }
      if (val === "/template" || val === "/temp") { openTemplateModal(); setInputText(""); return; }
      if (!activeContact) return;
      if (!isTyping) { setIsTyping(true); sdk.sendTyping(activeContact.id, true); }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => { setIsTyping(false); sdk.sendTyping(activeContact.id, false); }, 2000);
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
                    sdk.sendMessage(activeContact.id, { type: draft.type, id: data.id, caption: draft.caption || "", fileName: draft.file.name });
                }
             } catch(e) { console.error(e); }
        }
        setAttachmentDrafts([]);
        return;
    }
    if (!inputText.trim() || !activeContact) return;
    sdk.sendText(activeContact.id, inputText, replyingTo?.id);
    setInputText("");
    setReplyingTo(null);
  };

  const handleReact = (id: string, emoji: string) => {
      if(!activeContact) return;
      sdk.sendReaction(activeContact.id, id, emoji);
  };

  const submitRename = () => {
    if (activeContact && renameValue && renameValue !== getDisplayName(activeContact)) {
        sdk.updateContactName(activeContact.id, renameValue);
    }
    setIsRenameOpen(false);
  };

  const startNewChat = () => {
      if (newChatValue.trim()) {
          const id = newChatValue.replace(/\D/g, ''); // Clean number
          selectContact(id);
          setIsNewChatOpen(false);
          setNewChatValue("");
      }
  };

  const openTemplateModal = () => {
      setIsTemplateModalOpen(true);
      if (templates.length === 0) {
          setIsLoadingTemplates(true);
          fetch("http://localhost:3000/templates")
            .then(res => res.json())
            .then(data => Array.isArray(data) && setTemplates(data))
            .finally(() => setIsLoadingTemplates(false));
      }
  };

  const handleSendTemplate = () => {
      if (!activeContact || !selectedTemplate) return;
      const components = [];
      if (headerMedia.id) {
          components.push({ type: "header", parameters: [{ type: headerMedia.type?.toLowerCase(), [headerMedia.type?.toLowerCase() || 'image']: { id: headerMedia.id } }] });
      } else if (headerParams.length > 0) {
          components.push({ type: "header", parameters: headerParams.map(p => ({ type: "text", text: p })) });
      }
      if (templateParams.length > 0) {
          components.push({ type: "body", parameters: templateParams.map(p => ({ type: "text", text: p })) });
      }
      const buttonComps = selectedTemplate.components?.find((c: any) => c.type === 'BUTTONS');
      if (buttonComps) {
          buttonComps.buttons.forEach((btn: any, index: number) => {
              if (btn.type === 'URL' && btn.url.includes('{{1}}')) {
                  components.push({ type: "button", sub_type: "url", index, parameters: [{ type: "text", text: buttonParams[index] || "" }] });
              }
          });
      }
      sdk.sendMessage(activeContact.id, { type: "template", templateName: selectedTemplate.name, languageCode: selectedTemplate.languageCode || selectedTemplate.language || "en_US", components });
      setIsTemplateModalOpen(false); setSelectedTemplate(null); setTemplateParams([]); setHeaderParams([]); setButtonParams({}); setHeaderMedia({ file: null, id: null, type: null, preview: null });
  };

  const handleSendInteractive = () => {
      if (!activeContact || !interactiveDraft.body) {
          console.error("[Chat] Cannot send interactive: missing contact or body", { activeContact, body: interactiveDraft.body });
          return;
      }
      const trimmedButtons = interactiveDraft.buttons.filter(b => b.trim() !== "");
      const uniqueButtons = new Set(trimmedButtons.map(b => b.trim()));
      
      if (uniqueButtons.size !== trimmedButtons.length) {
          alert("All button titles must be unique!");
          return;
      }

      if (trimmedButtons.length === 0) {
          console.error("[Chat] Cannot send interactive: no buttons provided");
          return;
      }
      const buttons = trimmedButtons.map((b, i) => ({ type: "reply", reply: { id: `btn_${i}`, title: b.trim() } }));
      const interactive: any = { type: "button", body: { text: interactiveDraft.body }, action: { buttons } };
      if (interactiveDraft.header) interactive.header = { type: "text", text: interactiveDraft.header };
      if (interactiveDraft.footer) interactive.footer = { text: interactiveDraft.footer };
      
      console.log("[Chat] Sending interactive message:", { to: activeContact.id, interactive });
      sdk.sendMessage(activeContact.id, { type: "interactive", interactive });
      setIsInteractiveDrawerOpen(false); 
      setInteractiveDraft({ body: "", footer: "", buttons: ["", ""], header: "" });
  };

  const filteredContacts = useMemo(() => contacts.filter(c => {
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          if (!getDisplayName(c).toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) return false;
      }
      if (activeTab === 'favs') return c.isFavorite;
      return true;
  }), [contacts, searchQuery, activeTab]);

  const renderSidebar = (
      <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 px-4 py-2">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              <ChatTooltip label="New Chat">
                <button 
                    onClick={() => setIsNewChatOpen(true)}
                    className="p-2 bg-[#202c33] hover:bg-[#2a3942] text-teal-500 rounded-lg transition-all active:scale-95 shadow-lg border border-white/5"
                >
                    <MessageSquarePlus className="w-5 h-5" />
                </button>
              </ChatTooltip>
          </div>
          <TabsList activeTab={activeTab} onTabChange={setActiveTab} />
          <ScrollArea className="flex-1">
              {activeTab === 'notes' ? (
                  <div className="p-4 flex flex-col gap-3">
                      {notes.length === 0 ? <div className="text-[#8696a0] text-sm italic text-center mt-10">No saved notes yet</div> : 
                       notes.map(note => (
                          <div key={note.id} className="bg-[#202c33] p-4 rounded-xl border border-white/5 shadow-xl group">
                              <p className="text-[#e9edef] text-sm whitespace-pre-wrap">{note.content}</p>
                              <div className="mt-3 flex justify-between items-center opacity-40 group-hover:opacity-100 transition-opacity">
                                  <span className="text-[9px] uppercase">{new Date(note.timestamp).toLocaleDateString()}</span>
                                  <button onClick={() => setNotes(prev => prev.filter(n => n.id !== note.id))} className="p-1 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="flex flex-col">
                      {filteredContacts.length === 0 && <div className="p-4 text-gray-400 text-sm">No chats found</div>}
                      {filteredContacts.map((c, idx) => (
                        <ContextMenu key={c.id}>
                          <ContextMenuTrigger>
                            <div onClick={() => selectContact(c.id)} className={`flex items-center p-3 cursor-pointer hover:bg-[#202c33] transition-colors group/contact ${activeContact?.id === c.id ? 'bg-[#2a3942]' : ''}`}>
                              <Avatar className="w-12 h-12 mr-3 relative shrink-0 ring-2 ring-transparent group-hover/contact:ring-teal-500/30 transition-all">
                                <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${c.id}`} />
                                <AvatarFallback className="bg-[#182229] border-teal-500/20">{c.id.slice(-2).toUpperCase()}</AvatarFallback>
                                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111b21] ${status === 'Connected' ? 'bg-green-500' : 'bg-gray-500'}`} />
                              </Avatar>
                              <div className="flex-1 min-w-0 pr-1">
                                <div className="flex justify-between items-baseline mb-0.5">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-[#e9edef] text-[15.5px] font-medium truncate">{getDisplayName(c)}</span>
                                    {c.isFavorite && <Star className="w-3 h-3 text-teal-500 fill-teal-500" />}
                                  </div>
                                  <div className="flex flex-col items-end gap-1.5">
                                    <span className="text-[#8696a0] text-[10px] whitespace-nowrap opacity-60 font-medium">
                                      {c.lastMessage && new Date(c.lastMessage.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </span>
                                    {Math.random() > 0.8 && (
                                       <Badge variant="default" className="w-5 h-5 flex items-center justify-center p-0 text-[10px] bg-teal-500 text-[#111b21] hover:bg-teal-500">
                                         {Math.floor(Math.random() * 3) + 1}
                                       </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                  <div className="text-[#8696a0] text-[13px] truncate opacity-70 flex-1">
                                    {c.lastMessage?.type === 'text' ? c.lastMessage.content : c.lastMessage?.type === 'audio' ? '🎤 Voice Note' : c.lastMessage?.type === 'image' ? '📷 Photo' : <i>{c.lastMessage?.type}</i>}
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="opacity-0 group-hover/contact:opacity-100 p-1 hover:bg-white/10 rounded-full transition-all">
                                        <MoreVertical className="w-4 h-4 text-[#8696a0]" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 bg-[#233138] border-white/5">
                                      <DropdownMenuItem onClick={() => sdk.toggleFavorite(c.id)} className="gap-3">
                                        <Star className="w-4 h-4" /> {c.isFavorite ? "Unfavorite" : "Favorite"}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => { selectContact(c.id); setRenameValue(getDisplayName(c)); setIsRenameOpen(true); }} className="gap-3">
                                        <Edit2 className="w-4 h-4" /> Rename
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem className="gap-3 text-red-400 focus:text-red-400">
                                        <Trash2 className="w-4 h-4" /> Delete Chat
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                            {idx < filteredContacts.length - 1 && <Separator className="ml-[72px] opacity-10" />}
                          </ContextMenuTrigger>
                          <ContextMenuContent className="bg-[#202c33] border-none text-[#e9edef] w-48 p-1.5 rounded-2xl shadow-2xl ring-1 ring-white/5">
                            <ContextMenuItem onClick={() => sdk.toggleFavorite(c.id)} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#2a3942] cursor-pointer group/item">
                              <Star className={`w-4 h-4 ${c.isFavorite ? 'text-teal-500 fill-teal-500' : 'text-gray-400 group-hover/item:text-white'}`} />
                              <span className="text-sm font-medium">{c.isFavorite ? "Unfavorite" : "Favorite"}</span>
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => { selectContact(c.id); setRenameValue(getDisplayName(c)); setIsRenameOpen(true); }} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#2a3942] cursor-pointer group/item">
                              <Edit2 className="w-4 h-4 text-gray-400 group-hover/item:text-white" />
                              <span className="text-sm font-medium">Rename</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                  </div>
              )}
          </ScrollArea>
      </div>
  );

  const renderChat = activeContact ? (
      <div className="flex flex-col h-full relative">
        <div className="h-14 bg-[#202c33] flex items-center px-4 shrink-0 shadow-sm z-10 justify-between">
             <div className="flex items-center">
                 <div className="w-10 h-10 rounded-full bg-gray-500 mr-3 flex items-center justify-center text-white">{activeContact.id.slice(-2)}</div> 
                 <div className="flex flex-col">
                     <span className="text-[#e9edef] font-medium">{getDisplayName(activeContact)}</span>
                     <span className="text-[#8696a0] text-xs">{status}</span>
                 </div>
             </div>
             <div className="flex items-center gap-4">
                 <button onClick={startCall} className="text-[#8696a0] hover:text-[#e9edef]"><Phone className="w-5 h-5" /></button>
                 <button className="text-[#8696a0] hover:text-[#e9edef] opacity-50"><Video className="w-5 h-5" /></button>
             </div>
        </div>
        <div className="flex-1 relative overflow-hidden bg-[#0b141a]">
            <div className="absolute inset-0 pointer-events-none z-0 bg-[url('/bg.png')] bg-repeat bg-size-[400px] opacity-[0.15]" />
            <div className="absolute inset-0 pointer-events-none z-0 bg-black/40" />
            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4 xl:px-20 z-10" onScroll={handleScroll}>
                <div className="flex flex-col">
                    {isLoadingMore && <div className="text-center text-xs text-gray-500 py-2">Loading more...</div>}
                    <div className="flex flex-col gap-1">
                        {(() => {
                            const grouped: Record<string, Message[]> = {};
                            activeMessages.forEach(msg => {
                                const date = new Date(msg.timestamp).toLocaleDateString();
                                if (!grouped[date]) grouped[date] = [];
                                grouped[date].push(msg);
                            });
                            return Object.entries(grouped).map(([date, msgs]) => (
                                <div key={date} className="flex flex-col">
                                    <div className="flex justify-center my-6 sticky top-2 z-10">
                                        <span className="bg-[#182229]/90 backdrop-blur-md text-[#8696a0] text-[10px] px-4 py-1.5 rounded-full shadow-lg border border-white/5 uppercase font-bold tracking-widest">{date === new Date().toLocaleDateString() ? "Today" : date === new Date(Date.now() - 86400000).toLocaleDateString() ? "Yesterday" : date}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        {msgs.map(msg => (
                                            <MessageBubble key={msg.id} message={msg as any} onReply={setReplyingTo} onReact={handleReact} onAddNote={handleAddNote} onQuoteClick={scrollToMessage} allMessages={activeMessages} isHighlighted={highlightedMessageId === msg.id} />
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                    <div ref={messagesEndRef} />
                </div>
            </div>
        </div>
        <div className="bg-[#202c33] min-h-[62px] flex flex-col px-4 py-2 gap-2 relative">
            {replyingTo && (
                <div className="bg-[#1d272d] p-2 rounded-t flex justify-between items-center border-l-4 border-teal-500">
                    <div className="flex flex-col text-sm">
                        <span className="text-teal-500 font-bold text-xs">Replying to message</span>
                        <span className="text-[#8696a0] truncate max-w-xs">{replyingTo.content}</span>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-gray-400 hover:text-white">✕</button>
                </div>
            )}
            {attachmentDrafts.length > 0 && (
                <div className="fixed top-0 bottom-0 right-0 left-[400px] z-50 bg-[#0b141a] flex flex-col">
                    <div className="h-16 flex items-center justify-between px-4 bg-[#202c33]"><button onClick={() => setAttachmentDrafts([])} className="text-[#e9edef] p-2">✕</button><span className="text-[#e9edef]">{attachmentDrafts[currentDraftIndex].file.name}</span><div className="w-8"></div></div>
                    <div className="flex-1 flex items-center justify-center p-8 bg-[#0b141a]">{attachmentDrafts[currentDraftIndex].type === 'image' ? <img src={attachmentDrafts[currentDraftIndex].preview} className="max-w-full max-h-full object-contain" /> : <div className="text-gray-400">Preview not available</div>}</div>
                    <div className="bg-[#202c33] p-2 flex justify-center"><input value={attachmentDrafts[currentDraftIndex].caption} onChange={(e) => setAttachmentDrafts(prev => prev.map((d, i) => i === currentDraftIndex ? { ...d, caption: e.target.value } : d))} placeholder="Type a caption" className="bg-[#2a3942] text-[#e9edef] rounded-lg px-4 py-2 w-full max-w-2xl text-center focus:outline-none" /></div>
                    <div className="h-24 bg-[#202c33] border-t border-gray-700 flex items-center px-4 gap-2 justify-center relative">{attachmentDrafts.map((d, i) => <div key={i} onClick={() => setCurrentDraftIndex(i)} className={`w-12 h-12 rounded overflow-hidden cursor-pointer ${currentDraftIndex === i ? 'ring-2 ring-teal-500' : 'opacity-70'}`}>{d.type === 'image' ? <img src={d.preview} className="w-full h-full object-cover" /> : <FileText className="w-full h-full p-2 text-white"/>}</div>)}<button onClick={sendMessage} className="absolute right-4 bottom-4 bg-teal-500 text-white rounded-full p-3"><svg viewBox="0 0 24 24" height="24" width="24"><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg></button></div>
                </div>
            )}
            {isAttachmentOpen && (
                <div className="absolute bottom-20 left-4 bg-[#233138] rounded-2xl p-4 shadow-2xl flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200 z-50 ring-1 ring-white/10">
                    <button onClick={() => { fileInputRef.current?.click(); setIsAttachmentOpen(false); }} className="flex items-center gap-4 text-[#e9edef] hover:bg-[#182229] p-3 rounded-xl transition-all group">
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#7f66ff] to-[#5136ff] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><FileText className="w-6 h-6 text-white" /></div>
                        <span className="font-medium text-[15px]">Document</span>
                    </button>
                    <button onClick={() => { fileInputRef.current?.click(); setIsAttachmentOpen(false); }} className="flex items-center gap-4 text-[#e9edef] hover:bg-[#182229] p-3 rounded-xl transition-all group">
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#007aff] to-[#0051ff] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Image className="w-6 h-6 text-white" /></div>
                        <span className="font-medium text-[15px]">Photos & Videos</span>
                    </button>
                    <button className="flex items-center gap-4 text-[#e9edef] hover:bg-[#182229] p-3 rounded-xl transition-all group opacity-50 cursor-not-allowed">
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-[#ff3b30] to-[#d70015] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Camera className="w-6 h-6 text-white" /></div>
                        <span className="font-medium text-[15px]">Camera</span>
                    </button>
                </div>
            )}
            <div className="flex items-center gap-2 w-full">
                <button onClick={() => setIsAttachmentOpen(!isAttachmentOpen)} className={`p-2 rounded-full ${isAttachmentOpen ? "bg-[#2a3942] text-[#e9edef]" : "text-[#8696a0] hover:text-[#e9edef]"}`}><Paperclip className="w-6 h-6 rotate-45" /></button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setAttachmentDrafts(prev => [...prev, ...files.map(file => ({ 
                        file, 
                        preview: URL.createObjectURL(file), 
                        type: (file.type.startsWith("image/") ? 'image' : 'document') as 'image' | 'document', 
                        caption: "" 
                    }))]);
                }} />
                {isRecording ? (
                    <div className="flex-1 flex items-center gap-4 bg-[#2a3942] rounded-lg px-4 py-2"><span className="text-red-500 animate-pulse">● Rec</span><span className="text-[#e9edef] flex-1 text-center">{formatTime(recordingDuration)}</span><button onClick={cancelRecording} className="text-red-400">✕</button><button onClick={stopAndSendRecording} className="text-green-400 font-bold">SEND</button></div>
                ) : !isWindowOpen ? (
                    <div className="flex-1 flex items-center justify-between gap-4 bg-[#1f2428] rounded-lg px-4 py-2 border border-yellow-600/30"><span className="text-yellow-500 text-xs">⚠️ 24h Window Closed</span><button onClick={openTemplateModal} className="text-xs bg-teal-600 text-white px-3 py-2 rounded">Send Template</button></div>
                ) : (
                  <>
                      <Input value={inputText} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a message" className="flex-1 bg-[#2a3942] border-none text-[#e9edef] focus-visible:ring-1 focus-visible:ring-teal-500/50" />
                      <div className="flex items-center gap-1">
                          <ChatTooltip label="Send Template">
                              <button onClick={openTemplateModal} className="p-2 text-[#8696a0] hover:text-teal-500 transition-colors">
                                  <PlusCircle className="w-5 h-5" />
                              </button>
                          </ChatTooltip>
                          <ChatTooltip label="Quick Reply Buttons">
                              <button onClick={() => setIsInteractiveDrawerOpen(true)} className="p-2 text-[#8696a0] hover:text-yellow-500 transition-colors">
                                  <Zap className="w-5 h-5" />
                              </button>
                          </ChatTooltip>
                          {inputText.trim() ? (
                              <ChatTooltip label="Send">
                                  <button onClick={sendMessage} className="p-2 text-[#8696a0] hover:text-white">
                                      <svg viewBox="0 0 24 24" height="24" width="24"><path fill="currentColor" d="M1.101,21.757L23.8,12.028L1.101,2.3l0.011,7.912l13.623,1.816L1.112,13.845 L1.101,21.757z"></path></svg>
                                  </button>
                              </ChatTooltip>
                          ) : (
                              <ChatTooltip label="Voice Message">
                                  <button onClick={startRecording} className="p-2 text-[#8696a0] hover:text-white">
                                      <Mic className="w-6 h-6" />
                                  </button>
                              </ChatTooltip>
                          )}
                      </div>
                  </>
                )}
            </div>
        </div>
        
        {/* Templates Drawer */}
        <div className={`absolute bottom-0 left-0 right-0 bg-[#202c33] z-20 transition-all duration-300 ${isTemplateModalOpen ? "h-[500px]" : "h-0"} overflow-hidden`}>
            {isTemplateModalOpen && (
                <div className="flex flex-col h-full">
                    <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a3942] bg-[#202c33]">
                        <span className="font-medium text-[#e9edef]">{selectedTemplate ? selectedTemplate.name : "Select Template"}</span>
                        <button onClick={() => { setIsTemplateModalOpen(false); setSelectedTemplate(null); }} className="p-2">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {!selectedTemplate ? (
                            <div className="grid grid-cols-2 gap-3">
                                {isLoadingTemplates ? <div className="col-span-2 text-center text-gray-500">Loading...</div> : 
                                 templates.map(t => <div key={t.name} onClick={() => { 
                                     setSelectedTemplate(t);
                                     const bodyComp = t.components.find((c: any) => c.type === 'BODY');
                                     const matches = bodyComp?.text?.match(/{{(\d+)}}/g);
                                     setTemplateParams(new Array(matches?.length || 0).fill(""));
                                 }} className="bg-[#111b21] p-4 rounded-lg border border-[#2a3942] hover:border-teal-600 cursor-pointer"><h3 className="font-bold text-[#e9edef]">{t.name}</h3><p className="text-xs text-[#8696a0] line-clamp-2">{t.components.find((c: any) => c.type === 'BODY')?.text}</p></div>)}
                            </div>
                        ) : (
                            <div className="max-w-xl mx-auto space-y-4">
                                <div className="bg-[#e9edef] p-4 rounded-lg text-black text-sm whitespace-pre-wrap">{selectedTemplate.components.find((c: any) => c.type === 'BODY')?.text.replace(/{{(\d+)}}/g, (_: any, i: string) => templateParams[parseInt(i)-1] || `{{${i}}}`)}</div>
                                <div className="space-y-3">
                                    {templateParams.map((p, i) => <div key={i}><Label className="text-xs text-teal-500">Var {i+1}</Label><Input value={p} onChange={e => { const n = [...templateParams]; n[i] = e.target.value; setTemplateParams(n); }} className="bg-[#2a3942] border-none text-white"/></div>)}
                                    <Button onClick={handleSendTemplate} className="w-full bg-[#00a884] hover:bg-[#008f6f]">Send Template</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Interactive Drawer */}
        <div className={`absolute bottom-0 left-0 right-0 bg-[#202c33] z-20 transition-all duration-300 ${isInteractiveDrawerOpen ? "h-[500px]" : "h-0"} overflow-hidden shadow-2xl`}>
            {isInteractiveDrawerOpen && (
                <div className="flex flex-col h-full bg-[#111b21]">
                    <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a3942] bg-[#202c33]">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            <span className="font-medium text-[#e9edef]">Quick Buttons</span>
                        </div>
                        <button onClick={() => setIsInteractiveDrawerOpen(false)} className="text-[#8696a0] hover:text-white transition-colors">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar lg:px-20">
                        <div className="max-w-xl mx-auto space-y-4 pb-10">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-[#8696a0] ml-1">Header (Optional)</Label>
                                <Input value={interactiveDraft.header} onChange={e => setInteractiveDraft(p => ({ ...p, header: e.target.value }))} placeholder="Title text..." className="bg-[#2a3942] border-none text-white focus-visible:ring-teal-500" />
                            </div>
                            
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-[#8696a0] ml-1">Body Message</Label>
                                <textarea value={interactiveDraft.body} onChange={e => setInteractiveDraft(p => ({ ...p, body: e.target.value }))} placeholder="Type your message here..." className="w-full bg-[#2a3942] border-none text-[#e9edef] p-3 rounded-lg h-32 focus:outline-none focus:ring-1 focus:ring-teal-500 text-sm leading-relaxed" />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-[#8696a0] ml-1">Buttons (Max 3)</Label>
                                <div className="space-y-2">
                                    {interactiveDraft.buttons.map((b, i) => (
                                        <div key={i} className="relative group">
                                            <Input value={b} onChange={e => { const n = [...interactiveDraft.buttons]; n[i] = e.target.value; setInteractiveDraft(p => ({ ...p, buttons: n })); }} placeholder={`Button ${i+1} title`} className="bg-[#2a3942] border-none text-white pr-10 focus-visible:ring-teal-500" />
                                            {interactiveDraft.buttons.length > 1 && (
                                                <button onClick={() => setInteractiveDraft(p => ({ ...p, buttons: p.buttons.filter((_, idx) => idx !== i) }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">✕</button>
                                            )}
                                        </div>
                                    ))}
                                    {interactiveDraft.buttons.length < 3 && (
                                        <button onClick={() => setInteractiveDraft(p => ({ ...p, buttons: [...p.buttons, ""] }))} className="w-full border border-dashed border-gray-700 p-2 rounded-lg text-xs text-gray-500 hover:text-teal-500 hover:border-teal-500 transition-all flex items-center justify-center gap-2">
                                            <PlusCircle className="w-3 h-3" /> Add Button
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-[#8696a0] ml-1">Footer (Optional)</Label>
                                <Input value={interactiveDraft.footer} onChange={e => setInteractiveDraft(p => ({ ...p, footer: e.target.value }))} placeholder="Disclaimers or smaller text..." className="bg-[#2a3942] border-none text-[#8696a0] text-xs focus-visible:ring-teal-500" />
                            </div>

                            <Button onClick={handleSendInteractive} disabled={!interactiveDraft.body || interactiveDraft.buttons.every(b => !b.trim())} className="w-full bg-[#00a884] hover:bg-[#008f6f] text-white font-bold py-6 rounded-xl shadow-lg hover:shadow-teal-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                Send Interactive Message
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
  ) : (
      <div className="flex-1 flex flex-col items-center justify-center text-[#8696a0] border-b-[6px] border-[#4fb38e]">
          <h1 className="text-3xl font-light text-[#e9edef] mt-10">WhatsApp Web</h1>
          <p className="mt-4">Select a chat to start messaging</p>
      </div>
  );

  return (
    <TooltipProvider>
      <ChatLayout sidebar={renderSidebar} activeChat={renderChat} isConnected={status === "Connected"} />
      <audio ref={remoteAudioRef} className="fixed bottom-0 left-0 w-1 h-1 opacity-0 pointer-events-none" playsInline autoPlay />
      
      <CallModal 
          isOpen={callState.isOpen}
          type={callState.type}
          contactName={callState.contactName}
          onAccept={acceptCall}
          onReject={rejectCall}
          onEnd={rejectCall}
          isMuted={isMuted}
          toggleMute={toggleMute}
          duration={connectionStatus === 'connected' ? formatTime(callDuration) : connectionStatus}
      />

      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#202c33] border-gray-700 text-[#e9edef]">
          <DialogHeader><DialogTitle>Rename Contact</DialogTitle></DialogHeader>
          <div className="py-4"><Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className="bg-[#2a3942] border-gray-600 text-white" /></div>
          <DialogFooter><Button onClick={submitRename} className="bg-[#00a884] hover:bg-[#008f6f]">Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="sm:max-w-[425px] bg-[#202c33] border-gray-700 text-[#e9edef]">
          <DialogHeader><DialogTitle>Start New Chat</DialogTitle></DialogHeader>
          <div className="py-4 flex flex-col gap-4">
              <Label className="text-xs text-[#8696a0]">Enter WhatsApp Number (with country code)</Label>
              <Input 
                  value={newChatValue} 
                  onChange={(e) => setNewChatValue(e.target.value)} 
                  placeholder="e.g. 923135502848"
                  className="bg-[#2a3942] border-gray-600 text-white" 
                  onKeyDown={(e) => e.key === 'Enter' && startNewChat()}
              />
          </div>
          <DialogFooter><Button onClick={startNewChat} className="bg-[#00a884] hover:bg-[#008f6f]">Start Chat</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connectivity Debugger */}
      {callState.isOpen && (
          <div className="fixed top-4 right-4 bg-black/80 text-white p-2 text-xs rounded z-50 max-w-xs font-mono border border-gray-700 shadow-xl">
              <div className="font-bold border-b border-gray-600 mb-1 pb-1">WebRTC Debugger</div>
              <div className={connectionStatus === 'connected' ? 'text-green-400' : 'text-yellow-400'}>Status: {connectionStatus}</div>
              <div>ICE State: {iceState}</div>
              {lastError && <div className="text-red-400 mt-1 border-t border-red-900 pt-1">{lastError}</div>}
              <div>Dur: {callDuration}s</div>
               <div className="mt-1 text-[10px] text-gray-400">
                   {iceState.includes('relay') && <span className="text-green-400">✅ Relay (TURN) Active</span>}
                   {!iceState.includes('srflx') && !iceState.includes('relay') && "⚠️ Critical: STUN/TURN Failed. Check Firewall."}
              </div>
          </div>
      )}
    </TooltipProvider>
  );
}
