import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NodeModifier } from "@prisma/client";

interface ActiveModifiersProps {
  modifiers: NodeModifier[];
}

export function ActiveModifiers({ modifiers }: ActiveModifiersProps) {
  if (modifiers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {modifiers.map((mod) => (
        <Popover key={mod.id}>
          <PopoverTrigger asChild>
            <Badge 
              variant="outline" 
              tabIndex={0}
              className="cursor-pointer border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800 transition-colors focus:ring-1 focus:ring-sky-500/50"
            >
              {mod.name}
            </Badge>
          </PopoverTrigger>
          <PopoverContent 
            side="bottom" 
            className="w-80 bg-slate-950 border-slate-800 p-3 shadow-xl z-[100]"
          >
            <div className="font-bold text-slate-200 mb-1">{mod.name}</div>
            <div className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">
              {mod.description}
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
