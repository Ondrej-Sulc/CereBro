"use server"

import { prisma } from "@/lib/prisma"
import { ensureAdmin } from "../actions"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { withActionContext } from "@/lib/with-request-context"
import { changePlayerAlliance } from "@cerebro/core/services/allianceMembershipService"
import { clearCache } from "@/lib/cache"

export const joinAllianceAsAdmin = withActionContext('joinAllianceAsAdmin', async (allianceId: string) => {
    if (!allianceId || typeof allianceId !== "string") {
        throw new Error("Invalid alliance ID")
    }

    const user = await ensureAdmin("MANAGE_ALLIANCES")
    
    await prisma.$transaction(async (tx) => {
        // Changing alliances also releases the former alliance's defense slots and roles.
        await changePlayerAlliance(tx, user.id, user.allianceId, allianceId, { isActive: true })

        // 2. Set this profile as the active profile for the BotUser
        if (user.botUserId) {
            await tx.botUser.update({
                where: { id: user.botUserId },
                data: { activeProfileId: user.id }
            })
        }
    })

    if (user.allianceId) clearCache(`alliance-members-${user.allianceId}`)
    clearCache(`alliance-members-${allianceId}`)
    revalidatePath('/planning', 'layout')
    revalidatePath("/")
    revalidatePath("/alliance")
    redirect("/alliance/roster")
});
