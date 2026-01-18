import { Tabs, TabsList as ShTabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface TabsListProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  tabs: { id: string, name: string, type: 'system' | 'custom' }[];
  onCreateTab: () => void;
  onDeleteTab: (id: string) => void;
}

export function TabsList({ activeTab, onTabChange, tabs, onCreateTab, onDeleteTab }: TabsListProps) {
  return (
    <div className="px-4 py-2 bg-[#111b21] border-b border-white/5">
      <div className="flex items-center gap-2">
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex-1">
          <ScrollArea className="w-full">
            <ShTabsList className="bg-transparent h-9 p-0 gap-2 flex justify-start">
              {tabs.map(tab => (
                <ContextMenu key={tab.id}>
                  <ContextMenuTrigger>
                    <TabsTrigger 
                      value={tab.id} 
                      className="rounded-full px-4 h-8 bg-[#202c33] data-[state=active]:bg-teal-500/20 data-[state=active]:text-teal-500 text-[#8696a0] hover:text-[#e9edef] transition-all border border-white/5 text-xs font-medium"
                    >
                      {tab.name}
                    </TabsTrigger>
                  </ContextMenuTrigger>
                  {tab.type === 'custom' && (
                    <ContextMenuContent className="bg-[#233138] border-white/5 text-red-400">
                      <ContextMenuItem onClick={() => onDeleteTab(tab.id)}>Delete Group</ContextMenuItem>
                    </ContextMenuContent>
                  )}
                </ContextMenu>
              ))}
            </ShTabsList>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </Tabs>
        <button 
          onClick={onCreateTab}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-[#202c33] text-[#8696a0] hover:text-teal-500 hover:bg-[#2a3942] transition-all border border-white/5 shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
