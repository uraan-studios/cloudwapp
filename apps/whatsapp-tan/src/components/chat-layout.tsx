import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings, LogOut, User, MessageSquare, Archive, BellOff, MoreVertical } from "lucide-react";

interface ChatLayoutProps {
  sidebar: React.ReactNode;
  activeChat: React.ReactNode;
  rightSidebar?: React.ReactNode;
  isConnected: boolean;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ sidebar, activeChat, rightSidebar, isConnected }) => {
  return (
    <div className="flex h-screen w-full bg-[#111b21] overflow-hidden font-sans">
      {/* Sidebar - Contacts */}
      <div className="w-[30%] min-w-[350px] border-r border-white/5 flex flex-col shadow-2xl z-20">
        {sidebar}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex overflow-hidden relative bg-[#0b141a]">
         <div className="flex-1 flex flex-col h-full border-r border-white/5">
            {activeChat}
         </div>
         {rightSidebar && (
             <div className="w-[30%] min-w-[320px] bg-[#0b141a] flex flex-col z-10 animate-in slide-in-from-right duration-300">
                 {rightSidebar}
             </div>
         )}
      </div>
    </div>
  );
};
