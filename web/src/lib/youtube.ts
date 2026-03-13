/**
 * Extracts the YouTube video ID and start time (if present) from a given URL
 * and returns a formatted embed URL.
 * 
 * @param url The YouTube URL (watch, short, embed, etc.)
 * @returns A YouTube embed URL or null if invalid
 */
export function getYoutubeEmbedUrl(url: string | null): string | null {
    if (!url) return null;

    // Extract video ID
    // Regex covers: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, etc.
    const idRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const idMatch = url.match(idRegExp);
    const videoId = (idMatch && idMatch[2].length === 11) ? idMatch[2] : null;

    if (!videoId) {
        // Fallback for cases where the ID might just be in the path
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://` + url);
            const pathSegments = urlObj.pathname.split('/');
            const potentialId = pathSegments[pathSegments.length - 1];
            if (potentialId && potentialId.length === 11) {
                return buildEmbedUrl(potentialId, url);
            }
        } catch {
            return null;
        }
        return null;
    }

    return buildEmbedUrl(videoId, url);
}

/**
 * Helper to build the embed URL with timestamp support
 */
function buildEmbedUrl(videoId: string, originalUrl: string): string {
    let embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;

    // Extract timestamp (t= parameter)
    const timeMatch = originalUrl.match(/[?&]t=([0-9hms]+)/);
    if (timeMatch) {
        const timeStr = timeMatch[1];
        let seconds = 0;

        // Handle formats like 1h2m3s, 2m30s, 90s, or just 90
        const hMatch = timeStr.match(/(\d+)h/);
        const mMatch = timeStr.match(/(\d+)m/);
        const sMatch = timeStr.match(/(\d+)s/);
        const pureSecondsMatch = timeStr.match(/^(\d+)$/);

        if (hMatch) seconds += parseInt(hMatch[1]) * 3600;
        if (mMatch) seconds += parseInt(mMatch[1]) * 60;
        if (sMatch) seconds += parseInt(sMatch[1]);
        if (pureSecondsMatch) seconds += parseInt(pureSecondsMatch[1]);

        if (seconds > 0) {
            embedUrl += `&start=${seconds}`;
        }
    }

    return embedUrl;
}

/**
 * Only extracts the video ID
 */
export function getYoutubeVideoId(url: string | null): string | null {
    if (!url) return null;
    const idRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const idMatch = url.match(idRegExp);
    const videoId = (idMatch && idMatch[2].length === 11) ? idMatch[2] : null;

    if (!videoId) {
        try {
            const urlObj = new URL(url.startsWith('http') ? url : `https://` + url);
            const pathSegments = urlObj.pathname.split('/');
            const potentialId = pathSegments[pathSegments.length - 1];
            if (potentialId && potentialId.length === 11) return potentialId;
        } catch {
            return null;
        }
    }
    return videoId;
}
