import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createWar } from "./actions";
import { prisma, WarStatus } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function WarPlanningPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "discord",
    },
  });

  if (!account?.providerAccountId) {
    return <p>Error: No linked Discord account found.</p>;
  }

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
    include: { alliance: true },
  });

  if (!player || !player.allianceId || !player.isOfficer) {
    return <p>You must be an Alliance Officer to access War Planning.</p>;
  }

  // Fetch past wars for the alliance
  const wars = await prisma.war.findMany({
    where: {
      allianceId: player.allianceId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Pre-fill logic (example: based on last war)
  const lastWar = wars.length > 0 ? wars[0] : null;
  const defaultSeason = lastWar ? lastWar.season : 1;
  const defaultWarNumber = lastWar && lastWar.warNumber !== null ? lastWar.warNumber + 1 : 1;
  const defaultTier = lastWar ? lastWar.warTier : 1;

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">War Planning</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Start New War</CardTitle>
          <CardDescription>Create a new Alliance War plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createWar} className="space-y-4">
            <div>
              <Label htmlFor="season">Season</Label>
              <Input
                id="season"
                name="season"
                type="number"
                required
                defaultValue={defaultSeason}
              />
            </div>
            <div>
              <Label htmlFor="warNumber">War Number (Optional)</Label>
              <Input
                id="warNumber"
                name="warNumber"
                type="number"
                defaultValue={defaultWarNumber}
              />
            </div>
            <div>
              <Label htmlFor="tier">Tier</Label>
              <Input
                id="tier"
                name="tier"
                type="number"
                required
                defaultValue={defaultTier}
              />
            </div>
            <div>
              <Label htmlFor="opponent">Opponent Alliance</Label>
              <Input
                id="opponent"
                name="opponent"
                type="text"
                required
              />
            </div>
            <Button type="submit">Start War</Button>
          </form>
        </CardContent>
      </Card>

      <h2 className="text-2xl font-bold mb-4">Past Wars</h2>
      {wars.length === 0 ? (
        <p>No past wars found for your alliance.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {wars.map((war) => (
            <Card key={war.id}>
              <CardHeader>
                <CardTitle>
                  Season {war.season} - {war.enemyAlliance}
                </CardTitle>
                <CardDescription>
                  War # {war.warNumber || "N/A"} | Tier {war.warTier} | Status: {war.status}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>Created: {new Date(war.createdAt).toLocaleDateString()}</p>
                <Link href={`/planning/${war.id}`}>
                  <Button className="mt-4">View Plan</Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}