import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="px-3 py-3 border-b border-white/5 bg-[#111b21]">
      <div className="relative group">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-[#8696a0] group-focus-within:text-teal-500 transition-colors" />
        </div>
        <input 
          type="text"
          className="w-full pl-10 pr-4 py-2 bg-[#202c33] border-none rounded-xl text-[#e9edef] placeholder-[#8696a0] text-sm focus:ring-1 focus:ring-teal-500/50 outline-none transition-all" 
          placeholder="Search or start new chat" 
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
