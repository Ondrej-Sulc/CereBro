import { prisma } from "@/lib/prisma";
import AdminNodeManagerClient from "@/components/admin/admin-node-manager-client";
import { ensureAdmin } from "../actions";

export default async function AdminNodeManagerPage() {
  await ensureAdmin("MANAGE_WAR_CONFIG");

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
