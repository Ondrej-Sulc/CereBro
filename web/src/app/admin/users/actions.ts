"use server"

import { prisma } from "@/lib/prisma"
import { ensureAdmin } from "../actions"
import { revalidatePath } from "next/cache"
import logger from "@/lib/logger"
import { AVAILABLE_PERMISSIONS, Permission } from "@/lib/permissions"

export async function updateBotUserPermissions(botUserId: string, data: { permissions: string[], isBotAdmin: boolean }) {
  const user = await ensureAdmin("MANAGE_USERS");

  // Only actual BotAdmins can grant or revoke BotAdmin status
  if (data.isBotAdmin !== undefined && !user.isBotAdmin) {
    // If they are trying to change isBotAdmin status but aren't a global admin
    const targetUser = await prisma.botUser.findUnique({ where: { id: botUserId } });
    if (targetUser && targetUser.isBotAdmin !== data.isBotAdmin) {
      logger.warn({ botUserId, actor: user.id }, "Unauthorized attempt to modify BotAdmin status");
      return { success: false, error: "Only Full Admins can modify Full Admin status" };
    }
  }

  // Filter permissions against the canonical set and cast
  const validPermissionIds = new Set(AVAILABLE_PERMISSIONS.map(p => p.id));
  const filteredPermissions = data.permissions.filter(p => validPermissionIds.has(p as Permission)) as Permission[];

  try {
    await prisma.botUser.update({
      where: { id: botUserId },
      data: { 
        permissions: filteredPermissions,
        ...(user.isBotAdmin ? { isBotAdmin: data.isBotAdmin } : {}) // Only apply isBotAdmin if they have permission
      }
    })

    revalidatePath("/admin/users")
    return { success: true }
  } catch (error) {
    logger.error({ error, botUserId }, "Failed to update user permissions")
    return { success: false, error: "Failed to update permissions" }
  }
}
