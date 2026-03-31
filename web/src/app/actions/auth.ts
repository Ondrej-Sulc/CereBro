"use server"

import { signIn, signOut } from "@/auth"
import { withActionContext } from "@/lib/with-request-context"

export const signOutAction = withActionContext('signOutAction', async () => {
  await signOut({ redirectTo: "/" })
});

export const signInAction = withActionContext('signInAction', async () => {
  await signIn("discord")
});
