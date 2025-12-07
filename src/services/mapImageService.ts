import sharp from 'sharp';
import { WarNodePosition, LAYOUT, LAYOUT_BIG } from '../data/war-planning/nodes-data';
import { WarMapType } from '@prisma/client';
import logger from './loggerService';

export interface NodeAssignment {
    defenderName?: string;
    defenderImage?: string;
    attackerImage?: string;
    isTarget: boolean; // True if assigned to the player receiving the plan
    type?: 'attack' | 'prefight';
}

export class MapImageService {
    private static readonly BACKGROUND_COLOR_START = '#0f172a'; // slate-950
    private static readonly BACKGROUND_COLOR_END = '#020617'; // slate-950 (darker)
    private static readonly LINE_COLOR = '#334155'; // slate-700
    private static readonly NODE_COLOR = '#1e293b'; // slate-800
    private static readonly TEXT_COLOR = '#94a3b8'; // slate-400
    
    private static readonly HIGHLIGHT_GLOW = '#0ea5e9'; // sky-500
    private static readonly HIGHLIGHT_BORDER = '#38bdf8'; // sky-400
    private static readonly HIGHLIGHT_PREFIGHT = '#c084fc'; // purple-400
    private static readonly HIGHLIGHT_TEXT = '#ffffff'; // white

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
        
        // Define styles
        const styles = `
            <style>
                .path { stroke: ${this.LINE_COLOR}; stroke-width: 8; fill: none; opacity: 0.5; stroke-linecap: round; }
                .node-base { fill: ${this.NODE_COLOR}; stroke: ${this.LINE_COLOR}; stroke-width: 4; }
                .node-text { font-family: sans-serif; font-weight: bold; font-size: 32px; fill: ${this.TEXT_COLOR}; text-anchor: middle; text-shadow: 0px 2px 4px rgba(0,0,0,0.8); }
                
                .highlight-path { stroke: ${this.HIGHLIGHT_GLOW}; stroke-width: 12; opacity: 0.9; }
                .highlight-node { stroke: ${this.HIGHLIGHT_BORDER}; stroke-width: 6; filter: url(#glow); }
                .highlight-prefight { stroke: ${this.HIGHLIGHT_PREFIGHT}; stroke-width: 6; filter: url(#glow); }
                .highlight-text { fill: ${this.HIGHLIGHT_TEXT}; font-size: 36px; }
                
                /* Portal Text Styling */
                .portal-text { font-family: monospace; font-size: 24px; fill: #64748b; text-anchor: middle; opacity: 0.8; }
            </style>
            <defs>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="8" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <radialGradient id="bgGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                    <stop offset="0%" stop-color="${this.BACKGROUND_COLOR_START}" />
                    <stop offset="100%" stop-color="${this.BACKGROUND_COLOR_END}" />
                </radialGradient>
            </defs>
        `;

        // Build Paths (Connections)
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
                        // Adjust coordinates relative to bounding box
                        const x1 = node.x - offsetX;
                        const y1 = node.y - offsetY;
                        const x2 = target.x - offsetX;
                        const y2 = target.y - offsetY;

                        // Heuristic for highlighting path: if both ends are assigned to player (and represent a path they might travel)
                        // Only highlight path for 'attack' types, not prefights (usually you don't "travel" to a prefight in the same way, or maybe you do?)
                        // For simplicity, let's keep it based on 'isTarget'.
                        const startAssigned = assignments.get(Number(node.id))?.isTarget;
                        const endAssigned = assignments.get(Number(target.id))?.isTarget;
                        
                        const isHighlighted = startAssigned && endAssigned;
                        const className = isHighlighted ? "path highlight-path" : "path";
                        
