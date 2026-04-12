export interface ParsedTimestamp {
    seconds: number;
    label: string;
    videoUrl: string;
}

// Matches optional hours + MM:SS at the start of a trimmed line
const TIMESTAMP_RE = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:\s+(.*))?$/;

export function extractYouTubeVideoId(url: string): string | null {
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') {
            return u.pathname.slice(1).split('?')[0] || null;
        }
        if (u.hostname === 'youtube.com' || u.hostname === 'www.youtube.com') {
            return u.searchParams.get('v');
        }
    } catch {
        // not a valid URL
    }
    return null;
}

export function buildTimestampedUrl(videoId: string, seconds: number): string {
    return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
}

/**
 * Parses a YouTube description or chapter list into timestamped video URLs.
 * Returns null if the base URL is not a valid YouTube URL or no timestamps were found.
 */
export function parseTimestamps(text: string, baseUrl: string): ParsedTimestamp[] | null {
    const videoId = extractYouTubeVideoId(baseUrl);
    if (!videoId) return null;

    const results: ParsedTimestamp[] = [];
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;
        const match = line.match(TIMESTAMP_RE);
        if (!match) continue;
        const [, hours, minutes, secs, label = ''] = match;
        const s = (parseInt(hours || '0') * 3600) + (parseInt(minutes) * 60) + parseInt(secs);
        results.push({
            seconds: s,
            label: label.trim(),
            videoUrl: buildTimestampedUrl(videoId, s),
        });
    }

    return results.length > 0 ? results : null;
}
