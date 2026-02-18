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

  async uploadBuffer(
    buffer: Buffer,
    destinationPath: string
  ): Promise<string> {
    const file = this.storage.bucket(this.bucketName).file(destinationPath);
    await file.save(buffer);
    const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${destinationPath}`;
    return publicUrl;
  }

  async uploadJson(
    data: any,
    destinationPath: string
  ): Promise<void> {
    const file = this.storage.bucket(this.bucketName).file(destinationPath);
    await file.save(JSON.stringify(data, null, 2), {
      contentType: "application/json",
    });
  }

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
