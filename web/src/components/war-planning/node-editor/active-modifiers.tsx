import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NodeModifier } from "@prisma/client";

interface ActiveModifiersProps {
  modifiers: NodeModifier[];
}

export function ActiveModifiers({ modifiers }: ActiveModifiersProps) {
  if (modifiers.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-sky-400 hover:text-sky-300 hover:bg-sky-400/10 -ml-1"
        >
          <Info className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 bg-slate-950 border-slate-800 p-4 shadow-xl shadow-black/50"
        align="start"
        side="bottom"
      >
        <h4 className="font-semibold mb-3 text-sm text-sky-400 flex items-center gap-2">
          <Info className="h-4 w-4" />
          Active Nodes
        </h4>
        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {modifiers.map((mod) => (
            <div
              key={mod.id}
              className="text-sm border-b border-slate-800/50 last:border-0 pb-3 last:pb-0"
            >
              <div className="font-bold text-slate-200 mb-1">{mod.name}</div>
              <div className="text-slate-400 text-xs leading-relaxed">
                {mod.description}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
