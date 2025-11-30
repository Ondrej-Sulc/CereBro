import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminNodeManagerClient from "@/components/admin/admin-node-manager-client";

export default async function AdminNodeManagerPage() {
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
  });

  if (!player?.isBotAdmin) {
    return <p>You must be a Bot Admin to access this page.</p>;
  }

  const warNodes = await prisma.warNode.findMany({
    orderBy: { nodeNumber: 'asc' },
    include: {
        allocations: {
            include: {
                nodeModifier: true
            }
        }
    }
  });

  // Fetch a list of modifiers for the combobox (maybe limit to first 100 or implement search)
  // For initial load, we might not need all 3600. The client component will handle search via server action.
  
  return (
    <AdminNodeManagerClient initialNodes={warNodes} />
  );
}
