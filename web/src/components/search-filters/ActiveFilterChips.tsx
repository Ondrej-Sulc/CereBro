import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface FilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

interface ActiveFilterChipsProps {
  activeFilters: FilterChip[];
}

export function ActiveFilterChips({ activeFilters }: ActiveFilterChipsProps) {
  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-1">
      {activeFilters.map((filter) => (
        <Badge
          key={filter.id}
          variant="secondary"
          className="bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-900/50 pl-2 pr-1 py-1 gap-1 text-cyan-200 font-normal transition-colors"
        >
          {filter.label}
          <button
            type="button"
            onClick={filter.onRemove}
            className="p-0.5 rounded-full hover:bg-cyan-800 hover:text-white cursor-pointer"
            aria-label="Remove filter"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
