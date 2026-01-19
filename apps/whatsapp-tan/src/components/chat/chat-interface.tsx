
import { useState, useRef, useEffect, useMemo } from "react";
import { MessageBubble } from "../message-bubble";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Paperclip, FileText, Mic, Phone, Image, Camera, Zap, PlusCircle, Info } from "lucide-react";
import { type Message } from "../../lib/chat-sdk";
import { useChat } from "../../lib/chat-sdk";
import { TemplateDrawer } from "./template-drawer";
import { InteractiveDrawer } from "./interactive-drawer";

const ChatTooltip = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="bg-[#202c33] border-white/10 text-[#e9edef]">{label}</TooltipContent>
    </Tooltip>
);

interface ChatAreaProps {
  chatData: ReturnType<typeof useChat>;
  onProfileOpen: () => void;
  onCallStart: () => void;
}

export function ChatArea({ chatData, onProfileOpen, onCallStart }: ChatAreaProps) {
    const { 
        activeContact, 
        messages, 
        status, 
        loadMore, 
        hasMore, 
        sdk 
    } = chatData;

    const [inputText, setInputText] = useState("");
    const [replyingTo, setReplyingTo] = useState<any | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [isAttachmentOpen, setIsAttachmentOpen] = useState(false);
    const [attachmentDrafts, setAttachmentDrafts] = useState<{ file: File, preview: string, type: 'image' | 'video' | 'audio' | 'document', caption: string }[]>([]);
    const [currentDraftIndex, setCurrentDraftIndex] = useState(0);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    
    // Drawer States
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [isInteractiveDrawerOpen, setIsInteractiveDrawerOpen] = useState(false);
    
    // Refs
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const activeMessages = useMemo(() => 
        messages.filter(m => (activeContact && (m.from === activeContact.id || m.to === activeContact.id))),
        [messages, activeContact]
    );

    const isWindowOpen = activeContact ? (Date.now() - (activeContact.lastUserMsgTimestamp || 0) < 24 * 60 * 60 * 1000) : true;
    
    const getDisplayName = (c: any) => c.customName || c.pushName || c.name || c.id;

    // Scroll to bottom on load
    useEffect(() => {
        if (!isLoadingMore) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, activeContact, isLoadingMore]);

    // Read Receipts
    useEffect(() => {
        if (!activeContact) return;
        const unread = activeMessages.filter(m => m.direction === 'incoming' && m.status !== 'read');
        if (unread.length > 0) {
            unread.forEach(m => sdk.sendReadReceipt(m.id));
        }
    }, [activeMessages.length, activeContact?.id]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop } = e.currentTarget;
        if (scrollTop === 0 && hasMore && !isLoadingMore && activeContact) {
            setIsLoadingMore(true);
            loadMore();
            setTimeout(() => setIsLoadingMore(false), 500);
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputText(val);
        if (val === "/buttons" || val === "/quick") { setIsInteractiveDrawerOpen(true); setInputText(""); return; }
        if (val === "/template" || val === "/temp") { setIsTemplateModalOpen(true); setInputText(""); return; }
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

      const handleToggleStar = (msgId: string, isStarred: boolean) => {
        sdk.starMessage(msgId, isStarred);
        if (activeContact) sdk.getStarredMessages(activeContact.id);
      };

    if (!activeContact) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-[#8696a0] border-b-[6px] border-[#4fb38e]">
                <h1 className="text-3xl font-light text-[#e9edef] mt-10">WhatsApp Web</h1>
                <p className="mt-4">Select a chat to start messaging</p>
            </div>
        );
    }

    return (
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
                    <button onClick={onCallStart} className="text-[#8696a0] hover:text-[#e9edef] transition-all"><Phone className="w-5 h-5" /></button>
                    <button onClick={onProfileOpen} className="text-[#8696a0] hover:text-[#e9edef] transition-all"><Info className="w-5 h-5" /></button>
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
                                                <MessageBubble key={msg.id} message={msg as any} onReply={setReplyingTo} onReact={(id, emoji) => sdk.sendReaction(activeContact!.id, id, emoji)} onAddNote={onProfileOpen} onQuoteClick={scrollToMessage} allMessages={activeMessages} isHighlighted={highlightedMessageId === msg.id} onStar={() => handleToggleStar(msg.id, !msg.is_starred as any)} />
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
                        <div className="flex-1 flex items-center justify-between gap-4 bg-[#1f2428] rounded-lg px-4 py-2 border border-yellow-600/30"><span className="text-yellow-500 text-xs">⚠️ 24h Window Closed</span><button onClick={() => setIsTemplateModalOpen(true)} className="text-xs bg-teal-600 text-white px-3 py-2 rounded">Send Template</button></div>
                    ) : (
                    <>
                        <Input value={inputText} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a message" className="flex-1 bg-[#2a3942] border-none text-[#e9edef] focus-visible:ring-1 focus-visible:ring-teal-500/50" />
                        <div className="flex items-center gap-1">
                            <ChatTooltip label="Send Template">
                                <button onClick={() => setIsTemplateModalOpen(true)} className="p-2 text-[#8696a0] hover:text-teal-500 transition-colors">
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
            
            <TemplateDrawer isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)} chatData={chatData} />
            <InteractiveDrawer isOpen={isInteractiveDrawerOpen} onClose={() => setIsInteractiveDrawerOpen(false)} chatData={chatData} />
        </div>
    );
}
