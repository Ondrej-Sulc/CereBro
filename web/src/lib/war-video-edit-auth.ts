import { getUserProfiles } from "@/lib/auth-helpers";
import { canManageWarVideos } from "@/lib/admin-war-video-auth";

export type WarVideoEditAccess = {
  canEdit: boolean;
  isAdmin: boolean;
  playerIds: string[];
};

export async function getWarVideoEditAccess(submittedById: string): Promise<WarVideoEditAccess> {
  const [isAdmin, profiles] = await Promise.all([
    canManageWarVideos(),
    getUserProfiles(),
  ]);

  const playerIds = profiles.map((profile) => profile.id);

  return {
    canEdit: isAdmin || playerIds.includes(submittedById),
    isAdmin,
    playerIds,
  };
}
