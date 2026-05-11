import { NextRequest, NextResponse } from "next/server";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { loadPlayerRosterPrestigeInsightSnapshot, visibleRosterPrestigeInsights } from "@/lib/roster-recommendation-service";
import logger from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";

export const GET = withRouteContext(async (req: NextRequest) => {
  const currentUser = await getUserPlayerWithAlliance();
  if (!currentUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const targetPlayerId = searchParams.get("playerId") || currentUser.id;

  // Security check: if viewing someone else, must be in same alliance or be bot admin
  if (targetPlayerId !== currentUser.id && !currentUser.isBotAdmin) {
    const targetPlayer = await prisma.player.findUnique({
      where: { id: targetPlayerId },
      select: { allianceId: true }
    });

    if (!targetPlayer || targetPlayer.allianceId !== currentUser.allianceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { insights } = await loadPlayerRosterPrestigeInsightSnapshot(targetPlayerId, searchParams);

  // If viewing someone else and not an officer/admin, strip sensitive insights
  const isOfficerOrAdmin = currentUser.isBotAdmin || (currentUser.isOfficer && currentUser.allianceId !== null);
  return NextResponse.json(visibleRosterPrestigeInsights(insights, {
    includeSuggestions: targetPlayerId === currentUser.id || isOfficerOrAdmin,
  }));
});
