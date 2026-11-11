import { getExpandedNodeModifier, expandedNodeIndex } from "@/lib/expanded-node-modifiers"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params, detail = await getExpandedNodeModifier(id)
  if (!detail) return Response.json({ error: "Recorded modifier not found" }, { status: 404 })
  return Response.json({ ...detail, provenance: expandedNodeIndex.profile }, { headers: {
    "Content-Disposition": `attachment; filename="node-modifier-${encodeURIComponent(id)}.json"`, "Cache-Control": "public, max-age=3600"
  } })
}
