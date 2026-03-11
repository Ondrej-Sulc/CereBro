"use server"

import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function ensureAdmin(requiredPermission?: string) {
  const session = await auth()
  
  if (!session?.user) {
    redirect("/")
  }

  const { isBotAdmin, permissions } = session.user as any; // Cast to access custom properties
  
  // Bot admins have access to everything
  if (isBotAdmin) {
    return session;
  }

  // If a specific permission is required, check if the user has it
  if (requiredPermission && permissions?.includes(requiredPermission)) {
    return session;
  }

  // If no specific permission is required but they have SOME permissions, let them through the base layout
  if (!requiredPermission && permissions && permissions.length > 0) {
    return session;
  }

  // Otherwise, deny access
  redirect("/")
}
