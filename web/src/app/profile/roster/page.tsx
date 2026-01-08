import { redirect } from "next/navigation";
import { getRoster } from "@cerebro/core/services/rosterService";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { RosterView } from "./roster-view";
import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export const metadata: Metadata = {
  title: "My Roster | CereBro",
  description: "Manage and view your MCOC champion roster.",
};

export default async function RosterPage() {
  const player = await getUserPlayerWithAlliance();
  
  if (!player) {
    redirect("/api/auth/signin?callbackUrl=/profile/roster");
  }

  const rosterResult = await getRoster(player.id, null, null, null);
  const roster = typeof rosterResult === "string" ? [] : rosterResult;

  return (
    <div className="container mx-auto p-4 sm:p-8 space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            My Roster
          </h1>
          <p className="text-slate-400 mt-1">
            Manage your champions, update stats, and track your progress.
          </p>
        </div>
        <Link href="/profile/update">
          <Button className="bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-900/20 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Update Roster
          </Button>
        </Link>
      </div>

      <RosterView initialRoster={roster} />
    </div>
  );
}
