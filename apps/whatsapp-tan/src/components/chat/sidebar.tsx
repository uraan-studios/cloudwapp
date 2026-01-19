import { useState, useMemo } from "react";
import { SearchBar } from "../sidebar/search-bar";
import { TabsList } from "../sidebar/tabs-list";
import { Search, MessageSquarePlus, Star, Edit2, LayoutList, Trash2, Info, MoreVertical, LogOut, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChat } from "../../lib/chat-sdk";
import { ProfileSettingsSidebar } from "./profile-sidebar";

const ChatTooltip = ({ label, children }: { label: string, children: React.ReactNode }) => (
    <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="bg-[#202c33] border-white/10 text-[#e9edef]">{label}</TooltipContent>
    </Tooltip>
);

interface ChatSidebarProps {
    chatData: ReturnType<typeof useChat>;
    onProfileOpen: () => void;
}

export function ChatSidebar({ chatData, onProfileOpen }: ChatSidebarProps) {
    const { 
        contacts, 
        activeContact, 
        selectContact, 
        status, 
        tabs, 
        sdk 
    } = chatData;

    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("all");
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [newChatValue, setNewChatValue] = useState("");
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [renameValue, setRenameValue] = useState("");
    const [isNewTabOpen, setIsNewTabOpen] = useState(false);
    const [newTabName, setNewTabName] = useState("");
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const getDisplayName = (c: any) => c.customName || c.pushName || c.name || c.id;

    const filteredContacts = useMemo(() => contacts.filter(c => {
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!getDisplayName(c).toLowerCase().includes(q) && !c.id.toLowerCase().includes(q)) return false;
        }
        
        if (activeTab === 'all') return true;
        if (activeTab === 'favs') return c.isFavorite;
        
        return c.tabId === activeTab;
    }), [contacts, searchQuery, activeTab]);

    const startNewChat = () => {
        if (newChatValue.trim()) {
            const id = newChatValue.replace(/\D/g, '');
            selectContact(id);
            setIsNewChatOpen(false);
            setNewChatValue("");
        }
    };

    const submitRename = () => {
        if (activeContact && renameValue && renameValue !== getDisplayName(activeContact)) {
            sdk.updateContactName(activeContact.id, renameValue);
        }
        setIsRenameOpen(false);
    };

    const handleCreateTab = () => {
        if (newTabName.trim()) {
            sdk.createTab(newTabName);
            setIsNewTabOpen(false);
            setNewTabName("");
        }
    };

    const handleDeleteTab = (id: string) => {
        sdk.deleteTab(id);
        if (activeTab === id) setActiveTab("all");
    };

    if (isSettingsOpen) {
        return <ProfileSettingsSidebar onBack={() => setIsSettingsOpen(false)} chatData={chatData} />;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="h-16 bg-[#202c33] flex items-center justify-between px-4 shrink-0 border-r border-[#202c33]">
                <div className="flex items-center gap-3">
                    <div onClick={() => setIsSettingsOpen(true)} className="cursor-pointer">
                        <Avatar className="w-10 h-10 hover:opacity-80 transition-opacity">
                            <AvatarImage src="https://github.com/shadcn.png" />
                            <AvatarFallback>ME</AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[#e9edef] font-medium text-sm">CloudWapp</span>
                        <div className="flex items-center gap-1.5 ">
                             <div className={`w-2 h-2 rounded-full ${status === 'Connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-red-500'} transition-all duration-500`}></div>
                            <span className="text-[10px] text-[#8696a0] font-bold uppercase tracking-widest opacity-70">{status === 'Connected' ? 'Online' : 'Offline'}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4 text-[#aebac1]">
                    <ChatTooltip label="New Chat">
                        <button onClick={() => setIsNewChatOpen(true)}><MessageSquarePlus className="w-5 h-5" /></button>
                    </ChatTooltip>
                    <DropdownMenu>
                        <DropdownMenuTrigger>
                            <MoreVertical className="w-5 h-5" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#233138] border-white/5 text-[#d9dee0]">
                            <DropdownMenuItem onClick={() => setIsNewTabOpen(true)}>New Group</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setIsSettingsOpen(true)} className="gap-2 cursor-pointer">
                                <Settings className="w-4 h-4" /> Settings
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuItem className="text-red-400 gap-2 cursor-pointer">
                                <LogOut className="w-4 h-4" /> Log out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2">
                <SearchBar value={searchQuery} onChange={setSearchQuery} />
            </div>
            <TabsList 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
                tabs={tabs} 
                onCreateTab={() => setIsNewTabOpen(true)}
                onDeleteTab={handleDeleteTab}
            />
            <ScrollArea className="flex-1">
                <div className="flex flex-col">
                    {filteredContacts.length === 0 && <div className="p-10 text-center flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-[#202c33] flex items-center justify-center text-[#8696a0]"><Search className="w-8 h-8" /></div>
                        <p className="text-gray-400 text-sm">No chats found in this group</p>
                    </div>}
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
                                <div className="flex justify-between items-baseline mb-0">
                                    <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-[#e9edef] text-[15.5px] font-medium truncate">{getDisplayName(c)}</span>
                                    {c.isFavorite && <Star className="w-3 h-3 text-teal-500 fill-teal-500" />}
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5">
                                    <span className="text-[#8696a0] text-[10px] whitespace-nowrap opacity-60 font-medium">
                                        {c.lastMessage && new Date(c.lastMessage.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                                    </span>
                                    {c.unreadCount ? (
                                        <Badge variant="default" className="w-5 h-5 flex items-center justify-center p-0 text-[10px] bg-teal-500 text-[#111b21] hover:bg-teal-500 transition-all scale-100 animate-in fade-in zoom-in duration-300">
                                            {c.unreadCount}
                                        </Badge>
                                    ) : (
                                        <div className="w-5 h-5" />
                                    )}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                    <div className="text-[#8696a0] text-[13px] truncate opacity-70 flex-1 leading-tight">
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
                                        <DropdownMenuSub>
                                            <DropdownMenuSubTrigger className="gap-3"><LayoutList className="w-4 h-4" /> Move to Tab</DropdownMenuSubTrigger>
                                            <DropdownMenuSubContent className="bg-[#233138] border-white/5">
                                                <DropdownMenuItem onClick={() => sdk.assignContactToTab(c.id, null)}>None (All)</DropdownMenuItem>
                                                {tabs.filter(t => t.type === 'custom').map(t => (
                                                    <DropdownMenuItem key={t.id} onClick={() => sdk.assignContactToTab(c.id, t.id)}>{t.name}</DropdownMenuItem>
                                                ))}
                                            </DropdownMenuSubContent>
                                        </DropdownMenuSub>
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
                            <DropdownMenuSeparator />
                            <ContextMenuItem onClick={onProfileOpen} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#2a3942] cursor-pointer group/item">
                                <Info className="w-4 h-4 text-gray-400 group-hover/item:text-white" />
                                <span className="text-sm font-medium">Chat Info</span>
                            </ContextMenuItem>
                            </ContextMenuContent>
                        </ContextMenu>
                        ))}
                    </div>
            </ScrollArea>

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

            <Dialog open={isNewTabOpen} onOpenChange={setIsNewTabOpen}>
                <DialogContent className="sm:max-w-[425px] bg-[#202c33] border-gray-700 text-[#e9edef]">
                <DialogHeader><DialogTitle>Create Custom Group</DialogTitle></DialogHeader>
                <div className="py-4 flex flex-col gap-4">
                    <Label className="text-xs text-[#8696a0]">Group Name</Label>
                    <Input 
                        value={newTabName} 
                        onChange={(e) => setNewTabName(e.target.value)} 
                        placeholder="e.g. Work, Family, Clients"
                        className="bg-[#2a3942] border-gray-600 text-white" 
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateTab()}
                    />
                </div>
                <DialogFooter><Button onClick={handleCreateTab} className="bg-[#00a884] hover:bg-[#008f6f]">Create Group</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
