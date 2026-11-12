import { getExpandedNodeModifier, expandedNodeIndex } from "@/lib/expanded-node-modifiers"
import { isUserBotAdmin } from "@/lib/auth-helpers"

export const dynamic = "force-dynamic"
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isUserBotAdmin()) return new Response(null, { status: 403, headers: privateHeaders })
  const { id } = await params, detail = await getExpandedNodeModifier(id)
  if (!detail) return Response.json({ error: "Node modifier not found" }, { status: 404, headers: privateHeaders })
  return Response.json({ ...detail, provenance: expandedNodeIndex.profile }, { headers: {
    ...privateHeaders, "Content-Disposition": `attachment; filename="node-modifier-${encodeURIComponent(id)}.json"`
  } })
}
