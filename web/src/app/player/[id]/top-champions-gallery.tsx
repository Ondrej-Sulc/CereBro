"use client";

import { useId, useState, type ReactNode } from "react";
import { profileActionClass } from "@/components/player-profile-ui";
import { cn } from "@/lib/utils";

const mobilePreviewCount = 6;

export function TopChampionsGallery({ count, children, className }: {
    count: number;
    children: ReactNode;
    className?: string;
}) {
    const listId = useId();
    const [expanded, setExpanded] = useState(false);

    return (
        <>
            <ul id={listId} aria-label="Top champion cards" className={cn(
                "grid grid-cols-3 gap-x-2.5 gap-y-3 sm:grid-cols-5 sm:gap-x-3 sm:gap-y-4",
                !expanded && count > mobilePreviewCount && "max-sm:[&>li:nth-child(n+7)]:hidden",
                className
            )}>
                {children}
            </ul>
            {count > mobilePreviewCount && (
                <button
                    type="button"
                    className={cn(profileActionClass, "mt-3 px-3 text-xs text-cyan-100 sm:hidden")}
                    aria-controls={listId}
                    aria-expanded={expanded}
                    onClick={() => setExpanded(value => !value)}
                >
                    {expanded ? "Show fewer champions" : `Show all ${count} champions`}
                </button>
            )}
        </>
    );
}
