
import { useState } from "react";
import { useChat } from "../../lib/chat-sdk";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { X, Bookmark, Trash2, Calendar, PlusCircle } from "lucide-react";

interface ContactProfileProps {
    onClose: () => void;
    chatData: ReturnType<typeof useChat>;
}

export function ContactProfile({ onClose, chatData }: ContactProfileProps) {
    const { activeContact, sdk, starredMessages, contactNotes } = chatData;
    const [profileSection, setProfileSection] = useState<'info' | 'starred' | 'notes'>('info');
    const [noteInput, setNoteInput] = useState("");

    if (!activeContact) return null;

    const getDisplayName = (c: any) => c.customName || c.pushName || c.name || c.id;

    const handleAddNote = () => {
        if (!activeContact || !noteInput.trim()) return;
        sdk.addNote(activeContact.id, noteInput);
        setNoteInput("");
    };

    const handleToggleStar = (msgId: string, isStarred: boolean) => {
        sdk.starMessage(msgId, isStarred);
        if (activeContact) sdk.getStarredMessages(activeContact.id);
    };

    return (
        <div className="flex flex-col h-full bg-[#0b141a] border-l border-white/5">
            <div className="h-16 bg-[#202c33] flex items-center px-4 shrink-0 gap-4">
                <button onClick={onClose} className="p-2 text-[#8696a0] hover:text-white"><X className="w-6 h-6" /></button>
                <span className="text-[#e9edef] font-medium">Contact Info</span>
            </div>
            <ScrollArea className="flex-1">
                <div className="flex flex-col items-center p-6 bg-[#202c33] mb-2 shadow-xl">
                    <Avatar className="w-32 h-32 mb-4 ring-4 ring-teal-500/20">
                        <AvatarImage src={`https://api.dicebear.com/7.x/notionists/svg?seed=${activeContact.id}`} />
                        <AvatarFallback className="text-3xl">{activeContact.id.slice(-2)}</AvatarFallback>
                    </Avatar>
                    <h2 className="text-[#e9edef] text-xl font-bold">{getDisplayName(activeContact)}</h2>
                    <p className="text-[#8696a0] text-sm mt-1">+{activeContact.id}</p>
                </div>

                <div className="flex border-b border-white/5 bg-[#202c33]/50">
                    <button onClick={() => setProfileSection('info')} className={`flex-1 py-3 text-xs uppercase font-bold tracking-widest transition-all ${profileSection === 'info' ? 'text-teal-500 border-b-2 border-teal-500' : 'text-[#8696a0] hover:text-white'}`}>Details</button>
                    <button onClick={() => setProfileSection('starred')} className={`flex-1 py-3 text-xs uppercase font-bold tracking-widest transition-all ${profileSection === 'starred' ? 'text-teal-500 border-b-2 border-teal-500' : 'text-[#8696a0] hover:text-white'}`}>Bookmarks</button>
                    <button onClick={() => setProfileSection('notes')} className={`flex-1 py-3 text-xs uppercase font-bold tracking-widest transition-all ${profileSection === 'notes' ? 'text-teal-500 border-b-2 border-teal-500' : 'text-[#8696a0] hover:text-white'}`}>Timeline</button>
                </div>

                <div className="p-4">
                    {profileSection === 'info' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-[#202c33] p-4 rounded-xl border border-white/5">
                                <Label className="text-[10px] uppercase font-bold text-teal-500">About</Label>
                                <p className="text-[#e9edef] text-sm mt-2 leading-relaxed">Hey there! I am using WhatsApp.</p>
                            </div>
                            <div className="bg-[#202c33] p-4 rounded-xl border border-white/5 space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-[#8696a0]">Media, Links & Docs</span>
                                    <span className="text-teal-500 font-bold">0</span>
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto py-1">
                                    <div className="w-16 h-16 rounded bg-[#2a3942] animate-pulse" />
                                    <div className="w-16 h-16 rounded bg-[#2a3942] animate-pulse" />
                                    <div className="w-16 h-16 rounded bg-[#2a3942] animate-pulse" />
                                </div>
                            </div>
                        </div>
                    )}

                    {profileSection === 'starred' && (
                        <div className="space-y-4 animate-in slide-in-from-right duration-300">
                            {(starredMessages[activeContact.id] || []).length === 0 ? (
                                <div className="text-center py-20">
                                    <Bookmark className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-20" />
                                    <p className="text-[#8696a0] text-sm">No starred messages yet</p>
                                </div>
                            ) : (
                                starredMessages[activeContact.id].map(msg => (
                                    <div key={msg.id} className="bg-[#202c33] p-3 rounded-xl border border-white/5 shadow-lg group relative">
                                        <p className="text-[#e9edef] text-sm leading-relaxed">{msg.content}</p>
                                        <div className="mt-2 flex justify-between items-center text-[10px] text-[#8696a0]">
                                            <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <button onClick={() => handleToggleStar(msg.id, false)} className="text-teal-500 hover:text-red-500"><Trash2 className="w-3 h-3"/></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {profileSection === 'notes' && (
                        <div className="space-y-4 animate-in slide-in-from-right duration-300">
                            <div className="flex gap-2">
                                <Input 
                                  value={noteInput} 
                                  onChange={e => setNoteInput(e.target.value)} 
                                  onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                                  placeholder="Add a note to this chat..." 
                                  className="bg-[#2a3942] border-none text-white text-sm"
                                />
                                <Button onClick={handleAddNote} className="bg-teal-500 hover:bg-teal-600"><PlusCircle className="w-4 h-4" /></Button>
                            </div>
                            
                            <div className="relative pl-6 border-l border-white/10 ml-2 space-y-6 py-4">
                                {(contactNotes[activeContact.id] || []).length === 0 ? (
                                    <p className="text-center text-[#8696a0] text-xs italic py-10 ml-[-24px]">Start building the timeline...</p>
                                ) : (
                                    contactNotes[activeContact.id].map(note => (
                                        <div key={note.id} className="relative">
                                            <div className="absolute -left-[29px] top-1 w-2 h-2 rounded-full bg-teal-500 ring-4 ring-[#0b141a]" />
                                            <div className="bg-[#202c33] p-4 rounded-2xl border border-white/5 shadow-xl group">
                                                <p className="text-[#e9edef] text-sm whitespace-pre-wrap">{note.content}</p>
                                                <div className="mt-2 flex justify-between items-center opacity-40 group-hover:opacity-100 transition-opacity">
                                                    <div className="flex items-center gap-2 text-[9px] uppercase font-bold tracking-tighter">
                                                        <Calendar className="w-3 h-3 text-teal-500" />
                                                        {new Date(note.timestamp).toLocaleDateString()}
                                                    </div>
                                                    <button onClick={() => sdk.deleteNote(note.id, activeContact.id)} className="p-1 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
