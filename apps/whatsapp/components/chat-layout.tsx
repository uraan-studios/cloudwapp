import React from "react";

interface ChatLayoutProps {
  sidebar: React.ReactNode;
  activeChat: React.ReactNode;
  isConnected: boolean;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ sidebar, activeChat, isConnected }) => {
  return (
    <div className="flex h-screen w-full bg-[#111b21] overflow-hidden">
      {/* Sidebar - Contacts */}
      <div className="w-[30%] min-w-[300px] border-r border-[#202c33] flex flex-col">
        <div className="h-14 bg-[#202c33] flex items-center px-4 shrink-0">
             <div className="w-8 h-8 rounded-full bg-gray-400 mr-4"></div> 
             <div className="flex flex-col">
                <span className="text-[#e9edef] font-medium">CloudWapp</span>
                <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} transition-colors duration-300`}></div>
                    <span className="text-[10px] text-[#8696a0]">{isConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
             </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#111b21]">
            {sidebar}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[#0b141a]">
         {/* Background pattern could go here */}
         {activeChat}
      </div>
    </div>
  );
};
