import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getQuestPlanById, getEncounterPopularCounters, getEncounterFeaturedPicks, getEncounterAlliancePicks } from "@/app/actions/quests";
import type { PopularCountersMap, EnhancedCountersMap } from "@/app/actions/quests";
import QuestTimelineClient from "@/components/planning/quest-timeline-client";
import { QuestWithRelations, RosterWithChampion, toChampionImages, SynergyWithChampion } from "@/components/planning/types";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit3, Youtube, ArrowLeft, Users } from "lucide-react";
import { QuestPlanStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { ChampionImages } from "@/types/champion";
import { cache } from "react";
import { isUserBotAdmin } from "@/lib/auth-helpers";

function PlayerCount({ count, className, iconOnly = false }: { count: number; className?: string; iconOnly?: boolean }) {
    if (count <= 0) return null;
    return (
        <div className={cn("flex items-center gap-1.5", className)}>
            <Users className="w-3.5 h-3.5 text-sky-500/70" />
            {!iconOnly && <span>{count} {count === 1 ? 'Player' : 'Players'} Used</span>}
            {iconOnly && <span className="font-black">{count}</span>}
        </div>
    );
}

const getQuestPlan = cache(async (id: string) => getQuestPlanById(id));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const quest = await getQuestPlan(id);

  if (!quest) {
    return {
      title: "Quest Plan Details - CereBro",
      description:
        "Build your quest plan, review requirements, and pick counters for each encounter.",
    };
  }

  const isBotAdmin = await isUserBotAdmin();

  if (quest.status !== QuestPlanStatus.VISIBLE && !isBotAdmin) {
    return {
      title: "Quest Plan Details - CereBro",
      description:
        "Build your quest plan, review requirements, and pick counters for each encounter.",
    };
  }

  return {
    title: `${quest.title} - Quest Planner - CereBro`,
    description: quest.category?.name
      ? `Build your ${quest.category.name} quest plan, review requirements, and pick counters for each encounter.`
      : "Build your quest plan, review requirements, and pick counters for each encounter.",
  };
}

