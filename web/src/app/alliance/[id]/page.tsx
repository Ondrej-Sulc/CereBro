import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { AlliancePublicClient } from "./client-page";
import { Metadata } from "next";
import { getAllianceScreenshotUnlockStatus, listSupporterPlayerIds } from "@/lib/support-status";

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const alliance = await prisma.alliance.findUnique({
        where: { id },
        select: { name: true },
    });
    return {
        title: alliance ? `${alliance.name} - CereBro` : "Alliance - CereBro",
        description: alliance ? `View ${alliance.name}'s members and battlegroup overview.` : undefined,
    };
}

export default async function AlliancePublicPage({ params }: Props) {
    const currentUser = await getUserPlayerWithAlliance();
    if (!currentUser) redirect("/");

    const { id } = await params;

    const [allianceData, players, screenshotUnlock] = await Promise.all([
        prisma.alliance.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                tag: true,
                description: true,
                inviteOnly: true,
                battlegroup1Color: true,
                battlegroup2Color: true,
                battlegroup3Color: true,
            },
        }),
        prisma.player.findMany({
            where: { allianceId: id },
            orderBy: { ingameName: "asc" },
            select: {
                id: true,
                ingameName: true,
                discordId: true,
                botUserId: true,
                avatar: true,
                battlegroup: true,
                isOfficer: true,
                championPrestige: true,
                _count: { select: { roster: true } },
            },
        }),
        getAllianceScreenshotUnlockStatus(id),
    ]);

    if (!allianceData) notFound();

    const supporterPlayerIds = await listSupporterPlayerIds(players);
    const alliance = {
        ...allianceData,
        screenshotUnlock,
        players: players.map((player) => ({
            id: player.id,
            ingameName: player.ingameName,
            avatar: player.avatar,
            battlegroup: player.battlegroup,
            isOfficer: player.isOfficer,
            championPrestige: player.championPrestige,
            _count: player._count,
            isSupporter: supporterPlayerIds.has(player.id),
        })),
    };

    return <AlliancePublicClient alliance={alliance} currentUser={currentUser} />;
}
