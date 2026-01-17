import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="px-2 py-2">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-[#8696a0]" />
        <Input 
          className="pl-8 bg-[#202c33] border-none text-[#e9edef] placeholder-[#8696a0] h-9" 
          placeholder="Search or start new chat" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
