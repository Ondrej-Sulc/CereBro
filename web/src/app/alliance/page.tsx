import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AllianceManagementClient } from "./client-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alliance Management - CereBro",
  description: "Manage your alliance roster and battlegroups.",
};

export default async function AlliancePage() {
    const player = await getUserPlayerWithAlliance();
    
    // Redirect if not logged in or not in an alliance
    if (!player || !player.allianceId) {
        redirect("/");
    }

    const members = await prisma.player.findMany({
        where: { allianceId: player.allianceId },
        orderBy: { ingameName: 'asc' },
        include: {
            roster: {
                orderBy: { rank: 'desc' }, // Assuming calculated prestige or similar logic exists, or just grab top stars
                take: 1
            }
        }
    });

    const alliance = await prisma.alliance.findUnique({
        where: { id: player.allianceId }
    });

    return (
        <AllianceManagementClient 
            members={members} 
            currentUser={player}
            allianceName={alliance?.name || "Alliance"}
        />
    );
}
