import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { AlliancePublicClient } from "./client-page";
import { Metadata } from "next";

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

    const [allianceData, players] = await Promise.all([
        prisma.alliance.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
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
                avatar: true,
                battlegroup: true,
                isOfficer: true,
                championPrestige: true,
                _count: { select: { roster: true } },
            },
        }),
    ]);

    if (!allianceData) notFound();

    const alliance = { ...allianceData, players };

    return <AlliancePublicClient alliance={alliance} currentUser={currentUser} />;
}
