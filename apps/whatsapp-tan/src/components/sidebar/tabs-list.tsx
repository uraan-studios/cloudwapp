import { cn } from "@/lib/utils";

interface TabsListProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function TabsList({ activeTab, onTabChange }: TabsListProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 scrollbar-none border-b border-white/5 bg-[#111b21]">
      <button 
        className={cn(
            "px-6 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95",
            activeTab === 'all' ? "bg-teal-500 text-[#111b21] shadow-lg shadow-teal-500/20" : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]"
        )}
        onClick={() => onTabChange('all')}
      >
        Chats
      </button>
      <button 
        className={cn(
            "px-6 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95",
            activeTab === 'favs' ? "bg-teal-500 text-[#111b21] shadow-lg shadow-teal-500/20" : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]"
        )}
        onClick={() => onTabChange('favs')}
      >
        Favorites
      </button>
      <button 
        className={cn(
            "px-6 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95",
            activeTab === 'notes' ? "bg-teal-500 text-[#111b21] shadow-lg shadow-teal-500/20" : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]"
        )}
        onClick={() => onTabChange('notes')}
      >
        Notes
      </button>
    </div>
  );
}
