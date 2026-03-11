"use server"

import { redirect } from "next/navigation"
import { getUserPlayerWithAlliance, UserPlayerWithAlliance } from "@/lib/auth-helpers"
import { Permission } from "@/lib/permissions"

export async function ensureAdmin(requiredPermission?: Permission): Promise<UserPlayerWithAlliance> {
  const user = await getUserPlayerWithAlliance()
  
  if (!user) {
    redirect("/")
  }

  // Bot admins have access to everything
  if (user.isBotAdmin) {
    return user;
  }

  // If a specific permission is required, check if the user has it
  if (requiredPermission && user.permissions?.includes(requiredPermission)) {
    return user;
  }

  // If no specific permission is required but they have SOME permissions, let them through the base layout
  if (!requiredPermission && user.permissions && user.permissions.length > 0) {
    return user;
  }

  // Otherwise, deny access
  redirect("/")
}
