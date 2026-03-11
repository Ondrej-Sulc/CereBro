import { prisma } from "@/lib/prisma";
import AdminTacticManagerClient from "@/components/admin/admin-tactic-manager-client";
import { ensureAdmin } from "../actions";

export default async function AdminTacticsPage() {
  await ensureAdmin("MANAGE_WAR_CONFIG");

  const tactics = await prisma.warTactic.findMany({
    orderBy: [{ season: 'desc' }, { minTier: 'asc' }],
    include: {
        attackTag: true,
        defenseTag: true
    }
  });

  return (
    <AdminTacticManagerClient initialTactics={tactics} />
  );
}
