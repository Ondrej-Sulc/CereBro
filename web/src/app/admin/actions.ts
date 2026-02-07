"use server"

import { auth } from "@/auth"
import { redirect } from "next/navigation"

export async function ensureAdmin() {
  const session = await auth()
  if (!session?.user?.isBotAdmin) {
    redirect("/")
  }
  return session
}
