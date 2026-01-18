import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="px-4 py-3 bg-[#111b21]">
      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8696a0] group-focus-within:text-teal-500 transition-colors pointer-events-none z-10" />
        <Input 
          type="text"
          className="w-full pl-10 bg-[#202c33] border-none rounded-2xl text-[#e9edef] placeholder:text-[#8696a0] py-5 focus-visible:ring-1 focus-visible:ring-teal-500/50" 
          placeholder="Search or start new chat" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
