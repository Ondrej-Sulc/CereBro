import { Info } from "lucide-react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface InfoPopoverProps {
    content: React.ReactNode;
    side?: "top" | "right" | "bottom" | "left";
    align?: "center" | "start" | "end";
    className?: string;
    iconClassName?: string;
}

export function InfoPopover({
    content,
    side = "top",
    align = "center",
    className,
    iconClassName
}: InfoPopoverProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    className={cn(
                        "text-slate-400 hover:text-white transition-colors focus:outline-none",
                        className
                    )}
                    type="button"
                >
                    <Info className={cn("h-4 w-4", iconClassName)} />
                    <span className="sr-only">More info</span>
                </button>
            </PopoverTrigger>
            <PopoverContent side={side} align={align} className="max-w-xs text-sm p-3">
                {content}
            </PopoverContent>
        </Popover>
    );
}
