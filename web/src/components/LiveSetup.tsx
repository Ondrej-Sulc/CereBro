import React from "react";
import Link from "next/link";
import { Bot, MessageSquare, UserPlus, Link2, Shield, TerminalSquare } from "lucide-react";
import { DISCORD_INVITE } from "@/lib/links";

const steps = [
  {
    id: "01",
    title: "Join the Community",
    subtitle: "Start here if you are new",
    icon: MessageSquare,
    accent: "sky",
    description:
      "Join the CereBro Discord server first. You can ask setup questions, see updates, and avoid common mistakes.",
    chips: ["Community support", "Setup help", "Announcements"],
    ctaLabel: "Join Community Discord",
    ctaHref: DISCORD_INVITE,
    external: true,
  },
  {
    id: "02",
    title: "Start from Discord or Website",
    subtitle: "Two valid officer paths",
    icon: UserPlus,
    accent: "indigo",
    description:
      "Preferred flow: invite CereBro to your Discord server and the alliance is created automatically. Website onboarding is also available for create/join requests.",
    chips: ["Invite bot (auto-create)", "Website onboarding", "Join requests"],
    ctaLabel: "Open Alliance Onboarding",
    ctaHref: "/alliance/onboarding",
  },
  {
    id: "03",
    title: "Link Server (Only If Needed)",
    subtitle: "Website-first alliance fallback",
    icon: Link2,
    accent: "violet",
    description:
      "Only needed when an alliance was created on the website before Discord setup. Generate a link code in Alliance settings, then run the link command in Discord.",
    chips: ["Website-first alliance", "Generate link code", "/alliance link code:XXXX"],
    ctaLabel: "View Linking Guide",
    ctaHref: "/alliance",
  },
  {
    id: "04",
    title: "Complete Member Setup",
    subtitle: "Actual member onboarding",
    icon: TerminalSquare,
    accent: "emerald",
    description:
      "Members are added through Discord role sync or by requesting to join an alliance on the website. Officers review and accept requests.",
    chips: ["Discord role sync", "Website join request", "Officer approval"],
    ctaLabel: "Browse Commands",
    ctaHref: "/commands",
  },
];

const accentStyles: Record<string, { card: string; icon: string; step: string; chip: string; cta: string }> = {
  sky: {
    card: "hover:border-sky-500/40 hover:shadow-sky-500/15",
    icon: "bg-sky-500/10 text-sky-400",
    step: "text-sky-400 border-sky-500/30",
    chip: "border-sky-900/50 text-sky-200/90",
    cta: "hover:border-sky-500/50 hover:text-sky-100",
  },
  indigo: {
    card: "hover:border-indigo-500/40 hover:shadow-indigo-500/15",
    icon: "bg-indigo-500/10 text-indigo-400",
    step: "text-indigo-400 border-indigo-500/30",
    chip: "border-indigo-900/50 text-indigo-200/90",
    cta: "hover:border-indigo-500/50 hover:text-indigo-100",
  },
  violet: {
    card: "hover:border-violet-500/40 hover:shadow-violet-500/15",
    icon: "bg-violet-500/10 text-violet-400",
    step: "text-violet-400 border-violet-500/30",
    chip: "border-violet-900/50 text-violet-200/90",
    cta: "hover:border-violet-500/50 hover:text-violet-100",
  },
  emerald: {
    card: "hover:border-emerald-500/40 hover:shadow-emerald-500/15",
    icon: "bg-emerald-500/10 text-emerald-400",
    step: "text-emerald-400 border-emerald-500/30",
    chip: "border-emerald-900/50 text-emerald-200/90",
    cta: "hover:border-emerald-500/50 hover:text-emerald-100",
  },
};

export const LiveSetup = () => {
  return (
    <div className="relative">
      <div className="hidden xl:block absolute top-11 left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent -z-10" />

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
        {steps.map((step) => {
          const accent = accentStyles[step.accent];
          const Icon = step.icon;

          return (
            <div key={step.id} className="h-full">
              <div
                className={`flex flex-col group relative h-full rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-slate-900/50 p-5 transition-all duration-200 shadow-lg shadow-black/10 ${accent.card}`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full border bg-slate-950/80 text-[11px] font-bold flex items-center justify-center uppercase tracking-wide ${accent.step}`}
                    >
                      {step.id}
                    </div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Step</p>
                  </div>
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${accent.icon}`}
                  >
                    <Icon size={18} />
                  </div>
                </div>

                <h3 className="text-base font-bold text-white leading-tight mb-1">{step.title}</h3>
                <p className="text-xs text-slate-400 mb-3">{step.subtitle}</p>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">{step.description}</p>

                <div className="flex flex-wrap gap-2 mb-5">
                  {step.chips.map((chip) => (
                    <span
                      key={chip}
                      className={`text-[10px] font-mono px-2 py-1 rounded-md border bg-slate-950/80 ${accent.chip}`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="mt-auto">
                  <Link
                    href={step.ctaHref}
                    target={step.external ? "_blank" : undefined}
                    rel={step.external ? "noopener noreferrer" : undefined}
                    className={`w-full inline-flex items-center justify-center gap-2 bg-slate-950/80 hover:bg-slate-900 text-slate-200 text-xs font-semibold py-2.5 rounded-lg border border-slate-700/80 transition-colors ${accent.cta}`}
                    aria-label={step.external ? `${step.ctaLabel} (opens in a new tab)` : step.ctaLabel}
                  >
                    {step.external ? <MessageSquare size={13} /> : <Bot size={13} />}
                    {step.ctaLabel}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-2 text-xs text-slate-400">
        <Shield className="w-4 h-4 mt-0.5 text-sky-400/90 shrink-0" />
        <p>
          Officer flow and member flow are different. Members join through role sync or website requests;
          server linking is only for website-first alliances, while channel configuration remains an officer task.
        </p>
      </div>
    </div>
  );
};