import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import AdminBansManagerClient from "@/components/admin/admin-bans-manager-client";
import { getCachedChampions } from "@/lib/data/champions";
import { SeasonBanWithChampion } from "@cerebro/core/data/war-planning/types";
import { ensureAdmin } from "../actions";

export const metadata: Metadata = {
  title: "Season Bans - CereBro",
  description:
    "Configure champion bans for specific seasons and tier ranges.",
};

export default async function AdminBansPage() {
  await ensureAdmin("MANAGE_WAR_CONFIG");

  const bans = await prisma.seasonBan.findMany({
    orderBy: [{ season: 'desc' }, { minTier: 'asc' }],
    include: {
        champion: {
            select: {
                id: true,
                name: true,
                images: true
            }
        }
    }
  });

  const champions = await getCachedChampions();

  return (
    <AdminBansManagerClient initialBans={bans as unknown as SeasonBanWithChampion[]} champions={champions} />
  );
}
