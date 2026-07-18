import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@/lib/logger";
import { loadTournamentControlProjection } from "../tournament-control-projection";
import { BattlegroundsTournamentsClient } from "../tournaments-client";

export const metadata: Metadata = {
  title: "Battlegrounds Tournament - CereBro",
  description: "Manage a Battlegrounds tournament.",
};

export const dynamic = "force-dynamic";

export default async function BattlegroundsTournamentDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const [{ tournamentId }, player] = await Promise.all([
    params,
    getUserPlayerWithAlliance(),
  ]);

  if (!player) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-10 text-center">
          <Trophy className="mx-auto h-12 w-12 text-slate-700" />
          <h1 className="mt-4 text-2xl font-bold text-white">Login Required</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Sign in with Discord and select a CereBro profile to manage this tournament.
          </p>
        </div>
      </div>
    );
  }

  logger.info(
    { userId: player.id, allianceId: player.allianceId, tournamentId },
    "User accessing Battlegrounds tournament detail page"
  );

  const control = await loadTournamentControlProjection({ tournamentId, player });
  if (!control) notFound();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_32%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.10),transparent_30%)]">
      <div className="container mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <div className="mb-4">
          <Button asChild variant="ghost" className="text-slate-400 hover:text-white">
            <Link href="/battlegrounds/tournaments">
              <ArrowLeft className="h-4 w-4" />
              Tournaments
            </Link>
          </Button>
        </div>

        <BattlegroundsTournamentsClient
          allianceName={control.allianceName}
          bgColors={control.bgColors}
          projections={[control.projection]}
          canCreate={false}
          showTournamentQueue={false}
        />
      </div>
    </div>
  );
}
