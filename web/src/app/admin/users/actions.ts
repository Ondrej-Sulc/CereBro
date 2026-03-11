"use server"

import { prisma } from "@/lib/prisma"
import { ensureAdmin } from "../actions"
import { revalidatePath } from "next/cache"
import logger from "@/lib/logger"

export async function updateBotUserPermissions(botUserId: string, data: { permissions: string[], isBotAdmin: boolean }) {
  // CRITICAL: Only actual BotAdmins should be able to manage permissions
  const session = await ensureAdmin();
  if (!session.user.isBotAdmin) {
    logger.warn({ botUserId, actor: session.user.id }, "Unauthorized attempt to update permissions");
    return { success: false, error: "Only Full Admins can manage permissions" };
  }

  try {
    await prisma.botUser.update({
      where: { id: botUserId },
      data: { 
        permissions: data.permissions,
        isBotAdmin: data.isBotAdmin
      }
    })

    revalidatePath("/admin/users")
    return { success: true }
  } catch (error) {
    logger.error({ error, botUserId }, "Failed to update user permissions")
    return { success: false, error: "Failed to update permissions" }
  }
}
