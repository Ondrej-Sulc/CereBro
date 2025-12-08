// Tailored Palette: Distinct, suitable for dark theme (Kelly's Max Contrast adapted to Tailwind 400s)
export const PALETTE = [
    '#4ade80', // Green 400
    '#60a5fa', // Blue 400
    '#c084fc', // Purple 400
    '#e879f9', // Fuchsia 400
    '#f472b6', // Pink 400
    '#f87171', // Red 400
    '#facc15', // Yellow 400
    '#fb923c', // Orange 400
    '#22d3ee', // Cyan 400
    '#a3e635', // Lime 400
];

// Simple hash function (djb2) to map string to integer
function hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i); /* hash * 33 + c */
    }
    return hash;
}

export function getPlayerColor(playerId: string | undefined | null): string {
    if (!playerId) return '#94a3b8'; // Slate 400 (Default/Unassigned)
    
    // Hash the ID to get a consistent index
    const hash = Math.abs(hashString(playerId));
    const index = hash % PALETTE.length;
    
    return PALETTE[index];
}
