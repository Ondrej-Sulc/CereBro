"use server"

import { prisma } from "@/lib/prisma"
import { ensureAdmin } from "../actions"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function joinAllianceAsAdmin(allianceId: string) {
    if (!allianceId || typeof allianceId !== "string") {
        throw new Error("Invalid alliance ID")
    }

    const user = await ensureAdmin("MANAGE_ALLIANCES")
    
    await prisma.$transaction(async (tx) => {
        // 1. Update the player's alliance
        await tx.player.update({
            where: { id: user.id },
            data: {
                allianceId: allianceId,
                isActive: true,
                // Ensure they are not an officer by default when joining as admin
                // unless they want to be. For investigation, being a member is safer.
            }
        })

        // 2. Set this profile as the active profile for the BotUser
        if (user.botUserId) {
            await tx.botUser.update({
                where: { id: user.botUserId },
                data: { activeProfileId: user.id }
            })
        }
    })

    revalidatePath("/")
    revalidatePath("/alliance")
    redirect("/alliance/roster")
}
