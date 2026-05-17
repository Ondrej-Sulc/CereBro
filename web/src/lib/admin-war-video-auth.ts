import { getUserPlayerWithAlliance, isUserBotAdmin, UserPlayerWithAlliance } from "@/lib/auth-helpers";

export async function getWarVideoModerator(): Promise<UserPlayerWithAlliance | null> {
  const user = await getUserPlayerWithAlliance();

  if (!user) {
    return null;
  }

  if (user.isBotAdmin || user.permissions?.includes("MANAGE_WAR_CONFIG")) {
    return user;
  }

  return null;
}

export async function canManageWarVideos(): Promise<boolean> {
  if (await isUserBotAdmin()) {
    return true;
  }

  const user = await getUserPlayerWithAlliance();
  return Boolean(user?.permissions?.includes("MANAGE_WAR_CONFIG"));
}
