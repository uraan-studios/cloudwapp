import { cn } from "@/lib/utils";

interface TabsListProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function TabsList({ activeTab, onTabChange }: TabsListProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-3 py-2 scrollbar-none border-b border-[#202c33] bg-[#111b21]">
      <button 
        className={cn(
            "px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors",
            activeTab === 'all' ? "bg-[#25d366] text-[#111b21] font-medium" : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]"
        )}
        onClick={() => onTabChange('all')}
      >
        All
      </button>
      <button 
        className={cn(
            "px-4 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors",
            activeTab === 'favs' ? "bg-[#25d366] text-[#111b21] font-medium" : "bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]"
        )}
        onClick={() => onTabChange('favs')}
      >
        FPS
      </button>
    </div>
  );
}
