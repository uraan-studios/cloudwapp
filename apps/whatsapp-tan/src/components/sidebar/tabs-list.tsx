import { Tabs, TabsList as ShTabsList, TabsTrigger } from "@/components/ui/tabs";

interface TabsListProps {
  activeTab: string;
  onTabChange: (id: string) => void;
}

export function TabsList({ activeTab, onTabChange }: TabsListProps) {
  return (
    <div className="px-4 py-2 bg-[#111b21]">
      <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
        <ShTabsList className="w-full h-10 bg-[#202c33] p-1 gap-1">
          <TabsTrigger value="all" className="flex-1 rounded-md transition-all">Chats</TabsTrigger>
          <TabsTrigger value="favs" className="flex-1 rounded-md transition-all">Favorites</TabsTrigger>
          <TabsTrigger value="notes" className="flex-1 rounded-md transition-all">Notes</TabsTrigger>
        </ShTabsList>
      </Tabs>
    </div>
  );
}