export default async function QuestTimelinePage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) {
        redirect("/api/auth/discord-login?redirectTo=/planning/quests");
    }

    const { id } = await params;

    // We need the Player ID, which means looking up the account
    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" }
    });

    if (!account?.providerAccountId) {
        return <p>Error: No linked Discord account found.</p>;
    }

    // Find the primary Player profile for this BotUser
    const botUser = await prisma.botUser.findUnique({
        where: { discordId: account.providerAccountId },
        include: {
            profiles: true
        }
    });

    // Try to find by isActive flag, fallback to activeProfileId, fallback to first profile
    const activePlayer = 
        botUser?.profiles.find(p => p.isActive) || 
        botUser?.profiles.find(p => p.id === botUser.activeProfileId) || 
        botUser?.profiles[0];

    if (!activePlayer) {
        return <p>Please create a player profile first.</p>;
    }

    // Fetch the Quest (now enriched with creators)
    const quest = await getQuestPlan(id);
    if (!quest) return <p>Quest not found</p>;

    // Visibility check
    const isAdmin = await isUserBotAdmin();
    if (quest.status !== QuestPlanStatus.VISIBLE && !isAdmin) {
        return <div className="p-8 text-center text-slate-400 italic">This quest plan is currently hidden or archived.</div>;
    }

    // Fetch the user's saved plan for this quest
    const playerPlan = await prisma.playerQuestPlan.findUnique({
        where: {
            playerId_questPlanId: {
                playerId: activePlayer.id,
                questPlanId: id
            }
        },
        include: {
            encounters: true,
            synergyChampions: {
                include: {
                    champion: {
                        include: {
                            tags: true,
                            abilities: {
                                include: {
                                    ability: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // Fetch the user's roster with tags and abilities
    // Fetch filter metadata in parallel
    const [rosterEntries, tags, abilityCategories, abilityLinks, immunityLinks, popularCounters, featuredPicks, alliancePicks] = await Promise.all([
        prisma.roster.findMany({
            where: { playerId: activePlayer.id },
            include: {
                champion: {
                    include: {
                        tags: true,
                        abilities: {
                            include: {
                                ability: {
                                    include: {
                                        categories: { select: { name: true } }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: [
                { stars: 'desc' },
                { rank: 'desc' },
                { powerRating: 'desc' },
                { champion: { name: 'asc' } }
            ]
        }),
        prisma.tag.findMany({ orderBy: { name: 'asc' } }),
        prisma.abilityCategory.findMany({ orderBy: { name: 'asc' } }),
        prisma.championAbilityLink.findMany({ where: { type: 'ABILITY' }, select: { abilityId: true }, distinct: ['abilityId'] }),
        prisma.championAbilityLink.findMany({ where: { type: 'IMMUNITY' }, select: { abilityId: true }, distinct: ['abilityId'] }),
        getEncounterPopularCounters(id),
        getEncounterFeaturedPicks(id),
        activePlayer.allianceId
            ? getEncounterAlliancePicks(id, activePlayer.allianceId, activePlayer.id)
            : Promise.resolve<EnhancedCountersMap>({})
    ]);

    const [abilities, immunities] = await Promise.all([
        prisma.ability.findMany({ where: { id: { in: abilityLinks.map(l => l.abilityId) } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
        prisma.ability.findMany({ where: { id: { in: immunityLinks.map(l => l.abilityId) } }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
    ]);

    // Map roster entries to typed objects, ensuring JsonValue fields are cast correctly
    const roster: RosterWithChampion[] = rosterEntries.map(entry => ({
        ...entry,
        champion: {
            ...entry.champion,
            images: entry.champion.images as unknown as ChampionImages,
            tags: entry.champion.tags,
            abilities: entry.champion.abilities.map(link => ({
                ...link,
                ability: {
                    id: link.ability.id,
                    name: link.ability.name,
                    categories: link.ability.categories
                }
            }))
        }
    }));

    interface QuestCreator {
        id: string;
        discordId: string;
        name: string;
        image: string | null;
    }

    const creatorsWithUsers = (quest.creators || []) as QuestCreator[];
    const bannerUrl = quest.bannerUrl ? quest.bannerUrl.replace(/#/g, '%23') : null;

    // Map synergy champions to the correct type
    const savedSynergies: SynergyWithChampion[] = (playerPlan?.synergyChampions || []).map(s => ({
        ...s,
        champion: {
            ...s.champion,
            images: s.champion.images as unknown as ChampionImages,
            tags: s.champion.tags,
            abilities: s.champion.abilities.map(link => ({
                ...link,
                ability: {
                    id: link.ability.id,
                    name: link.ability.name,
                    categories: [] // Categories not needed for display here
                }
            }))
        }
    }));

    return (
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
            <Link href="/planning/quests" className="inline-flex items-center gap-2 text-slate-400 hover:text-sky-400 mb-6 transition-colors group">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs font-black uppercase tracking-[0.2em]">Back to Quest Plans</span>
            </Link>

            {bannerUrl && (
                <div className="relative w-full aspect-[21/9] md:aspect-[25/7] mb-8 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
                    <Image
                        src={bannerUrl}
                        alt={quest.title}
                        fill
                        priority
                        className={cn(
                            quest.bannerFit === "contain" ? "object-contain" : "object-cover",
                            quest.bannerPosition === "top" ? "object-top" : quest.bannerPosition === "bottom" ? "object-bottom" : "object-center"
                        )}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none" />

                    <div className="absolute bottom-6 left-8 right-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="relative z-10">
                            {creatorsWithUsers.length > 0 && (
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="flex -space-x-2">
                                        {creatorsWithUsers.map(c => (
                                            <div key={c.id} className="relative w-6 h-6 rounded-full border border-slate-950 overflow-hidden shadow-sm">
                                                {c.image ? (
                                                    <Image src={c.image} alt={c.name} fill className="object-cover" />
                                                ) : (
                                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-white">
                                                        {c.name?.trim() ? c.name.trim().charAt(0) : '?'}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-xs font-medium text-slate-300 drop-shadow-md">
                                        By {creatorsWithUsers.map(c => c.name).join(", ")}
                                        {quest._count && quest._count.playerPlans > 0 && ` • ${quest._count.playerPlans} ${quest._count.playerPlans === 1 ? 'Player' : 'Players'} Used`}
                                    </span>
                                </div>
                            )}
                            <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl uppercase tracking-tight">{quest.title}</h1>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {quest.category && (
                                    <Badge className="bg-sky-600 text-white border-none text-xs font-bold uppercase tracking-widest px-3 py-1 shadow-lg">
                                        {quest.category.name}
                                    </Badge>
                                )}
                                {(quest.minStarLevel || quest.maxStarLevel) && (
                                    <Badge className="bg-amber-600 text-white border-none text-xs font-bold uppercase tracking-widest px-3 py-1 shadow-lg">
                                        {quest.minStarLevel && quest.maxStarLevel ? `${quest.minStarLevel}-${quest.maxStarLevel}★` : quest.minStarLevel ? `${quest.minStarLevel}★+` : `Up to ${quest.maxStarLevel}★`}
                                    </Badge>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap md:justify-end gap-2">
                            {quest.videoUrl && (
                                <a href={quest.videoUrl} target="_blank" rel="noopener noreferrer">
                                    <Button className="bg-red-600 hover:bg-red-500 text-white border-none text-[10px] font-black uppercase tracking-widest px-4 py-1.5 h-auto shadow-xl shadow-red-900/40 transition-all active:scale-95">
                                        <Youtube className="w-4 h-4 mr-2" /> Watch Guide
                                    </Button>
                                </a>
                            )}
                            {quest.requiredClasses?.map((cls) => (
                                <div key={cls} className="bg-black/60 backdrop-blur-md border border-white/20 rounded-lg px-2.5 py-1.5 flex items-center gap-2 shadow-2xl">
                                    <div className="relative w-4 h-4">
                                        <Image src={`/assets/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`} alt={cls} fill className="object-contain" />
                                    </div>
                                    <span className="text-[10px] font-black text-white uppercase tracking-tighter leading-none">{cls}</span>
                                </div>
                            ))}
                            {quest.requiredTags?.map((tag) => (
                                <Badge key={tag.id} variant="outline" className="bg-white/10 text-white border-white/20 text-[10px] uppercase font-black px-3 py-1 backdrop-blur-md shadow-2xl">
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {!quest.bannerUrl && (
                <div className="mb-8 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-indigo-500">{quest.title}</h1>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                                {quest.category && <p className="text-slate-400 font-medium">{quest.category.name}</p>}
                                <PlayerCount count={quest._count?.playerPlans || 0} className="text-slate-500 text-sm font-medium" />
                                {quest.videoUrl && (
                                    <a href={quest.videoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-red-400 hover:text-red-300 transition-colors text-sm font-bold uppercase tracking-wider">
                                        <Youtube className="w-4 h-4" /> Watch Guide
                                    </a>
                                )}
                            </div>
                        </div>
                        {isAdmin && botUser?.isBotAdmin && (
                            <Link href={`/admin/quests/${quest.id}`}>
                                <Button variant="outline" className="shrink-0 border-sky-800 text-sky-400 hover:bg-sky-950/50 hover:text-sky-300">
                                    <Edit3 className="w-4 h-4 mr-2" /> Edit Plan
                                </Button>
                            </Link>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {(quest.minStarLevel || quest.maxStarLevel) && (
                            <Badge variant="outline" className="bg-amber-950/20 border-amber-800/50 text-amber-500 font-bold px-3 py-1">
                                {quest.minStarLevel && quest.maxStarLevel ? `${quest.minStarLevel}-${quest.maxStarLevel}★` : quest.minStarLevel ? `${quest.minStarLevel}★+` : `Up to ${quest.maxStarLevel}★`}
                            </Badge>
                        )}
                        {quest.requiredClasses?.map((cls) => (
                            <div key={cls} className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 flex items-center gap-2 shadow-sm">
                                <div className="relative w-4 h-4">
                                    <Image src={`/assets/icons/${cls.charAt(0).toUpperCase() + cls.slice(1).toLowerCase()}.png`} alt={cls} fill className="object-contain" />
                                </div>
                                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">{cls}</span>
                            </div>
                        ))}
                        {quest.requiredTags?.map((tag) => (
                            <Badge key={tag.id} variant="outline" className="bg-slate-900/50 text-slate-300 border-slate-800 text-[10px] uppercase font-bold px-3 py-1">
                                {tag.name}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}

            {quest.bannerUrl && isAdmin && botUser?.isBotAdmin && (
                <div className="fixed bottom-8 right-8 z-50">
                    <Link href={`/admin/quests/${quest.id}`}>
                        <Button className="bg-sky-600 hover:bg-sky-500 text-white shadow-xl shadow-sky-900/40 rounded-full h-12 px-6">
                            <Edit3 className="w-4 h-4 mr-2" /> Edit Plan
                        </Button>
                    </Link>
                </div>
            )}

            <QuestTimelineClient
                quest={quest}
                roster={roster}
                savedEncounters={playerPlan?.encounters || []}
                savedSynergies={savedSynergies}
                popularCounters={popularCounters}
                featuredPicks={featuredPicks}
                alliancePicks={alliancePicks}
                filterMetadata={{
                    tags,
                    abilityCategories,
                    abilities,
                    immunities
                }}
            />
        </div>
    );
}
