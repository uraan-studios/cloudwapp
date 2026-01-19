import { useState } from "react";
import { useChat } from "../../lib/chat-sdk";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TemplateDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    chatData: ReturnType<typeof useChat>;
}

export function TemplateDrawer({ isOpen, onClose, chatData }: TemplateDrawerProps) {
    const { activeContact, sdk } = chatData;
    const [templates, setTemplates] = useState<any[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [templateParams, setTemplateParams] = useState<string[]>([]);
    const [headerParams, setHeaderParams] = useState<string[]>([]);
    const [buttonParams, setButtonParams] = useState<Record<number, string>>({});
    const [headerMedia, setHeaderMedia] = useState<{ file: File | null, id: string | null, type: string | null, preview: string | null }>({ file: null, id: null, type: null, preview: null });

    const openTemplateModal = () => {
        if (templates.length === 0) {
            setIsLoadingTemplates(true);
            fetch("http://localhost:3000/templates")
              .then(res => res.json())
              .then(data => Array.isArray(data) && setTemplates(data))
              .finally(() => setIsLoadingTemplates(false));
        }
    };

    // Trigger fetch when opening if needed
    if (isOpen && templates.length === 0 && !isLoadingTemplates) {
        openTemplateModal();
    }

    const handleSendTemplate = () => {
        if (!activeContact || !selectedTemplate) return;
        const components = [];
        if (headerMedia.id) {
            components.push({ type: "header", parameters: [{ type: headerMedia.type?.toLowerCase(), [headerMedia.type?.toLowerCase() || 'image']: { id: headerMedia.id } }] });
        } else if (headerParams.length > 0) {
            components.push({ type: "header", parameters: headerParams.map(p => ({ type: "text", text: p })) });
        }
        if (templateParams.length > 0) {
            components.push({ type: "body", parameters: templateParams.map(p => ({ type: "text", text: p })) });
        }
        const buttonComps = selectedTemplate.components?.find((c: any) => c.type === 'BUTTONS');
        if (buttonComps) {
            buttonComps.buttons.forEach((btn: any, index: number) => {
                if (btn.type === 'URL' && btn.url.includes('{{1}}')) {
                    components.push({ type: "button", sub_type: "url", index, parameters: [{ type: "text", text: buttonParams[index] || "" }] });
                }
            });
        }
        sdk.sendMessage(activeContact.id, { type: "template", templateName: selectedTemplate.name, languageCode: selectedTemplate.languageCode || selectedTemplate.language || "en_US", components });
        onClose(); 
        setSelectedTemplate(null); 
        setTemplateParams([]); 
        setHeaderParams([]); 
        setButtonParams({}); 
        setHeaderMedia({ file: null, id: null, type: null, preview: null });
    };

    return (
        <div className={`absolute bottom-0 left-0 right-0 bg-[#202c33] z-20 transition-all duration-300 ${isOpen ? "h-[500px]" : "h-0"} overflow-hidden`}>
            {isOpen && (
                <div className="flex flex-col h-full">
                    <div className="h-14 flex items-center justify-between px-4 border-b border-[#2a3942] bg-[#202c33]">
                        <span className="font-medium text-[#e9edef]">{selectedTemplate ? selectedTemplate.name : "Select Template"}</span>
                        <button onClick={() => { onClose(); setSelectedTemplate(null); }} className="p-2 text-[#8696a0] hover:text-white">✕</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {!selectedTemplate ? (
                            <div className="grid grid-cols-2 gap-3">
                                {isLoadingTemplates ? <div className="col-span-2 text-center text-gray-500">Loading...</div> : 
                                 templates.map(t => <div key={t.name} onClick={() => { 
                                     setSelectedTemplate(t);
                                     const bodyComp = t.components.find((c: any) => c.type === 'BODY');
                                     const matches = bodyComp?.text?.match(/{{(\d+)}}/g);
                                     setTemplateParams(new Array(matches?.length || 0).fill(""));
                                 }} className="bg-[#111b21] p-4 rounded-lg border border-[#2a3942] hover:border-teal-600 cursor-pointer"><h3 className="font-bold text-[#e9edef]">{t.name}</h3><p className="text-xs text-[#8696a0] line-clamp-2">{t.components.find((c: any) => c.type === 'BODY')?.text}</p></div>)}
                            </div>
                        ) : (
                            <div className="max-w-xl mx-auto space-y-4">
                                <div className="bg-[#e9edef] p-4 rounded-lg text-black text-sm whitespace-pre-wrap">{selectedTemplate.components.find((c: any) => c.type === 'BODY')?.text.replace(/{{(\d+)}}/g, (_: any, i: string) => templateParams[parseInt(i)-1] || `{{${i}}}`)}</div>
                                <div className="space-y-3">
                                    {templateParams.map((p, i) => <div key={i}><Label className="text-xs text-teal-500">Var {i+1}</Label><Input value={p} onChange={e => { const n = [...templateParams]; n[i] = e.target.value; setTemplateParams(n); }} className="bg-[#2a3942] border-none text-white"/></div>)}
                                    <Button onClick={handleSendTemplate} className="w-full bg-[#00a884] hover:bg-[#008f6f]">Send Template</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
