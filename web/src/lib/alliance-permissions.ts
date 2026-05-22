import type { UserPlayerWithAlliance } from "@/lib/auth-helpers";

export function canManageAllianceMembers(player: Pick<UserPlayerWithAlliance, "isOfficer" | "isBotAdmin">) {
  return player.isOfficer || player.isBotAdmin;
}

export function canPlanAllianceWar(player: Pick<UserPlayerWithAlliance, "isOfficer" | "isPlanner" | "isBotAdmin">) {
  return player.isBotAdmin || player.isOfficer || player.isPlanner;
}
