import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export const profilePrimaryActionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";
export const profileActionClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950/45 px-3.5 text-sm font-medium text-slate-200 transition-colors hover:border-indigo-400/40 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300";

export function PlayerProfileHeader({ name, avatar, label, details, actions, children }: {
    name: string;
    avatar?: string | null;
    label: string;
    details?: ReactNode;
    actions?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <header className="overflow-hidden rounded-2xl border border-indigo-400/20 bg-[#0b1221] shadow-xl shadow-black/15 sm:rounded-3xl">
            <div className="relative isolate flex flex-col gap-4 overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_0%_0%,rgba(99,102,241,0.26),transparent_70%)]" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-2/3 bg-[repeating-linear-gradient(135deg,transparent_0_21px,rgba(129,140,248,0.08)_21px_22px)] [mask-image:linear-gradient(to_left,black,transparent)]" />
                <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                    <Avatar className="size-14 shrink-0 rounded-xl border border-indigo-300/30 bg-indigo-400/10 text-indigo-100 shadow-lg sm:size-[4.5rem] sm:rounded-2xl">
                        <AvatarImage src={avatar || undefined} alt="" />
                        <AvatarFallback className="rounded-xl bg-indigo-400/15 text-lg font-semibold sm:rounded-2xl sm:text-2xl">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-200">{label}</p>
                        <h1 className="mt-0.5 break-words text-[1.65rem] font-bold leading-tight tracking-tight text-white sm:text-4xl">{name}</h1>
                        {details && <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-300 sm:text-sm">{details}</div>}
                    </div>
                </div>
                {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
            </div>
            {children}
        </header>
    );
}

export function PlayerProfileMetric({ label, value, description, className }: {
    label: string;
    value: ReactNode;
    description?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("min-w-0 bg-[#0a1120] px-3 py-3 sm:px-5 sm:py-4", className)}>
            <dt className="text-xs font-medium text-slate-300">{label}</dt>
            <dd className="mt-1 text-xl font-semibold leading-none tracking-tight text-slate-100 tabular-nums sm:text-2xl">{value}</dd>
            {description && <dd className="mt-1.5 text-xs leading-snug text-slate-400">{description}</dd>}
        </div>
    );
}

export function PlayerProfileSectionHeading({ title, id, action, detail }: {
    title: string;
    id?: string;
    action?: ReactNode;
    detail?: ReactNode;
}) {
    return (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <h2 id={id} className="scroll-mt-24 text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>
                {detail && <span className="text-xs text-slate-400">{detail}</span>}
            </div>
            {action}
        </div>
    );
}
