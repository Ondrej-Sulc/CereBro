export type PlayerPaletteStyle = 'DEFAULT' | 'COLORBLIND' | 'HIGH_CONTRAST' | 'PASTEL';

export const PALETTE_LABELS: Record<PlayerPaletteStyle, string> = {
    DEFAULT: 'Default',
    COLORBLIND: 'Colorblind-Safe',
    HIGH_CONTRAST: 'High Contrast',
    PASTEL: 'Pastel',
};

export const PALETTE_DESCRIPTIONS: Record<PlayerPaletteStyle, string> = {
    DEFAULT: 'Evenly spaced hues optimized for dark backgrounds.',
    COLORBLIND: 'Okabe-Ito palette — safe for all common colorblindness types.',
    HIGH_CONTRAST: 'Maximum saturation for easy differentiation.',
    PASTEL: 'Softer, lighter tones for a gentler look.',
};

export const PALETTES: Record<PlayerPaletteStyle, string[]> = {
    // Evenly spaced around hue wheel (Tailwind 400s)
    DEFAULT: [
        '#f87171', // Red 400
        '#fb923c', // Orange 400
        '#facc15', // Yellow 400
        '#a3e635', // Lime 400
        '#4ade80', // Green 400
        '#2dd4bf', // Teal 400
        '#38bdf8', // Sky 400
        '#818cf8', // Indigo 400
        '#e879f9', // Fuchsia 400
        '#f472b6', // Pink 400
    ],
    // Okabe-Ito core (7 colors) + 3 distinct extras, all clearly different hue families
    COLORBLIND: [
        '#E69F00', // Orange
        '#56B4E9', // Sky Blue
        '#009E73', // Bluish Green
        '#F0E442', // Yellow
        '#D55E00', // Vermilion
        '#CC79A7', // Pink-Purple
        '#EEEEEE', // Light Grey
        '#AA4499', // Deep Magenta (Paul Tol — distinct hue from pink-purple)
        '#44BB99', // Teal (Paul Tol — distinct from bluish green by tone)
        '#FF99AA', // Light Rose (warm, distinct from orange and purple)
    ],
    // Maximum saturation — each color jumps out clearly
    HIGH_CONTRAST: [
        '#ff4d4d', // Vivid Red
        '#ff9933', // Vivid Orange
        '#ffee00', // Vivid Yellow
        '#66ff33', // Vivid Lime
        '#00ff88', // Vivid Green
        '#00eedd', // Vivid Teal
        '#00aaff', // Vivid Blue
        '#7744ff', // Vivid Indigo
        '#ff33ff', // Vivid Fuchsia
        '#ff66aa', // Vivid Pink
    ],
    // Tailwind 300s — softer, lighter
    PASTEL: [
        '#fca5a5', // Red 300
        '#fdba74', // Orange 300
        '#fde047', // Yellow 300
        '#bef264', // Lime 300
        '#86efac', // Green 300
        '#5eead4', // Teal 300
        '#7dd3fc', // Sky 300
        '#a5b4fc', // Indigo 300
        '#f0abfc', // Fuchsia 300
        '#f9a8d4', // Pink 300
    ],
};

export const DEFAULT_PALETTE_STYLE: PlayerPaletteStyle = 'HIGH_CONTRAST';

// djb2 hash — consistent color per player ID regardless of sort order
function hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash;
}

export function getPlayerColor(
    playerId: string | undefined | null,
    paletteStyle: PlayerPaletteStyle = DEFAULT_PALETTE_STYLE
): string {
    if (!playerId) return '#94a3b8'; // Slate 400 — unassigned
    const palette = PALETTES[paletteStyle] ?? PALETTES.DEFAULT;
    const hash = Math.abs(hashString(playerId));
    return palette[hash % palette.length];
}
