import { useState } from "react";
import { useChat } from "../../lib/chat-sdk";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Zap, PlusCircle } from "lucide-react";

interface InteractiveDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    chatData: ReturnType<typeof useChat>;
}

export function InteractiveDrawer({ isOpen, onClose, chatData }: InteractiveDrawerProps) {
    const { activeContact, sdk } = chatData;
    const [interactiveDraft, setInteractiveDraft] = useState<{ body: string, footer: string, buttons: string[], header: string }>({ 
        body: "", 
        footer: "", 
        buttons: ["", ""],
        header: ""
    });

    const handleSendInteractive = () => {
        if (!activeContact || !interactiveDraft.body) {
            console.error("[Chat] Cannot send interactive: missing contact or body");
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
        
        sdk.sendMessage(activeContact.id, { type: "interactive", interactive });
        onClose(); 
        setInteractiveDraft({ body: "", footer: "", buttons: ["", ""], header: "" });
    };

    return (
        <div className={`absolute bottom-0 left-0 right-0 bg-[#202c33] z-20 transition-all duration-300 ${isOpen ? "h-[500px]" : "h-0"} overflow-hidden shadow-2xl`}>
            {isOpen && (
                <div className="flex flex-col h-full bg-[#111b21]">
                    <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a3942] bg-[#202c33]">
                        <div className="flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            <span className="font-medium text-[#e9edef]">Quick Buttons</span>
                        </div>
                        <button onClick={onClose} className="text-[#8696a0] hover:text-white transition-colors">✕</button>
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
    );
}
