import sharp from 'sharp';
import { WarNodePosition, LAYOUT, LAYOUT_BIG } from '../data/war-planning/nodes-data';
import { WarMapType, ChampionClass } from '@prisma/client';
import logger from './loggerService';

export interface NodeAssignment {
    defenderName?: string;
    defenderImage?: string;
    defenderClass?: ChampionClass;
    attackerImage?: string;
    attackerClass?: ChampionClass;
    isTarget: boolean; // True if assigned to the player receiving the plan
    prefightImages?: { url: string; borderColor: string }[]; // Updated to support multiple prefights with colors
    assignedColor?: string; // Color for the node border (for overview map)
    isAttackerTactic?: boolean;
    isDefenderTactic?: boolean;
}

export interface LegendItem {
    name: string;
    color: string;
    championImage?: string; // Optional avatar
}

export class MapImageService {
    private static readonly BACKGROUND_COLOR_START = '#0f172a'; // slate-950
    private static readonly BACKGROUND_COLOR_END = '#020617'; // slate-950 (darker)
    private static readonly LINE_COLOR = '#334155'; // slate-700
    private static readonly NODE_COLOR = '#1e293b'; // slate-800
    private static readonly TEXT_COLOR = '#94a3b8'; // slate-400
    
    private static readonly HIGHLIGHT_GLOW = '#0ea5e9'; // sky-500
    private static readonly HIGHLIGHT_BORDER = '#ffffff'; // sky-400
    private static readonly HIGHLIGHT_PREFIGHT = '#ffffff'; // purple-400
    private static readonly HIGHLIGHT_TEXT = '#ffffff'; // white

    private static readonly SWORD_PATH = "M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2M14.5 6.5L18 3h3v3l-3.5 3.5M5 14l4 4M7 17l-3 3M3 19l2 2";
    private static readonly SHIELD_PATH = "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z";

    private static readonly CLASS_COLORS: Record<string, string> = {
        [ChampionClass.SCIENCE]: '#4ade80', // green-400
        [ChampionClass.SKILL]: '#ef4444',   // red-500
        [ChampionClass.MUTANT]: '#facc15',  // yellow-400
        [ChampionClass.COSMIC]: '#22d3ee',  // cyan-400
        [ChampionClass.TECH]: '#3b82f6',    // blue-500
        [ChampionClass.MYSTIC]: '#a855f7',  // purple-500
        [ChampionClass.SUPERIOR]: '#d946ef',// fuchsia-500
    };

