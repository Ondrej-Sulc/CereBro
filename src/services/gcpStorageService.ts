import { Storage } from "@google-cloud/storage";
import { config } from "../config";

class GcpStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    this.storage = new Storage({
      credentials: {
        client_email: config.GOOGLE_CREDENTIALS.client_email,
        private_key: config.GOOGLE_CREDENTIALS.private_key,
      },
      projectId: config.GOOGLE_CREDENTIALS.project_id,
    });

    this.bucketName = config.GCS_BUCKET_NAME || "champion-images";
  }

  async uploadBuffer(buffer: Buffer, destinationPath: string): Promise<string> {
    const file = this.storage.bucket(this.bucketName).file(destinationPath);
    await file.save(buffer);
    const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${destinationPath}`;
    return publicUrl;
  }

  /** Content-addressed assets must never replace a different stored object. */
  async uploadImmutableBuffer(
    buffer: Buffer,
    destinationPath: string,
    contentType: string,
  ): Promise<string> {
    const file = this.storage.bucket(this.bucketName).file(destinationPath);
    try {
      await file.save(buffer, {
        contentType,
        metadata: { cacheControl: "public, max-age=31536000, immutable" },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    } catch (error: unknown) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        (error.code !== 412 && error.code !== "412")
      )
        throw error;
      const [existing] = await file.download();
      if (!existing.equals(buffer))
        throw new Error(
          `Cloud image already exists with different bytes: ${destinationPath}`,
        );
    }
    return `https://storage.googleapis.com/${encodeURIComponent(this.bucketName)}/${destinationPath.split("/").map(encodeURIComponent).join("/")}`;
  }

  async uploadJson(data: unknown, destinationPath: string): Promise<void> {
    if (data === undefined) {
      throw new Error("Cannot upload undefined as JSON");
    }
    const file = this.storage.bucket(this.bucketName).file(destinationPath);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: "application/json",
    });
  }

  /**
   * Downloads and parses a JSON file from GCS.
   * Note: This method performs an unchecked cast to T.
   * Callers are responsible for ensuring the stored JSON matches the expected shape.
   */
  async downloadJson<T>(path: string): Promise<T> {
    const file = this.storage.bucket(this.bucketName).file(path);
    const [content] = await file.download();
    return JSON.parse(content.toString("utf8")) as T;
  }

  async downloadBuffer(path: string): Promise<Buffer> {
    const file = this.storage.bucket(this.bucketName).file(path);
    const [content] = await file.download();
    return content;
  }
}

export const gcpStorageService = new GcpStorageService();