                        pathsSvg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${className}" />\n`;
                        drawnPaths.add(key);
                    }
                }
            });
        });

        // Build Nodes
        let nodesSvg = '';
        
        nodes.forEach(node => {
            const x = node.x - offsetX;
            const y = node.y - offsetY;
            
            if (node.isPortal) return; 

            const assignment = assignments.get(Number(node.id));
            const isHighlighted = assignment?.isTarget;
            const borderColor = assignment?.type === 'prefight' ? this.HIGHLIGHT_PREFIGHT : this.HIGHLIGHT_BORDER;
            
            const circleClass = isHighlighted 
                ? (assignment?.type === 'prefight' ? "node-base highlight-prefight" : "node-base highlight-node") 
                : "node-base";
                
            const textClass = isHighlighted ? "node-text highlight-text" : "node-text";
            const radius = 40; // Smaller radius

            let innerContent = '';
            
            // Case 1: Pill (Attacker + Defender)
            if (assignment?.attackerImage && assignment?.defenderImage && 
                imageCache.has(assignment.attackerImage) && imageCache.has(assignment.defenderImage)) {
                
                const attImg = imageCache.get(assignment.attackerImage);
                const defImg = imageCache.get(assignment.defenderImage);
                const pillW = 160; 
                const pillH = 80;
                
                // 1. Pill Background & Border
                innerContent += `
                    <rect x="${-pillW/2}" y="${-pillH/2}" width="${pillW}" height="${pillH}" rx="${pillH/2}" class="${circleClass}" />
                `;
                
                // 2. Images
                // Attacker (Left)
                innerContent += `
                    <defs>
                        <clipPath id="clip-${node.id}-L">
                            <circle cx="${-pillW/4}" cy="0" r="${radius-4}" />
                        </clipPath>
                    </defs>
                    <g clip-path="url(#clip-${node.id}-L)">
                        <image href="${attImg}" x="${-pillW/4 - radius}" y="${-radius}" width="${radius*2}" height="${radius*2}" preserveAspectRatio="xMidYMid slice" />
                    </g>
                `;

                // Defender (Right)
                innerContent += `
                    <defs>
                        <clipPath id="clip-${node.id}-R">
                            <circle cx="${pillW/4}" cy="0" r="${radius-4}" />
                        </clipPath>
                    </defs>
                    <g clip-path="url(#clip-${node.id}-R)">
                        <image href="${defImg}" x="${pillW/4 - radius}" y="${-radius}" width="${radius*2}" height="${radius*2}" preserveAspectRatio="xMidYMid slice" />
                    </g>
                `;

                // 3. Pill Border (Stroke only) - Drawn ON TOP
                const borderStyle = isHighlighted 
                    ? `stroke="${borderColor}" stroke-width="8" filter="url(#glow)" fill="none"`
                    : `stroke="${this.LINE_COLOR}" stroke-width="4" fill="none"`;

                innerContent += `
                    <rect x="${-pillW/2}" y="${-pillH/2}" width="${pillW}" height="${pillH}" rx="${pillH/2}" ${borderStyle} />
                `;

            } 
            // Case 2: Circle (Defender only or empty)
            else {
                if (assignment?.defenderImage && imageCache.has(assignment.defenderImage)) {
                    const base64 = imageCache.get(assignment.defenderImage);
                    innerContent = `
                        <defs>
                            <clipPath id="clip-${node.id}">
                                <circle cx="0" cy="0" r="${radius-4}" />
                            </clipPath>
                        </defs>
                        <g clip-path="url(#clip-${node.id})">
                            <image href="${base64}" x="${-radius}" y="${-radius}" width="${radius*2}" height="${radius*2}" preserveAspectRatio="xMidYMid slice" opacity="0.9" />
                        </g>
                        <circle r="${radius}" fill="none" stroke="${isHighlighted ? borderColor : this.LINE_COLOR}" stroke-width="${isHighlighted ? 6 : 4}" />
                    `;
                } else {
                    innerContent = `<circle r="${radius}" class="${circleClass}" />`;
                }
                // Text CENTERED
                innerContent += `<text x="0" y="10" class="${textClass}">${node.id}</text>`;
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
                <rect width="100%" height="100%" fill="url(#bgGradient)" />
                ${pathsSvg}
                ${nodesSvg}
            </svg>
        `;
    }
}