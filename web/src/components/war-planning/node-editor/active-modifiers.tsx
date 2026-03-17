import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { NodeModifier } from "@prisma/client";

interface ActiveModifiersProps {
  modifiers: NodeModifier[];
}

export function ActiveModifiers({ modifiers }: ActiveModifiersProps) {
  if (modifiers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <TooltipProvider delayDuration={300}>
        {modifiers.map((mod) => (
          <Tooltip key={mod.id}>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="cursor-help border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {mod.name}
              </Badge>
            </TooltipTrigger>
            <TooltipContent 
              side="bottom" 
              className="max-w-[300px] bg-slate-950 border-slate-800 p-3 shadow-xl"
            >
              <div className="font-bold text-slate-200 mb-1">{mod.name}</div>
              <div className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">
                {mod.description}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  );
}