    // 10 Distinct colors for players (matches web/src/lib/player-colors.ts PALETTE)
    public static readonly PLAYER_COLORS = [
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

    static async preloadImages(urls: string[]): Promise<Map<string, string>> {
        const cache = new Map<string, string>();
        await Promise.all(urls.map(async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch ${url}`);
                const buffer = Buffer.from(await response.arrayBuffer());
                const resized = await sharp(buffer).resize(128, 128).toBuffer();
                const base64 = `data:image/png;base64,${resized.toString('base64')}`;
                cache.set(url, base64);
            } catch (e) {
                logger.error({ err: e, url }, 'Failed to preload image');
            }
        }));
        return cache;
    }

    /**
     * Generates a PNG buffer of the war map with specific nodes highlighted and defender images.
     */
    static async generateMapImage(
        mapType: WarMapType,
        nodes: WarNodePosition[],
        assignments: Map<number, NodeAssignment>,
        preloadedImageCache?: Map<string, string>,
        legend?: LegendItem[],
        accentColor?: string
    ): Promise<Buffer> {
        
        // 1. Calculate Bounding Box
        const padding = 100;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            if (node.x < minX) minX = node.x;
            if (node.x > maxX) maxX = node.x;
            if (node.y < minY) minY = node.y;
            if (node.y > maxY) maxY = node.y;
        });

        // Add padding
        minX -= padding;
        maxX += padding;
        minY -= padding;
        maxY += padding;

        let width = Math.ceil(maxX - minX);
        const height = Math.ceil(maxY - minY);

        // Adjust for Legend
        const legendWidth = 350;
        if (legend && legend.length > 0) {
            width += legendWidth;
        }

        // 2. Fetch Images (in parallel) and convert to Base64
        const imageCache = new Map<string, string>(preloadedImageCache);
        const uniqueUrls = new Set<string>();
        
        assignments.forEach(assignment => {
            if (assignment.defenderImage && !imageCache.has(assignment.defenderImage)) {
                uniqueUrls.add(assignment.defenderImage);
            }
            if (assignment.attackerImage && !imageCache.has(assignment.attackerImage)) {
                uniqueUrls.add(assignment.attackerImage);
            }
            if (assignment.prefightImages) {
                assignment.prefightImages.forEach(pf => {
                    if (pf.url && !imageCache.has(pf.url)) {
                        uniqueUrls.add(pf.url);
                    }
                });
            }
        });

        if (legend) {
            legend.forEach(item => {
                if (item.championImage && !imageCache.has(item.championImage)) {
                    uniqueUrls.add(item.championImage);
                }
            });
        }

        await Promise.all(Array.from(uniqueUrls).map(async (url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Failed to fetch ${url}`);
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                
                // Resize to save space in SVG and standardizing
                const resized = await sharp(buffer).resize(128, 128).toBuffer();
                const base64 = `data:image/png;base64,${resized.toString('base64')}`;
                imageCache.set(url, base64);
            } catch (e) {
                logger.error({ err: e, url }, 'Failed to fetch champion image for map generation');
            }
        }));

        // 3. Generate SVG Content
        const svgContent = this.buildSvg(
            width, 
            height, 
            minX, 
            minY, 
            nodes, 
            assignments, 
            imageCache,
            legend,
            legendWidth,
            accentColor
        );

        // 4. Convert to PNG
        const buffer = await sharp(Buffer.from(svgContent))
            .png()
            .toBuffer();

        return buffer;
    }

    private static hexToRgba(hex: string, alpha: number): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    private static buildSvg(
        width: number,
        height: number,
        offsetX: number,
        offsetY: number,
        nodes: WarNodePosition[], 
        assignments: Map<number, NodeAssignment>,
        imageCache: Map<string, string>,
        legend?: LegendItem[],
        legendWidth: number = 0,
        accentColor?: string
    ): string {
        
        // --- 1. Background Elements (Nebulas & Stars) ---
        let starsSvg = '';
        const starCount = 200;
        for (let i = 0; i < starCount; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const r = Math.random() * 1.5 + 0.5;
            const op = Math.random() * 0.7 + 0.3;
            starsSvg += `<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${op}" />`;
        }

        // Tint the paths based on accentColor
        const pathColor = accentColor || '#22d3ee';

        const nebDefs = `
            <radialGradient id="nebula-violet" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stop-color="rgba(76, 29, 149, 0.25)" />
                <stop offset="100%" stop-color="rgba(76, 29, 149, 0)" />
            </radialGradient>
            <radialGradient id="nebula-blue" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stop-color="rgba(30, 58, 138, 0.25)" />
                <stop offset="100%" stop-color="rgba(30, 58, 138, 0)" />
            </radialGradient>
            <radialGradient id="nebula-pink" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stop-color="rgba(190, 24, 93, 0.25)" />
                <stop offset="100%" stop-color="rgba(190, 24, 93, 0)" />
            </radialGradient>
            <radialGradient id="nebula-teal" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stop-color="rgba(15, 118, 110, 0.25)" />
                <stop offset="100%" stop-color="rgba(15, 118, 110, 0)" />
            </radialGradient>
        `;

        const nebulasSvg = `
            <circle cx="${width * 0.2}" cy="${height * 0.8}" r="${width * 0.4}" fill="url(#nebula-violet)" />
            <circle cx="${width * 0.8}" cy="${height * 0.2}" r="${width * 0.4}" fill="url(#nebula-blue)" />
            <circle cx="${width * 0.7}" cy="${height * 0.8}" r="${width * 0.3}" fill="url(#nebula-pink)" />
            <circle cx="${width * 0.3}" cy="${height * 0.3}" r="${width * 0.4}" fill="url(#nebula-teal)" />
        `;

        const styles = `
            <style>
                .path { 
                    stroke: ${pathColor}; 
                    stroke-width: 3; 
                    fill: none; 
                    stroke-dasharray: 12, 12; 
                    opacity: 0.8; 
                    filter: url(#path-glow);
                }
                .node-fill { fill: rgba(15, 23, 42, 0.95); }
                .badge-text { 
                    font-family: monospace; 
                    font-weight: bold; 
                    font-size: 11px; 
                    fill: #cbd5e1; 
                    text-anchor: middle; 
                    dominant-baseline: central;
                }
                .badge-text-highlight { fill: ${this.HIGHLIGHT_TEXT}; }
                .badge-text-dark { fill: #0f172a; }
                .border-default { stroke: ${this.LINE_COLOR}; stroke-width: 2; }
                .border-highlight { stroke: ${this.HIGHLIGHT_BORDER}; stroke-width: 4; filter: url(#glow); }
                .border-prefight { stroke: ${this.HIGHLIGHT_PREFIGHT}; stroke-width: 3; filter: url(#glow); }
            </style>
            <defs>
                ${nebDefs}
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="path-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
        `;

        // --- 2. Build Paths ---
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        let pathsSvg = '';
        const drawnPaths = new Set<string>();

        nodes.forEach(node => {
            if (!node.paths) return;
            node.paths.forEach(targetId => {
                const target = nodeMap.get(targetId);
                if (target) {
                    const key = [node.id, target.id].sort().join('-');
                    if (!drawnPaths.has(key)) {
                        const x1 = node.x - offsetX;
                        const y1 = node.y - offsetY;
                        const x2 = target.x - offsetX;
                        const y2 = target.y - offsetY;
                        
                        pathsSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="path" />\n`;
                        drawnPaths.add(key);
                    }
                }
            });
        });

        // --- 3. Build Nodes ---
        let nodesSvg = '';
        
        nodes.forEach(node => {
            const x = node.x - offsetX;
            const y = node.y - offsetY;
            
            // Render Portals
            if (node.isPortal) {
                const portalFill = accentColor || "#10B981";
                nodesSvg += `
                    <g transform="translate(${x}, ${y})">
                         <circle r="12" fill="${portalFill}" opacity="0.3" />
                         <circle r="7" fill="${portalFill}" stroke="white" stroke-width="1" opacity="0.9" />
                         <circle r="3" fill="white" />
                    </g>
                `;
                return;
            }

            const assignment = assignments.get(Number(node.id));
            const isTarget = assignment?.isTarget;
            const prefightImages = assignment?.prefightImages || [];
            
            // Colors
            let borderProps = isTarget ? `class="node-fill border-highlight"` : `class="node-fill border-default"`;
            let badgeTextColorClass = isTarget ? "badge-text badge-text-highlight" : "badge-text";
            let badgeStrokeVal = isTarget ? this.HIGHLIGHT_BORDER : this.LINE_COLOR;
            let badgeFillVal = "rgba(15, 23, 42, 0.95)"; // Default dark fill
            
            // Override fill for assigned player
            if (assignment?.assignedColor) {
                const mutedFill = MapImageService.hexToRgba(assignment.assignedColor, 0.25);
                borderProps = `style="fill: ${mutedFill}; stroke: ${assignment.assignedColor}; stroke-width: 3"`;
                badgeStrokeVal = assignment.assignedColor;
                
                // For badge, use solid color for fill
                badgeFillVal = assignment.assignedColor;
                
                // For badge text, use dark color
                badgeTextColorClass = "badge-text badge-text-dark";
            } else if (isTarget) {
                 // Keep target logic if needed, but usually assignedColor covers it
                 // If isTarget but no assignedColor (e.g. self target in my-plan?)
            }

            // Class Colors
            const attColor = assignment?.attackerClass ? MapImageService.CLASS_COLORS[assignment.attackerClass] : '#94a3b8';
            const defColor = assignment?.defenderClass ? MapImageService.CLASS_COLORS[assignment.defenderClass] : '#94a3b8';

            const r = 32; 
            const pillH = r * 2;
            let innerContent = '';
            
            // --- A. Main Node (Pill or Circle) ---
            const attImg = assignment?.attackerImage ? imageCache.get(assignment.attackerImage) : undefined;
            const defImg = assignment?.defenderImage ? imageCache.get(assignment.defenderImage) : undefined;

            if (attImg) {
                // PILL (Render if Attacker exists, even if Defender image is missing)
                const pillW = r * 4;
                
                innerContent += `
                    <rect x="${-pillW/2}" y="${-pillH/2}" width="${pillW}" height="${pillH}" rx="${r}" ${borderProps} />
                    
                    <!-- Attacker -->
                    <circle cx="${-pillW/4}" cy="0" r="${r-4}" fill="${attColor}" opacity="0.4" />
                    <g clip-path="url(#clip-${node.id}-L)">
                        <image href="${attImg}" x="${-pillW/4 - (r-4)}" y="${-(r-4)}" width="${(r-4)*2}" height="${(r-4)*2}" preserveAspectRatio="xMidYMid slice" />
                    </g>
                    <defs><clipPath id="clip-${node.id}-L"><circle cx="${-pillW/4}" cy="0" r="${r-4}" /></clipPath></defs>
                    <circle cx="${-pillW/4}" cy="0" r="${r-4}" fill="none" stroke="${attColor}" stroke-width="1.5" />

                    <!-- Defender -->
                    <circle cx="${pillW/4}" cy="0" r="${r-4}" fill="${defColor}" opacity="0.4" />
                    ${defImg ? `
                    <g clip-path="url(#clip-${node.id}-R)">
                        <image href="${defImg}" x="${pillW/4 - (r-4)}" y="${-(r-4)}" width="${(r-4)*2}" height="${(r-4)*2}" preserveAspectRatio="xMidYMid slice" />
                    </g>
                    <defs><clipPath id="clip-${node.id}-R"><circle cx="${pillW/4}" cy="0" r="${r-4}" /></clipPath></defs>
                    ` : ''}
                    <circle cx="${pillW/4}" cy="0" r="${r-4}" fill="none" stroke="${defColor}" stroke-width="1.5" />
                `;

            } else {
                // CIRCLE (Defender Only)
                if (defImg) {
                    innerContent += `
                        <circle r="${r}" ${borderProps} />
                        
                        <circle cx="0" cy="0" r="${r-4}" fill="${defColor}" opacity="0.4" />
                        <g clip-path="url(#clip-${node.id})">
                            <image href="${defImg}" x="${-(r-4)}" y="${-(r-4)}" width="${(r-4)*2}" height="${(r-4)*2}" preserveAspectRatio="xMidYMid slice" />
                        </g>
                        <defs><clipPath id="clip-${node.id}"><circle cx="0" cy="0" r="${r-4}" /></clipPath></defs>
                        <circle cx="0" cy="0" r="${r-4}" fill="none" stroke="${defColor}" stroke-width="1.5" />
                    `;
                } else if (assignment?.defenderImage || assignment?.defenderName) {
                    // Fallback: Defender assigned but image missing/failed
                    innerContent += `
                        <circle r="${r}" ${borderProps} />
                        <circle cx="0" cy="0" r="${r-4}" fill="${defColor}" opacity="0.8" />
                        <text x="0" y="0" text-anchor="middle" dominant-baseline="central" fill="rgba(0,0,0,0.5)" font-family="sans-serif" font-size="24" font-weight="bold">?</text>
                    `;
                } else {
                    // Empty node
                    innerContent += `<circle r="${r}" ${borderProps} />`;
                }
            }

            // --- B. Node Number Badge (Top) ---
            const badgeW = 28;
            const badgeH = 18;
            const badgeY = -r - 12; 

            innerContent += `
                <g transform="translate(0, ${badgeY})">
                    <rect x="${-badgeW/2}" y="${-badgeH/2}" width="${badgeW}" height="${badgeH}" rx="4" fill="${badgeFillVal}" stroke="${badgeStrokeVal}" stroke-width="2" />
                    <text x="0" y="0" class="${badgeTextColorClass}">${node.id}</text>
                </g>
            `;

            // --- C. Prefight Badges (Bottom) ---
            if (prefightImages.length > 0) {
                const pfR = 12; // Radius 12
                const spacing = 26; // 26px spacing
                // Start X to center the group
                const startX = -((prefightImages.length * spacing) / 2) + (spacing / 2);
                const pfY = r + 12;

                innerContent += `<g transform="translate(0, ${pfY})">`;
                
                prefightImages.forEach((pf, i) => {
                    if (pf.url && imageCache.has(pf.url)) {
                        const pfBase64 = imageCache.get(pf.url);
                        const xPos = startX + (i * spacing);
                        const borderColor = pf.borderColor || '#94a3b8';

                        innerContent += `
                            <g transform="translate(${xPos}, 0)">
                                <circle r="${pfR}" fill="#0f172a" stroke="${borderColor}" stroke-width="2" />
                                <g clip-path="url(#clip-${node.id}-PF-${i})">
                                    <image href="${pfBase64}" x="${-pfR}" y="${-pfR}" width="${pfR*2}" height="${pfR*2}" preserveAspectRatio="xMidYMid slice" />
                                </g>
                                <defs><clipPath id="clip-${node.id}-PF-${i}"><circle cx="0" cy="0" r="${pfR}" /></clipPath></defs>
                            </g>
                        `;
                    }
                });

                innerContent += `</g>`;
            }

            // --- D. Tactic Badges (Attack/Defense) ---
            const badgeOffset = Math.floor(r * 0.7); // 45 deg approx
            const badgeR = 11;
            const iconSize = 14;
            
            // Attacker Badge
            if (assignment?.isAttackerTactic) {
                let badgeX = -badgeOffset - 8;
                if (assignment.attackerImage && assignment.defenderImage) {
                    badgeX = -32 - badgeOffset - 4;
                }
                const badgeY = -badgeOffset - 8;

                innerContent += `
                    <g transform="translate(${badgeX}, ${badgeY})">
                        <circle cx="1" cy="1" r="${badgeR}" fill="rgba(0,0,0,0.6)" />
                        <circle r="${badgeR}" fill="#022c22" stroke="#10b981" stroke-width="1" />
                        <g transform="translate(${-iconSize/2}, ${-iconSize/2}) scale(${iconSize/24})">
                             <path d="${MapImageService.SWORD_PATH}" stroke="#34d399" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                        </g>
                    </g>
                `;
            }

            // Defender Badge
            if (assignment?.isDefenderTactic) {
                let badgeX = badgeOffset + 8;
                if (assignment.attackerImage && assignment.defenderImage) {
                    badgeX = 32 + badgeOffset + 4;
                }
                const badgeY = -badgeOffset - 8;

                innerContent += `
                    <g transform="translate(${badgeX}, ${badgeY})">
                        <circle cx="1" cy="1" r="${badgeR}" fill="rgba(0,0,0,0.6)" />
                        <circle r="${badgeR}" fill="#450a0a" stroke="#ef4444" stroke-width="1" />
                        <g transform="translate(${-iconSize/2}, ${-iconSize/2}) scale(${iconSize/24})">
                             <path d="${MapImageService.SHIELD_PATH}" fill="#f87171" />
                        </g>
                    </g>
                `;
            }

            nodesSvg += `
                <g transform="translate(${x}, ${y})">
                    ${innerContent}
                </g>
            `;
        });

        // --- 4. Build Legend ---
        let legendSvg = '';
        if (legend && legend.length > 0) {
            const legendX = width - legendWidth + 40; // Start inside the new area
            let legendY = 100;

            // Title
            legendSvg += `
                <text x="${legendX}" y="${legendY}" font-family="sans-serif" font-weight="bold" font-size="24" fill="#e2e8f0">
                    Battlegroup Plan
                </text>
            `;
            legendY += 50;

            legend.forEach((item, index) => {
                // Color Circle
                legendSvg += `
                    <circle cx="${legendX + 12}" cy="${legendY}" r="12" fill="${item.color}" />
                `;

                // Avatar (if available)
                if (item.championImage && imageCache.has(item.championImage)) {
                    const img = imageCache.get(item.championImage);
                    legendSvg += `
                        <g clip-path="url(#clip-legend-${index})">
                             <image href="${img}" x="${legendX + 35}" y="${legendY - 20}" width="40" height="40" preserveAspectRatio="xMidYMid slice" />
                        </g>
                        <defs><clipPath id="clip-legend-${index}"><circle cx="${legendX + 55}" cy="${legendY}" r="20" /></clipPath></defs>
                    `;
                    // Name
                    legendSvg += `
                        <text x="${legendX + 85}" y="${legendY + 6}" font-family="sans-serif" font-size="18" fill="#cbd5e1">${item.name}</text>
                    `;
                } else {
                    // Name without avatar
                     legendSvg += `
                        <text x="${legendX + 35}" y="${legendY + 6}" font-family="sans-serif" font-size="18" fill="#cbd5e1">${item.name}</text>
                    `;
                }
                
                legendY += 60;
            });
        }

        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                ${styles}
                <rect width="100%" height="100%" fill="#020617" />
                ${nebulasSvg}
                ${starsSvg}
                ${pathsSvg}
                ${nodesSvg}
                ${legendSvg}
            </svg>
        `;
    }
}