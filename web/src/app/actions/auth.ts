"use server"

import { signIn, signOut } from "@/auth"
import { withActionContext } from "@/lib/with-request-context"

export const signOutAction = withActionContext('signOutAction', async () => {
  await signOut({ redirectTo: "/" })
});

export const switchDiscordAccountAction = withActionContext('switchDiscordAccountAction', async () => {
  await signOut({ redirect: false });
  // Show Discord's authorization screen again so the user can review the
  // selected Discord account before returning to CereBro.
  await signIn("discord", { redirectTo: "/" }, { prompt: "consent" });
});

export const signInAction = withActionContext('signInAction', async () => {
  await signIn("discord")
});

export const signInFromAuthPageAction = withActionContext('signInFromAuthPageAction', async (formData: FormData) => {
  const callbackUrl = formData.get("callbackUrl");
  // Auth.js validates this against the request origin before saving its callback
  // cookie. Keep that default redirect callback; never redirect here directly.
  await signIn("discord", { redirectTo: typeof callbackUrl === "string" ? callbackUrl : "/" });
});
