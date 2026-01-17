import React, { useState } from "react";

interface MessageBubbleProps {
  message: {
    id: string;
    from: string;
    content: string;
    type: string;
    timestamp: number;
    status?: string;
    direction: "incoming" | "outgoing";
    reactions?: Record<string, string>;
    context?: { message_id: string };
  };
  onReply: (msg: any) => void;
  onReact: (id: string, emoji: string) => void;
  onQuoteClick?: (id: string) => void;
  allMessages?: any[];
  isHighlighted?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
    message, 
    onReply, 
    onReact, 
    onQuoteClick,
    allMessages = [],
    isHighlighted = false
}) => {
  const isMe = message.direction === "outgoing";
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const [showActions, setShowActions] = useState(false);

  // Resolve quoted message
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

  return (
    <div 
        id={`msg-${message.id}`}
        className={`flex w-full mb-1 group px-4 transition-colors duration-500 ${isMe ? "justify-end" : "justify-start"} ${isHighlighted ? "animate-flash-highlight" : ""}`}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex flex-col max-w-[70%] relative`}>
          {/* Reaction/Reply Actions */}
          {showActions && (
              <div className={`absolute -top-8 ${isMe ? "right-0" : "left-0"} bg-[#202c33] border border-gray-700 rounded-full flex items-center shadow-lg p-1 gap-1 z-10`}>
                  <button onClick={() => onReact(message.id, "👍")} className="hover:bg-gray-700 p-1 rounded">👍</button>
                  <button onClick={() => onReact(message.id, "❤️")} className="hover:bg-gray-700 p-1 rounded">❤️</button>
                  <button onClick={() => onReact(message.id, "😂")} className="hover:bg-gray-700 p-1 rounded">😂</button>
                  <div className="w-px h-4 bg-gray-600 mx-1"></div>
                  <button onClick={() => onReply(message)} className="text-gray-300 hover:text-white px-2 text-xs">Reply</button>
              </div>
          )}

          <div
            className={`relative p-2 rounded-lg shadow-sm ${
              isMe ? "bg-[#d9fdd3] dark:bg-[#005c4b]" : "bg-white dark:bg-[#202c33]"
            } text-black dark:text-[#e9edef]`}
          >
            {/* Replying Context Indicator */}
            {message.context && (
                <div 
                    onClick={() => message.context?.message_id && onQuoteClick?.(message.context.message_id)}
                    className="bg-black/5 dark:bg-white/5 rounded p-2 mb-2 text-xs border-l-4 border-teal-500 opacity-80 flex flex-col gap-0.5 max-w-full overflow-hidden cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                    <span className="text-teal-500 font-bold">
                        {quotedMessage ? (quotedMessage.direction === 'outgoing' ? 'You' : 'Them') : 'Reply'}
                    </span>
                    <span className="text-[#8696a0] truncate italic">
                        {quotedMessage?.type === 'text' ? quotedMessage.content : 
                         quotedMessage?.type === 'interactive' ? resolveInteractiveBody(quotedMessage.content) :
                         quotedMessage?.type === 'template' ? `Template: ${JSON.parse(quotedMessage.content).name}` :
                         quotedMessage ? `[${quotedMessage.type}]` : 'Original message not found'}
                    </span>
                </div>
            )}

            <div className="text-sm wrap-break-word whitespace-pre-wrap">
                {(() => {
                    if (message.type === 'text') return message.content;
                    
                    try {
                        const media = JSON.parse(message.content);
                        if (message.type === 'image') return (
                            <div className="flex flex-col">
                                <img 
                                    src={`http://localhost:3000/media/${media.id}`} 
                                    alt={media.caption || "Image"} 
                                    className="rounded-lg max-w-[250px] max-h-[250px] object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/200?text=Error'; }}
                                />
                                {media.caption && <span className="mt-1">{media.caption}</span>}
                            </div>
                        );

                        if (message.type === 'video') return (
                            <div className="flex flex-col">
                                <video controls className="max-w-[250px] rounded-lg">
                                    <source src={`http://localhost:3000/media/${media.id}`} type="video/mp4" />
                                    Your browser does not support the video tag.
                                </video>
                                {media.caption && <span className="mt-1">{media.caption}</span>}
                            </div>
                        );
                        
                        if (message.type === 'audio') return (
                             <div className="flex items-center gap-2 p-2 min-w-[200px]">
                                 <audio controls className="w-full h-8">
                                     <source src={`http://localhost:3000/media/${media.id}`} type="audio/webm" />
                                     <source src={`http://localhost:3000/media/${media.id}`} type="audio/mp4" />
                                     Your browser does not support the audio tag.
                                 </audio>
                             </div>
                        );

                        if (message.type === 'document') return (
                            <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                                <span className="text-2xl">📄</span>
                                <span className="truncate max-w-[150px]">{media.filename || "Document"}</span>
                            </div>
                        );
                        
                        if (message.type === 'interactive') {
                            const inter = media; // Already parsed at line 100
                            
                            // Handling incoming replies
                            if (inter.type === 'button_reply') {
                                return (
                                    <div className="text-sm">
                                        {inter.button_reply?.title}
                                    </div>
                                );
                            }

                            if (inter.type === 'list_reply') {
                                return (
                                    <div className="flex flex-col gap-1">
                                        <div className="font-bold text-sm">{inter.list_reply?.title}</div>
                                        {inter.list_reply?.description && <div className="text-xs opacity-70 italic">{inter.list_reply.description}</div>}
                                    </div>
                                );
                            }

                            // Handling outgoing structure
                            return (
                                <div className="flex flex-col gap-1 min-w-[220px]">
                                    {inter.header && <div className="font-bold text-sm border-b border-black/5 dark:border-white/5 pb-1 mb-1">{inter.header.text || inter.header}</div>}
                                    <div className="text-sm">{inter.body?.text || inter.body}</div>
                                    {inter.footer && <div className="text-[10px] opacity-60 mt-1">{inter.footer.text || inter.footer}</div>}
                                    <div className="flex flex-col gap-1.5 mt-3">
                                        {inter.action?.buttons?.map((b: any) => (
                                            <div key={b.reply.id} className="w-full bg-black/5 dark:bg-white/10 py-2 rounded text-teal-600 dark:text-teal-400 font-medium text-xs text-center border border-black/5 dark:border-white/5 shadow-sm">
                                                {b.reply.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        }

                        if (message.type === 'template') {
                            const template = JSON.parse(message.content);
                            return (
                                <div className="flex flex-col gap-1 min-w-[200px]">
                                    <div className="text-[10px] uppercase font-bold tracking-widest text-teal-600 mb-1 flex items-center gap-1">
                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h10v2H7zm0 4h7v2H7z"></path></svg>
                                        Template: {template.name}
                                    </div>
                                    <div className="text-xs opacity-80 whitespace-pre-wrap">
                                        {/* Simple display of variables */}
                                        {template.components?.map((c: any) => c.parameters?.map((p: any) => p.text).join(", ")).join(" | ")}
                                    </div>
                                </div>
                            );
                        }

                        return <i>Media: {message.type} (ID: {media.id})</i>;

                    } catch(e) {
                         // If it's not JSON, just show as text
                         return message.content;
                    }
                })()}
            </div>
            
            <div className="flex justify-end items-center gap-1 mt-1">
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{time}</span>
                {isMe && (
                    <span className={`text-[10px] ${message.status === 'read' ? 'text-blue-500' : message.status === 'failed' ? 'text-red-500' : 'text-gray-500'}`}>
                        {message.status === 'sent' && '✓'} 
                        {message.status === 'delivered' && '✓✓'}
                        {message.status === 'read' && <span className="text-blue-400">✓✓</span>}
                        {message.status === 'failed' && '!'}
                    </span>
                )}
            </div>

            {/* Reactions overlay */}
            {message.reactions && Object.values(message.reactions).length > 0 && (
                <div className="absolute -bottom-3 right-0 bg-white dark:bg-[#202c33] border dark:border-gray-700 rounded-full px-1 shadow text-xs flex gap-0.5">
                    {Object.values(message.reactions).map((r, i) => <span key={i}>{r}</span>)}
                </div>
            )}
            
            {/* Debug ID */}
            <div className="text-[8px] text-gray-500 mt-1 opacity-50 select-all font-mono">
                {message.id}
            </div>
          </div>
      </div>
    </div>
  );
};
