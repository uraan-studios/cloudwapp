
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "../ui/textarea";
import { ArrowLeft, Camera, Loader2, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useChat } from "../../lib/chat-sdk";

interface ProfileSettingsSidebarProps {
    onBack: () => void;
    chatData: ReturnType<typeof useChat>;
}

export function ProfileSettingsSidebar({ onBack }: Omit<ProfileSettingsSidebarProps, 'chatData'> & { chatData: any }) {
    const [isLoading, setIsLoading] = useState(false);

    const [profile, setProfile] = useState<any>({
        about: "",
        email: "",
        description: "",
        address: "",
        websites: ["", ""],
        profile_picture_url: ""
    });
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setIsLoading(true);
        fetch("http://localhost:3000/settings/profile")
            .then(res => res.json())
            .then(data => {
                if (data && data.data && data.data[0]) {
                    const p = data.data[0];
                    setProfile({
                        about: p.about || "",
                        email: p.email || "",
                        description: p.description || "",
                        address: p.address || "",
                        websites: p.websites || ["", ""],
                        profile_picture_url: p.profile_picture_url || ""
                    });
                }
            })
            .catch(err => console.error("Failed to fetch profile", err))
            .finally(() => setIsLoading(false));
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch("http://localhost:3000/settings/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    about: profile.about,
                    email: profile.email,
                    description: profile.description,
                    address: profile.address,
                    websites: profile.websites.filter((w: string) => w.trim() !== "")
                })
            });
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append("file", file);

        setIsLoading(true);
        try {
            await fetch("http://localhost:3000/settings/profile-photo", {
                method: "POST",
                body: formData
            });
            // Refresh profile to see new photo (it takes time for Meta to propagate, so we might just show local preview)
            setProfile((prev: any) => ({ ...prev, profile_picture_url: URL.createObjectURL(file) }));
        } catch (err) {
            console.error("Failed to upload photo", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#111b21] animate-in slide-in-from-left duration-200">
            <div className="h-[108px] bg-[#202c33] flex items-end px-4 pb-4 shrink-0 gap-4">
                <button onClick={onBack} className="mb-1 text-[#d9dee0] hover:text-white transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="flex flex-col mb-0.5">
                    <h1 className="text-[#e9edef] text-xl font-medium">Profile</h1>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col items-center py-8 gap-4">
                     <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <Avatar className="w-40 h-40">
                            <AvatarImage src={profile.profile_picture_url} className="object-cover" />
                            <AvatarFallback className="bg-[#202c33] text-gray-500 text-4xl">BP</AvatarFallback>
                        </Avatar>
                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                            <Camera className="w-8 h-8 text-white" />
                            <span className="sr-only">Change Profile Photo</span>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                     </div>
                </div>

                <div className="px-6 space-y-8 pb-10">
                    <div className="space-y-4">
                        <Label className="text-teal-500 text-sm font-medium">About</Label>
                        <div className="flex gap-2">
                             <Input 
                                value={profile.about} 
                                disabled={isLoading}
                                onChange={(e) => setProfile({ ...profile, about: e.target.value })} 
                                className="bg-transparent border-t-0 border-x-0 border-b border-[#8696a0] rounded-none focus-visible:ring-0 px-0 text-[#e9edef]"
                                placeholder="Hey there! I am using WhatsApp."
                             />
                             <Button size="icon" variant="ghost" className="text-[#8696a0]" onClick={() => {/* Focus input */}}><Check className="w-4 h-4 opacity-0" /></Button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-teal-500 text-sm font-medium">Description</Label>
                        <Textarea 
                            value={profile.description} 
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setProfile({ ...profile, description: e.target.value })}
                            className="bg-[#202c33] border-none text-[#e9edef] min-h-[100px]"
                            placeholder="Tell customers about your business..."
                        />
                    </div>

                    <div className="space-y-4">
                        <Label className="text-teal-500 text-sm font-medium">Business Details</Label>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs text-[#8696a0]">Address</Label>
                                <Input 
                                    value={profile.address} 
                                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                                    className="bg-[#202c33] border-none text-[#e9edef]" 
                                    placeholder="Business Address"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-[#8696a0]">Email</Label>
                                <Input 
                                    value={profile.email} 
                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                    className="bg-[#202c33] border-none text-[#e9edef]" 
                                    placeholder="contact@business.com"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-[#8696a0]">Website 1</Label>
                                <Input 
                                    value={profile.websites[0]} 
                                    onChange={(e) => { const w = [...profile.websites]; w[0] = e.target.value; setProfile({ ...profile, websites: w }); }}
                                    className="bg-[#202c33] border-none text-[#e9edef]" 
                                    placeholder="https://..."
                                />
                            </div>
                             <div className="space-y-1">
                                <Label className="text-xs text-[#8696a0]">Website 2</Label>
                                <Input 
                                    value={profile.websites[1]} 
                                    onChange={(e) => { const w = [...profile.websites]; w[1] = e.target.value; setProfile({ ...profile, websites: w }); }}
                                    className="bg-[#202c33] border-none text-[#e9edef]" 
                                    placeholder="https://..."
                                />
                            </div>
                        </div>
                    </div>
                    
                    <Button onClick={handleSave} disabled={isSaving} className="w-full bg-[#00a884] hover:bg-[#008f6f] text-[#111b21] font-bold">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
}
