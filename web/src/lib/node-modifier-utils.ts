import { War, WarMapType, WarNodeAllocation, NodeModifier } from "@prisma/client";

export function getActiveModifiers(
    allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[],
    war: { warTier: number; season?: number; mapType: WarMapType }
): NodeModifier[] {
    if (!allocations || !war) return [];

    return allocations.filter(alloc => {
        const tierMatch = (!alloc.minTier || alloc.minTier <= war.warTier) && 
                          (!alloc.maxTier || alloc.maxTier >= war.warTier);
        const seasonMatch = !alloc.season || (war.season !== undefined && alloc.season === war.season);
        const mapTypeMatch = alloc.mapType === (war.mapType || WarMapType.STANDARD);
        
        return tierMatch && seasonMatch && mapTypeMatch;
    }).map(a => a.nodeModifier);
}
