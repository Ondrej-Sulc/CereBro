import { NodeModifierIcon } from "@/components/nodes/NodeModifierIcon";
import { badgeVariants } from "@/components/ui/badge";
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
          <PopoverTrigger className={badgeVariants({ variant: "outline", className: "gap-1.5 cursor-pointer border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800 transition-colors focus:ring-1 focus:ring-sky-500/50" })}>
              <NodeModifierIcon iconKey={mod.iconKey} size={14} />{mod.name}
          </PopoverTrigger>
          <PopoverContent 
            side="bottom" 
            className="w-80 bg-slate-950 border-slate-800 p-3 shadow-xl z-[100]"
          >
            <div className="flex items-center gap-2 font-bold text-slate-200 mb-1"><NodeModifierIcon iconKey={mod.iconKey} size={14} />{mod.name}</div>
            <div className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">
              {mod.description}
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
