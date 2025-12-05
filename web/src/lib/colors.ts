// Tailored Palette: Distinct, suitable for dark theme (400/500 shades)
const PALETTE = [
    '#ef4444', // Red 500
    '#f97316', // Orange 500
    '#eab308', // Yellow 500
    '#22c55e', // Green 500
    '#10b981', // Emerald 500
    '#06b6d4', // Cyan 500
    '#3b82f6', // Blue 500
    '#8b5cf6', // Violet 500
    '#d946ef', // Fuchsia 500
    '#f43f5e', // Rose 500
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
