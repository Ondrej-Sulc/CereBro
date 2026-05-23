import type { UserPlayerWithAlliance } from "@/lib/auth-helpers";

export function canManageAllianceMembers(player: Pick<UserPlayerWithAlliance, "isOfficer">, botUserIsBotAdmin: boolean) {
  return player.isOfficer || botUserIsBotAdmin;
}

export function canPlanAllianceWar(player: { isOfficer: boolean; isPlanner?: boolean }, botUserIsBotAdmin: boolean) {
  return botUserIsBotAdmin || player.isOfficer || !!player.isPlanner;
}
