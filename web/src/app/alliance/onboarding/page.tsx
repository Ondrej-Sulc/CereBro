import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AllianceOnboardingClient } from "./client-page";
import { signIn } from "@/auth";

export default async function AllianceOnboardingPage() {
    const player = await getUserPlayerWithAlliance();
    
    if (!player) {
        await signIn("discord", { redirectTo: "/alliance/onboarding" });
        return null;
    }

    if (player.allianceId) {
        redirect("/alliance");
    }

    // Fetch pending invitations for the player
    const invitations = await prisma.allianceMembershipRequest.findMany({
        where: {
            playerId: player.id,
            type: 'INVITE',
            status: 'PENDING'
        },
        include: {
            alliance: true,
            inviter: true
        }
    });

    // Fetch existing requests from the player
    const sentRequests = await prisma.allianceMembershipRequest.findMany({
        where: {
            playerId: player.id,
            type: 'REQUEST',
            status: 'PENDING'
        },
        include: {
            alliance: true
        }
    });

    return (
        <AllianceOnboardingClient 
            invitations={invitations}
            sentRequests={sentRequests}
        />
    );
}
