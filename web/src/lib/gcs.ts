import { Storage } from "@google-cloud/storage";
import logger from "@/lib/logger";

interface GcsCredentials {
    project_id: string;
    client_email: string;
    private_key: string;
}

// Load and decode credentials once
let storage: Storage | null = null;
const bucketName = process.env.GCS_BUCKET_NAME || "champion-images";

function getStorage() {
    if (storage) return storage;

    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!credentialsJson) {
        throw new Error("Missing GOOGLE_CREDENTIALS_JSON environment variable");
    }

    try {
        const decodedCredentialsString = Buffer.from(credentialsJson, "base64").toString("utf8");
        const credentials = JSON.parse(decodedCredentialsString) as GcsCredentials;

        storage = new Storage({
            credentials: {
                client_email: credentials.client_email,
                private_key: credentials.private_key,
            },
            projectId: credentials.project_id,
        });
        return storage;
    } catch (error) {
        logger.error({ err: error }, "Error loading or parsing Google credentials");
        throw new Error("Failed to initialize GCS storage");
    }
}

/**
 * Uploads a file to GCS and returns the public URL.
 */
export async function uploadToGcs(
    buffer: Buffer,
    destinationPath: string,
    contentType: string = "image/png"
): Promise<string> {
    const s = getStorage();
    const file = s.bucket(bucketName).file(destinationPath);

    await file.save(buffer, {
        contentType,
        metadata: {
            cacheControl: 'public, max-age=31536000',
        }
    });

    return `https://storage.googleapis.com/${encodeURIComponent(bucketName)}/${destinationPath.split('/').map(encodeURIComponent).join('/')}`;
}

function isNotFoundError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const code = (err as Record<string, unknown>).code;
    return code === 404 || code === '404';
}

/**
 * Deletes a file from GCS.
 */
export async function deleteFromGcs(path: string): Promise<void> {
    const s = getStorage();
    const file = s.bucket(bucketName).file(path);
    try {
        await file.delete();
    } catch (error: unknown) {
        // Ignore if file doesn't exist (404)
        if (isNotFoundError(error)) {
            return;
        }
        logger.error({ err: error, path }, "Failed to delete object from GCS");
        throw error;
    }
}
