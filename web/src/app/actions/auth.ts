"use server"

import { signIn, signOut } from "@/auth"

export async function signOutAction() {
  await signOut()
}

export async function signInAction() {
  await signIn("discord")
}
