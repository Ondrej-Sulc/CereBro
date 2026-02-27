"use server"

import { prisma } from "@/lib/prisma"
import { ensureAdmin } from "../actions"
import { revalidatePath } from "next/cache"

export async function cleanupEmptyAlliances() {
  await ensureAdmin()
  
  // Find alliances with no members, excluding the protected GLOBAL alliance
  const orphans = await prisma.alliance.findMany({
    where: {
      id: { not: "GLOBAL" },
      members: {
        none: {}
      }
    },
    select: { id: true }
  })

  const ids = orphans.map(o => o.id)
  if (ids.length === 0) {
    return { count: 0 }
  }

  const deleted = await prisma.alliance.deleteMany({
    where: {
      id: { in: ids }
    }
  })

  revalidatePath("/admin/alliances")
  revalidatePath("/admin/insights")
  
  return { count: deleted.count }
}
