import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AllianceManagementClient } from "./client-page";
import { Metadata } from "next";
import logger from "@/lib/logger";
import { getAllianceScreenshotUnlockStatus, listSupporterPlayerIds } from "@/lib/support-status";

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

    logger.info({ userId: player.id, allianceId: player.allianceId }, "User accessing Alliance Management page");

    const [members, alliance, screenshotUnlock] = await Promise.all([
        prisma.player.findMany({
            where: { allianceId: player.allianceId },
            orderBy: { ingameName: 'asc' },
            include: {
                _count: {
                    select: { roster: true }
                }
            }
        }),
        prisma.alliance.findUnique({
            where: { id: player.allianceId },
            select: {
                id: true,
                name: true,
                tag: true,
                description: true,
                inviteOnly: true,
                guildId: true,
                battlegroup1Color: true,
                battlegroup2Color: true,
                battlegroup3Color: true,
                playerColorPalette: true,
                linkCode: true,
                linkCodeExpires: true,
                removeMissingMembers: true,
                membershipRequests: {
                    include: {
                        player: true
                    }
                }
            }
        }),
        getAllianceScreenshotUnlockStatus(player.allianceId),
    ]);

    if (!alliance) return null;

    const supporterPlayerIds = await listSupporterPlayerIds(members);
    const membersWithSupportStatus = members.map((member) => ({
        ...member,
        isSupporter: supporterPlayerIds.has(member.id),
    }));

    return (
        <AllianceManagementClient 
            members={membersWithSupportStatus}
            currentUser={player}
            alliance={{ ...alliance, screenshotUnlock }}
        />
    );
}
