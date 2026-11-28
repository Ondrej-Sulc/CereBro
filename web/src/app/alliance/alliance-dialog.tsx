"use client";

import type { ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const allianceDialogTabsClass = "grid h-auto w-full shrink-0 auto-cols-fr grid-flow-col gap-1 rounded-none border-b border-slate-800 bg-slate-950/30 px-3 py-2 sm:px-6";
export const allianceDialogTabClass = "min-h-10 min-w-0 gap-1.5 rounded-lg px-1.5 text-xs text-slate-300 data-[state=active]:bg-indigo-400/15 data-[state=active]:text-indigo-100 sm:gap-2 sm:px-3 sm:text-sm";

export function AllianceDialogContent({ title, description, icon: Icon, children }: {
    title: string;
    description: string;
    icon: LucideIcon;
    children: ReactNode;
}) {
    return (
        <DialogContent className="flex max-h-[calc(100dvh-1.25rem)] w-[calc(100%-1.25rem)] max-w-[40rem] flex-col gap-0 overflow-hidden rounded-2xl border-slate-700 bg-[#0b1221] p-0 text-slate-100 shadow-2xl shadow-black/50 sm:rounded-2xl">
            <DialogHeader className="flex shrink-0 flex-row items-start gap-3 space-y-0 border-b border-indigo-400/15 bg-gradient-to-br from-indigo-500/15 to-transparent px-4 py-4 text-left sm:px-6 sm:py-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 text-indigo-200">
                    <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <DialogTitle className="text-lg font-semibold leading-snug sm:text-xl">{title}</DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm text-slate-400">{description}</DialogDescription>
                </div>
                <DialogClose asChild>
                    <Button type="button" variant="ghost" size="icon" aria-label={"Close " + title.toLowerCase()} className="-mr-1 -mt-1 size-9 shrink-0 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
                        <X aria-hidden="true" />
                    </Button>
                </DialogClose>
            </DialogHeader>
            {children}
        </DialogContent>
    );
}
