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
    prefightImage?: string; // Image of the prefight champion placed by the player
    prefightClass?: ChampionClass;
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

    private static readonly CLASS_COLORS: Record<string, string> = {
        [ChampionClass.SCIENCE]: '#4ade80', // green-400
        [ChampionClass.SKILL]: '#ef4444',   // red-500
        [ChampionClass.MUTANT]: '#facc15',  // yellow-400
        [ChampionClass.COSMIC]: '#22d3ee',  // cyan-400
        [ChampionClass.TECH]: '#3b82f6',    // blue-500
        [ChampionClass.MYSTIC]: '#a855f7',  // purple-500
        [ChampionClass.SUPERIOR]: '#d946ef',// fuchsia-500
    };

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
        preloadedImageCache?: Map<string, string>
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

        const width = Math.ceil(maxX - minX);
        const height = Math.ceil(maxY - minY);

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
        });

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
            imageCache
        );

        // 4. Convert to PNG
        const buffer = await sharp(Buffer.from(svgContent))
            .png()
            .toBuffer();

        return buffer;
    }

    private static buildSvg(
        width: number,
        height: number,
        offsetX: number,
        offsetY: number,
        nodes: WarNodePosition[], 
        assignments: Map<number, NodeAssignment>,
        imageCache: Map<string, string>
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
                    stroke: #22d3ee; 
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

        // Removed Logging

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
                nodesSvg += `
                    <g transform="translate(${x}, ${y})">
                         <circle r="12" fill="#10B981" opacity="0.3" />
                         <circle r="7" fill="#10B981" stroke="#064e3b" stroke-width="1" />
                         <circle r="3" fill="#ecfdf5" />
                    </g>
                `;
                return;
            }

            const assignment = assignments.get(Number(node.id));
            const isTarget = assignment?.isTarget;
            const prefightImg = assignment?.prefightImage;
            
            // Colors
            const borderColorClass = isTarget ? "border-highlight" : "border-default";
            const badgeTextColorClass = isTarget ? "badge-text badge-text-highlight" : "badge-text";
            const badgeStroke = isTarget ? this.HIGHLIGHT_BORDER : this.LINE_COLOR;

            // Class Colors
            const attColor = assignment?.attackerClass ? MapImageService.CLASS_COLORS[assignment.attackerClass] : '#94a3b8';
            const defColor = assignment?.defenderClass ? MapImageService.CLASS_COLORS[assignment.defenderClass] : '#94a3b8';
            const pfColor = assignment?.prefightClass ? MapImageService.CLASS_COLORS[assignment.prefightClass] : '#94a3b8';

            const r = 32; 
            const pillH = r * 2;
            let innerContent = '';
            
            // --- A. Main Node (Pill or Circle) ---
            if (assignment?.attackerImage && assignment?.defenderImage && 
                imageCache.has(assignment.attackerImage) && imageCache.has(assignment.defenderImage)) {
                
                // PILL
                const attImg = imageCache.get(assignment.attackerImage);
                const defImg = imageCache.get(assignment.defenderImage);
                const pillW = r * 4;
                
                innerContent += `
                    <rect x="${-pillW/2}" y="${-pillH/2}" width="${pillW}" height="${pillH}" rx="${r}" class="node-fill ${borderColorClass}" />
                    
                    <!-- Attacker -->
                    <circle cx="${-pillW/4}" cy="0" r="${r-4}" fill="${attColor}" opacity="0.4" />
                    <g clip-path="url(#clip-${node.id}-L)">
                        <image href="${attImg}" x="${-pillW/4 - (r-4)}" y="${-(r-4)}" width="${(r-4)*2}" height="${(r-4)*2}" preserveAspectRatio="xMidYMid slice" />
                    </g>
                    <defs><clipPath id="clip-${node.id}-L"><circle cx="${-pillW/4}" cy="0" r="${r-4}" /></clipPath></defs>
                    <circle cx="${-pillW/4}" cy="0" r="${r-4}" fill="none" stroke="${attColor}" stroke-width="1.5" />

                    <!-- Defender -->
                    <circle cx="${pillW/4}" cy="0" r="${r-4}" fill="${defColor}" opacity="0.4" />
                    <g clip-path="url(#clip-${node.id}-R)">
                        <image href="${defImg}" x="${pillW/4 - (r-4)}" y="${-(r-4)}" width="${(r-4)*2}" height="${(r-4)*2}" preserveAspectRatio="xMidYMid slice" />
                    </g>
                    <defs><clipPath id="clip-${node.id}-R"><circle cx="${pillW/4}" cy="0" r="${r-4}" /></clipPath></defs>
                    <circle cx="${pillW/4}" cy="0" r="${r-4}" fill="none" stroke="${defColor}" stroke-width="1.5" />
                `;

            } else {
                // CIRCLE (Defender Only)
                if (assignment?.defenderImage && imageCache.has(assignment.defenderImage)) {
                    const base64 = imageCache.get(assignment.defenderImage);
                    innerContent += `
                        <circle r="${r}" class="node-fill ${borderColorClass}" />
                        
                        <circle cx="0" cy="0" r="${r-4}" fill="${defColor}" opacity="0.4" />
                        <g clip-path="url(#clip-${node.id})">
                            <image href="${base64}" x="${-(r-4)}" y="${-(r-4)}" width="${(r-4)*2}" height="${(r-4)*2}" preserveAspectRatio="xMidYMid slice" />
                        </g>
                        <defs><clipPath id="clip-${node.id}"><circle cx="0" cy="0" r="${r-4}" /></clipPath></defs>
                        <circle cx="0" cy="0" r="${r-4}" fill="none" stroke="${defColor}" stroke-width="1.5" />
                    `;
                } else {
                    // Empty node
                    innerContent += `<circle r="${r}" class="node-fill ${borderColorClass}" />`;
                }
            }

            // --- B. Node Number Badge (Top) ---
            const badgeW = 28;
            const badgeH = 18;
            const badgeY = -r - 12; 

            innerContent += `
                <g transform="translate(0, ${badgeY})">
                    <rect x="${-badgeW/2}" y="${-badgeH/2}" width="${badgeW}" height="${badgeH}" rx="4" class="node-fill" stroke="${badgeStroke}" stroke-width="2" />
                    <text x="0" y="0" class="${badgeTextColorClass}">${node.id}</text>
                </g>
            `;

            // --- C. Prefight Badge (Bottom) ---
            if (prefightImg && imageCache.has(prefightImg)) {
                const pfBase64 = imageCache.get(prefightImg);
                const pfR = 18; 
                const pfY = r;
                
                innerContent += `
                    <g transform="translate(0, ${pfY})">
                        <circle r="${pfR}" class="node-fill border-prefight" />
                        
                        <circle cx="0" cy="0" r="${pfR-2}" fill="${pfColor}" opacity="0.4" />
                        <g clip-path="url(#clip-${node.id}-PF)">
                            <image href="${pfBase64}" x="${-pfR+2}" y="${-pfR+2}" width="${(pfR-2)*2}" height="${(pfR-2)*2}" preserveAspectRatio="xMidYMid slice" />
                        </g>
                        <defs><clipPath id="clip-${node.id}-PF"><circle cx="0" cy="0" r="${pfR-2}" /></clipPath></defs>
                        <circle cx="0" cy="0" r="${pfR-2}" fill="none" stroke="${pfColor}" stroke-width="1.5" />
                    </g>
                `;
            }

            nodesSvg += `
                <g transform="translate(${x}, ${y})">
                    ${innerContent}
                </g>
            `;
        });

        return `
            <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
                ${styles}
                <rect width="100%" height="100%" fill="#020617" />
                ${nebulasSvg}
                ${starsSvg}
                ${pathsSvg}
                ${nodesSvg}
            </svg>
        `;
    }
}