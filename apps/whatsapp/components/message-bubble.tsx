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
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onReply, onReact }) => {
  const isMe = message.direction === "outgoing";
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const [showActions, setShowActions] = useState(false);

  return (
    <div 
        className={`flex w-full mb-2 group ${isMe ? "justify-end" : "justify-start"}`}
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
                <div className="bg-black/10 dark:bg-white/10 rounded p-1 mb-1 text-xs border-l-4 border-teal-500 opacity-70">
                    Replying to messsage...
                    {/* In a real app we would look up the message content here */}
                </div>
            )}

            <div className="text-sm wrap-break-word whitespace-pre-wrap">
                {message.type === 'text' ? message.content : <i className="text-gray-400">Unsupported message type</i>}
            </div>
            
            <div className="flex justify-end items-center gap-1 mt-1">
                <span className="text-[10px] text-gray-500 dark:text-gray-400">{time}</span>
                {isMe && (
                    <span className={`text-[10px] ${message.status === 'read' ? 'text-blue-500' : 'text-gray-500'}`}>
                        {message.status === 'sent' && '✓'} 
                        {message.status === 'delivered' && '✓✓'}
                        {message.status === 'read' && <span className="text-blue-400">✓✓</span>}
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
