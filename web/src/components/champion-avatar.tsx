import { memo } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getChampionImageUrl, getStarBorderClass } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { ChampionImages } from "@/types/champion";
import { ChampionClass } from "@prisma/client";

interface ChampionAvatarProps {
    name: string;
    images: ChampionImages;
    championClass?: ChampionClass;
    stars?: number;
    rank?: number;
    isAwakened?: boolean;
    sigLevel?: number;
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    showStars?: boolean;
    showRank?: boolean;
    isSelected?: boolean;
    isRecommended?: boolean;
}

export const ChampionAvatar = memo(({
    name,
    images,
    championClass,
    stars,
    rank,
    isAwakened,
    sigLevel,
    size = "md",
    className,
    showStars = true,
    showRank = true,
    isSelected = false,
    isRecommended = false,
}: ChampionAvatarProps) => {
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-[4.5rem] w-[4.5rem]",
        xl: "h-20 w-20",
    };

    const borderClass = stars ? getStarBorderClass(stars) : "border-slate-800";
    const classColors = championClass ? getChampionClassColors(championClass) : null;
    const bgClass = classColors ? classColors.bg : "bg-slate-900";

    return (
        <div className={cn(
            "rounded-md overflow-hidden relative border shadow-sm shrink-0",
            bgClass,
            sizeClasses[size],
            isSelected ? "border-sky-500 shadow-[0_0_12px_rgba(14,165,233,0.6)]" :
                isRecommended ? "border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" :
                    borderClass,
            className
        )}>
            {/* Star Level Badge */}
            {showStars && stars && (
                <div className="absolute top-0.5 left-0.5 z-20">
                    <Badge className={cn(
                        "px-1 py-0 h-4 text-[9px] font-black border-none bg-black/80",
                        stars === 7 ? "text-purple-400" : stars === 6 ? "text-sky-400" : "text-yellow-500"
                    )}>
                        {stars}★
                    </Badge>
                </div>
            )}

            {/* Rank Overlay */}
            {showRank && typeof rank === 'number' && (
                <div className="absolute bottom-0 pt-2 pb-0.5 bg-gradient-to-t from-black/90 via-black/60 to-transparent w-full text-center z-20">
                    <span className="text-[9px] font-bold text-slate-200 drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                        R{rank}{isAwakened ? ` S${sigLevel || 0}` : ""}
                    </span>
                </div>
            )}

            <Image
                src={getChampionImageUrl(images, "128")}
                alt={name}
                fill
                sizes={{ sm: '32px', md: '40px', lg: '72px', xl: '80px' }[size]}
                className="object-cover z-10"
            />

            {isSelected && (
                <div className="absolute inset-0 bg-sky-500/20 flex items-center justify-center z-30 backdrop-blur-[1px]">
                    <div className="bg-sky-600 rounded-full p-0.5">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white w-3 h-3 md:w-4 md:h-4"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                </div>
            )}
        </div>
    );
});

ChampionAvatar.displayName = "ChampionAvatar";
