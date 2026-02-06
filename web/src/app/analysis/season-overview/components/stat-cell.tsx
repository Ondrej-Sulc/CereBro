import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skull } from "lucide-react";

interface StatCellProps {
  fights: number;
  deaths: number;
}

export function StatCell({ fights, deaths }: StatCellProps) {
  if (fights === 0) return <span className="text-slate-700 font-mono text-sm">-</span>;

  return (
    <div className="flex items-center justify-center gap-1.5">
        <span className={cn(
            "font-mono font-black text-sm",
            deaths === 0 ? "text-emerald-500/80" : "text-slate-400"
        )}>{fights}</span>
        {deaths > 0 && (
            <Badge variant="secondary" className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] px-1.5 h-4 leading-none font-black font-mono flex items-center gap-0.5">
                <Skull className="w-2.5 h-2.5" /> {deaths}
            </Badge>
        )}
    </div>
  );
}
