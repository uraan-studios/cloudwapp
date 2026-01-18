import React, { useState, useRef, useEffect } from "react";
import { 
    Play, Pause, MoreVertical, Reply, Check, CheckCheck, FileIcon, Volume2, 
    Smile, Copy, Star, Trash2, Pin, Forward, BookMarked, ChevronDown 
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

import { type Message } from "../lib/chat-sdk";

interface MessageBubbleProps {
  message: Message;
  onReply: (msg: Message) => void;
  onReact: (id: string, emoji: string) => void;
  onAddNote?: (content: string) => void;
  onQuoteClick?: (id: string) => void;
  onSendMessage?: (content: string) => void;
  allMessages?: Message[];
  isHighlighted?: boolean;
}

const StaticWaveform: React.FC<{ 
    src: string, 
    progress: number, 
    isPlaying: boolean,
    onSeek: (percent: number) => void 
}> = ({ src, progress, isPlaying, onSeek }) => {
    const [peaks, setPeaks] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;
        const generateWaveform = async () => {
            try {
                const response = await fetch(src, { mode: 'cors' });
                const arrayBuffer = await response.arrayBuffer();
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                
                const rawData = audioBuffer.getChannelData(0); // Use first channel
                const samples = 45; // Number of bars
                const blockSize = Math.floor(rawData.length / samples);
                const filteredData: number[] = [];

                for (let i = 0; i < samples; i++) {
                    let blockStart = blockSize * i;
                    let sum = 0;
                    for (let j = 0; j < blockSize; j++) {
                        sum += Math.abs(rawData[blockStart + j]);
                    }
                    filteredData.push(sum / blockSize);
                }

                // Normalize to 0-1
                const max = Math.max(...filteredData);
                const normalized = filteredData.map(n => n / (max || 1));

                if (isMounted) {
                    setPeaks(normalized);
                    setIsLoading(false);
                }
                await audioCtx.close();
            } catch (err) {
                console.error("Waveform generation failed:", err);
                if (isMounted) {
                    setPeaks(new Array(45).fill(0.2).map(v => v + Math.random() * 0.1));
                    setIsLoading(false);
                }
            }
        };

        generateWaveform();
        return () => { isMounted = false; };
    }, [src]);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = (x / rect.width) * 100;
        onSeek(percent);
    };

    return (
        <div 
            ref={containerRef}
            className="flex items-center gap-[2px] h-8 w-full cursor-pointer group/wave"
            onClick={handleClick}
        >
            {isLoading ? (
                <div className="flex items-center gap-[2px] w-full animate-pulse">
                    {Array.from({ length: 45 }).map((_, i) => (
                        <div key={i} className="flex-1 bg-white/10 rounded-full h-2" style={{ height: `${20 + Math.random() * 40}%` }} />
                    ))}
                </div>
            ) : (
                peaks.map((peak: number, i: number) => {
                    const isPassed = (i / peaks.length) * 100 <= progress;
                    const height = Math.max(15, peak * 100);
                    return (
                        <div 
                            key={i}
                            className="flex-1 rounded-full transition-all duration-300"
                            style={{ 
                                height: `${height}%`,
                                backgroundColor: isPassed ? '#2dd4bf' : 'rgba(255,255,255,0.2)'
                            }}
                        />
                    );
                })
            )}
        </div>
    );
};

