import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Settings, LogOut, User, MessageSquare, Archive, BellOff, MoreVertical } from "lucide-react";

interface ChatLayoutProps {
  sidebar: React.ReactNode;
  activeChat: React.ReactNode;
  isConnected: boolean;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ sidebar, activeChat, isConnected }) => {
  return (
    <div className="flex h-screen w-full bg-[#111b21] overflow-hidden font-sans">
      {/* Sidebar - Contacts */}
      <div className="w-[30%] min-w-[350px] border-r border-white/5 flex flex-col shadow-2xl z-20">
        <div className="h-16 bg-[#202c33] flex items-center px-4 shrink-0 justify-between">
             <div className="flex items-center gap-3">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Avatar className="w-10 h-10 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-transparent active:ring-teal-500/50">
                        <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=Admin`} />
                        <AvatarFallback className="bg-teal-600/20 text-teal-500">CW</AvatarFallback>
                      </Avatar>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-56 bg-[#233138] border-white/5">
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2"><User className="w-4 h-4" /> Profile</DropdownMenuItem>
                      <DropdownMenuItem className="gap-2"><Settings className="w-4 h-4" /> Settings</DropdownMenuItem>
                      <DropdownMenuItem className="gap-2"><Archive className="w-4 h-4" /> Archived</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 text-red-400 focus:text-red-400"><LogOut className="w-4 h-4" /> Logout</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <div className="flex flex-col">
                    <span className="text-[#e9edef] font-semibold text-sm tracking-tight">CloudWapp</span>
                    <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'} transition-all duration-500`}></div>
                        <span className="text-[10px] text-[#8696a0] font-bold uppercase tracking-widest opacity-70">{isConnected ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
             </div>
             <div className="flex items-center gap-2">
                <button className="p-2 text-[#8696a0] hover:bg-white/10 rounded-full transition-all"><MessageSquare className="w-5 h-5" /></button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="p-2 text-[#8696a0] hover:bg-white/10 rounded-full transition-all"><MoreVertical className="w-5 h-5" /></button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-[#233138] border-white/5">
                        <DropdownMenuItem className="gap-2"><User className="w-4 h-4" /> Profile</DropdownMenuItem>
                        <DropdownMenuItem className="gap-2"><BellOff className="w-4 h-4" /> Mute Notifications</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2"><Archive className="w-4 h-4" /> Archived</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
             </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
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