const AudioPlayer: React.FC<{ src: string }> = ({ src }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const togglePlay = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(console.error);
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    };

    const handleSeek = (percent: number) => {
        if (!audioRef.current || !audioRef.current.duration) return;
        const time = (percent / 100) * audioRef.current.duration;
        audioRef.current.currentTime = time;
        setProgress(percent);
    };

    return (
        <div className="flex items-center gap-4 py-2 px-1 min-w-[300px]">
            <div className="relative shrink-0">
                <button 
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-teal-500 text-white hover:bg-teal-600 transition-all shadow-xl active:scale-95 z-10 relative group/btn"
                >
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                </button>
                {isPlaying && (
                    <div className="absolute inset-0 rounded-full bg-teal-500 animate-ping opacity-20" />
                )}
            </div>
            <div className="flex-1 flex flex-col justify-center gap-1 overflow-hidden">
                <StaticWaveform 
                    src={src} 
                    progress={progress} 
                    isPlaying={isPlaying} 
                    onSeek={handleSeek}
                />
                <div className="flex justify-between items-center px-0.5">
                    <div className="flex items-center gap-1.5 opacity-30">
                        <Volume2 className="w-3 h-3" />
                        <span className="text-[10px] font-mono whitespace-nowrap">
                            {audioRef.current && audioRef.current.duration && audioRef.current.duration !== Infinity
                                ? `${Math.floor(audioRef.current.currentTime)}s / ${Math.floor(audioRef.current.duration)}s` 
                                : "0s"}
                        </span>
                    </div>
                </div>
            </div>
            <audio 
                ref={audioRef} 
                src={src} 
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
                crossOrigin="anonymous"
            />
        </div>
    );
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
    message, 
    onReply, 
    onReact, 
    onAddNote,
    onQuoteClick,
    onSendMessage,
    allMessages = [],
    isHighlighted = false
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const isMe = message.direction === "outgoing";
  const time = new Date(message.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase();
  
  const quotedMessage = message.context?.message_id 
    ? allMessages.find(m => m.id === message.context?.message_id) 
    : null;

  const resolveInteractiveBody = (content: string) => {
      try {
          const parsed = JSON.parse(content);
          if (parsed.type === 'button') return parsed.body?.text || parsed.body || "Interactive Message";
          if (parsed.type === 'button_reply') return parsed.button_reply?.title || "Button Choice";
          if (parsed.type === 'list_reply') return parsed.list_reply?.title || "List Choice";
          if (parsed.body?.text) return parsed.body.text;
          if (typeof parsed.body === 'string') return parsed.body;
          return "Interactive Message";
      } catch {
          return content.slice(0, 50);
      }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(message.content);
  };

  return (
    <div 
        id={`msg-${message.id}`}
        className={`flex w-full mb-1 group px-4 transition-all duration-500 animate-in fade-in slide-in-from-bottom-2 ${isMe ? "justify-end" : "justify-start"} ${isHighlighted ? "animate-flash-highlight" : ""}`}
    >
      <div className={`flex flex-col max-w-[70%] relative ${isMe ? "items-end" : "items-start"}`}>
          <ContextMenu>
            <ContextMenuTrigger className="w-full">
              <div
                className={`relative p-2 rounded-xl modern-bubble-shadow transition-all duration-300 min-w-[120px] ${
                  isMe ? "bg-[#005c4b] text-white" : "bg-[#202c33] text-[#e9edef]"
                } ${isHighlighted ? "ring-2 ring-teal-500/50" : ""}`}
              >
                {/* Context Menu Chevron Hover */}
                <div 
                    onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-50 transition-opacity cursor-pointer z-10 hover:opacity-100"
                >
                    <ChevronDown className="w-4 h-4" />
                </div>

                {isDropdownOpen && (
                    <div className="absolute top-6 right-1 bg-[#232d36] rounded-xl shadow-2xl py-1.5 min-w-[160px] z-50 border border-white/5 animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => { onReply(message); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[#2a3942] transition-colors flex items-center gap-3">
                            <Reply className="w-3.5 h-3.5 text-gray-400" /> Reply
                        </button>
                        <button onClick={() => { handleCopy(); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[#2a3942] transition-colors flex items-center gap-3">
                            <Copy className="w-3.5 h-3.5 text-gray-400" /> Copy
                        </button>
                        <button onClick={() => { onAddNote?.(message.content); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-[#2a3942] transition-colors flex items-center gap-3">
                            <BookMarked className="w-3.5 h-3.5 text-teal-500" /> Add to Note
                        </button>
                        <hr className="my-1 border-white/5" />
                        <button className="w-full text-left px-4 py-2 text-sm hover:bg-[#2a3942] transition-colors text-red-500 flex items-center gap-3">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    </div>
                )}

                {/* Quoted Context */}
                {message.context && (
                    <div 
                        onClick={() => message.context?.message_id && onQuoteClick?.(message.context.message_id)}
                        className="bg-black/20 dark:bg-black/30 rounded-lg p-2 mb-2 text-xs border-l-4 border-teal-500 opacity-90 flex flex-col gap-0.5 max-w-full overflow-hidden cursor-pointer hover:bg-black/40 transition-colors"
                    >
                        <span className="text-teal-400 font-bold text-[10px] uppercase tracking-wider">
                            {quotedMessage ? (quotedMessage.direction === 'outgoing' ? 'You' : 'Them') : 'Reply'}
                        </span>
                        <span className="text-gray-300 truncate italic">
                            {quotedMessage?.type === 'text' ? quotedMessage.content : 
                            quotedMessage?.type === 'interactive' ? resolveInteractiveBody(quotedMessage.content) :
                            quotedMessage?.type === 'template' ? `Template: ${JSON.parse(quotedMessage.content).name}` :
                            quotedMessage ? `[${quotedMessage.type}]` : 'Original message not found'}
                        </span>
                    </div>
                )}

                <div className="text-[14.5px] leading-relaxed wrap-break-word whitespace-pre-wrap font-sans px-1">
                    {(() => {
                        if (message.type === 'text') return message.content;
                        
                        try {
                            const media = JSON.parse(message.content);
                            if (message.type === 'image') return (
                                <div className="flex flex-col">
                                    <img 
                                        src={`http://localhost:3000/media/${media.id}`} 
                                        alt={media.caption || "Image"} 
                                        className="rounded-lg max-w-[320px] max-h-[400px] object-cover border border-white/10"
                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400?text=Image+Unavailable'; }}
                                    />
                                    {media.caption && <span className="mt-2 text-sm opacity-90">{media.caption}</span>}
                                </div>
                            );

                            if (message.type === 'video') return (
                                <div className="flex flex-col">
                                    <video controls className="max-w-[320px] rounded-lg border border-white/10">
                                        <source src={`http://localhost:3000/media/${media.id}`} type="video/mp4" />
                                        Your browser does not support the video tag.
                                    </video>
                                    {media.caption && <span className="mt-2 text-sm opacity-90">{media.caption}</span>}
                                </div>
                            );
                            
                            if (message.type === 'audio') return (
                                <AudioPlayer src={`http://localhost:3000/media/${media.id}`} />
                            );
                            
                            if (message.type === 'document') return (
                                <div className="flex items-center gap-3 p-3 bg-black/10 dark:bg-black/20 rounded-xl hover:bg-black/20 transition-colors cursor-pointer group/doc">
                                    <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg group-hover/doc:bg-teal-500 group-hover/doc:text-white transition-all">
                                        <FileIcon className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col overflow-hidden max-w-[180px]">
                                        <span className="truncate text-sm font-medium">{media.filename || "Document"}</span>
                                        <span className="text-[10px] opacity-60 uppercase tracking-tighter">PDF • 2.4 MB</span>
                                    </div>
                                </div>
                            );
                            
                            if (message.type === 'interactive') {
                                const inter = media;
                                if (inter.type === 'button_reply') return <div className="text-sm">{inter.button_reply?.title}</div>;
                                if (inter.type === 'list_reply') return (
                                    <div className="flex flex-col gap-1">
                                        <div className="font-bold text-sm tracking-tight">{inter.list_reply?.title}</div>
                                        {inter.list_reply?.description && <div className="text-xs opacity-70 italic">{inter.list_reply.description}</div>}
                                    </div>
                                );

                                return (
                                    <div className="flex flex-col gap-1 min-w-[240px]">
                                        {inter.header && <div className="font-bold text-sm tracking-tight border-b border-white/5 pb-2 mb-2">{inter.header.text || inter.header}</div>}
                                        <div className="text-[14px] leading-[1.4] opacity-90">{inter.body?.text || inter.body}</div>
                                        {inter.footer && <div className="text-[10px] opacity-50 mt-1 uppercase tracking-widest">{inter.footer.text || inter.footer}</div>}
                                        <div className="flex flex-col gap-2 mt-4">
                                            {inter.action?.buttons?.map((b: any) => (
                                                <button 
                                                    key={b.reply.id} 
                                                    onClick={() => onSendMessage?.(b.reply.title)}
                                                    className="w-full glass py-2.5 rounded-lg text-teal-400 font-semibold text-xs text-center hover:bg-white/5 transition-all active:scale-[0.98] border border-transparent hover:border-teal-500/20"
                                                >
                                                    {b.reply.title}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }

                            if (message.type === 'template') {
                                const template = JSON.parse(message.content);
                                return (
                                    <div className="flex flex-col gap-2 min-w-[220px]">
                                        <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-teal-500 mb-1 flex items-center gap-1.5 opacity-80">
                                            <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                                            Official Template
                                        </div>
                                        <div className="text-[15px] font-medium font-outfit leading-relaxed">
                                            {template.name}
                                        </div>
                                        <div className="text-[13px] opacity-60 italic">
                                            {template.components?.map((c: any) => c.parameters?.map((p: any) => p.text).join(", ")).join(" | ")}
                                        </div>
                                    </div>
                                );
                            }

                            if (message.type === 'sticker') return (
                                <img 
                                    src={`http://localhost:3000/media/${media.id}`} 
                                    alt="Sticker" 
                                    className="max-w-[140px] max-h-[140px] object-contain animate-in zoom-in-50 duration-300"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/120?text=Sticker'; }}
                                />
                            );

                            return <i className="opacity-50 text-xs tracking-tight uppercase">Media: {message.type}</i>;

                        } catch(e) {
                            return message.content;
                        }
                    })()}
                </div>
                
                <div className="flex justify-end items-center gap-1 mt-0 px-1 translate-y-1">
                    <span className="text-[10px] opacity-50 font-medium italic lowercase">{time}</span>
                    {isMe && (
                        <div className="transition-all duration-300 scale-75 opacity-70">
                            {message.status === 'sent' && <Check className="w-4 h-4 text-white/40" />}
                            {message.status === 'delivered' && <CheckCheck className="w-4 h-4 text-white/40" />}
                            {message.status === 'read' && <CheckCheck className="w-4 h-4 text-blue-400" />}
                            {message.status === 'failed' && <span className="text-[10px] text-red-500 font-bold">!</span>}
                        </div>
                    )}
                </div>
              </div>
            </ContextMenuTrigger>
            
            <ContextMenuContent className="bg-[#232d36] border-none text-[#e9edef] w-64 p-1.5 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 ring-1 ring-white/5">
                <ContextMenuItem onClick={() => onReply(message)} className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#2a3942] cursor-pointer transition-colors group/item">
                    <Reply className="w-4 h-4 text-gray-400 group-hover/item:text-white" />
                    <span className="text-[14px] font-medium">Reply</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={handleCopy} className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#2a3942] cursor-pointer transition-colors group/item">
                    <Copy className="w-4 h-4 text-gray-400 group-hover/item:text-white" />
                    <span className="text-[14px] font-medium">Copy</span>
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onReact(message.id, '❤️')} className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#2a3942] cursor-pointer transition-colors group/item">
                    <Smile className="w-4 h-4 text-gray-400 group-hover/item:text-white" />
                    <span className="text-[14px] font-medium">React</span>
                </ContextMenuItem>
                <ContextMenuItem className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#2a3942] cursor-pointer transition-colors group/item">
                    <Forward className="w-4 h-4 text-gray-400 group-hover/item:text-white" />
                    <span className="text-[14px] font-medium">Forward</span>
                </ContextMenuItem>
                <ContextMenuItem className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#2a3942] cursor-pointer transition-colors group/item">
                    <Pin className="w-4 h-4 text-gray-400 group-hover/item:text-white" />
                    <span className="text-[14px] font-medium">Pin</span>
                </ContextMenuItem>
                <ContextMenuItem className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#2a3942] cursor-pointer transition-colors group/item">
                    <Star className="w-4 h-4 text-gray-400 group-hover/item:text-white" />
                    <span className="text-[14px] font-medium">Star</span>
                </ContextMenuItem>
                
                <ContextMenuSeparator className="bg-white/5 my-1" />
                
                <ContextMenuItem onClick={() => onAddNote?.(message.content)} className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#2a3942] cursor-pointer transition-colors group/item">
                    <BookMarked className="w-4 h-4 text-teal-500" />
                    <span className="text-[14px] font-medium">Add text to note</span>
                </ContextMenuItem>
                
                <ContextMenuSeparator className="bg-white/5 my-1" />
                
                <ContextMenuItem className="flex items-center gap-4 px-3 py-2.5 rounded-xl hover:bg-[#2a3942] cursor-pointer transition-colors group/del">
                    <Trash2 className="w-4 h-4 text-red-500/80 group-hover/del:text-red-500" />
                    <span className="text-[14px] font-medium text-red-500/80 group-hover/del:text-red-500">Delete</span>
                </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          {/* Premium Reactions Overlay */}
          {message.reactions && Object.values(message.reactions).length > 0 && (
                <div className="absolute -bottom-2 right-1 glass rounded-full px-2 py-0.5 shadow-xl text-sm flex gap-1 animate-in zoom-in-50 duration-300 transform scale-110 translate-y-1">
                    {Object.values(message.reactions).map((r, i) => <span key={i} className="hover:scale-125 transition-transform cursor-pointer drop-shadow">{r}</span>)}
                </div>
          )}

          {/* Discreet Tracking ID */}
          <div className="text-[6px] text-white/5 mt-1 select-all font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute -left-16 top-1/2 -translate-y-1/2 bg-black/20 px-1 py-0.5 rounded hidden xl:block pointer-events-none">
                {message.id.slice(-6).toUpperCase()}
          </div>
      </div>
    </div>
  );
};
