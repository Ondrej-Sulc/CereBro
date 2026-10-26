import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import type { RelicBundle } from "./relicCatalogImportService";

type PortraitBundle = Pick<RelicBundle, "assets">;
type PortraitStorage = {
  uploadImmutableBuffer(
    bytes: Buffer,
    destination: string,
    contentType: string,
  ): Promise<string>;
};
export type RelicPortraitUrls = Readonly<Record<string, string>>;
const checksum = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

export function relicPortraitObjectPath(asset: RelicBundle["assets"][number]) {
  if (!/^[a-z0-9_]+$/i.test(asset.name) || !/^[a-f0-9]{64}$/.test(asset.sha256))
    throw new Error("Invalid relic portrait identity");
  return `relics/${asset.name}/${asset.sha256}.png`;
}

/** Require source-bound cloud references before the importer can publish rows. */
export function validateRelicPortraitUrls(
  bundle: PortraitBundle,
  urls: RelicPortraitUrls,
) {
  for (const asset of bundle.assets) {
    let url: URL;
    try {
      url = new URL(urls[asset.name]);
    } catch {
      throw new Error(`Missing or invalid cloud portrait URL: ${asset.name}`);
    }
    const segments = url.pathname.split("/");
    if (
      url.protocol !== "https:" ||
      url.hostname !== "storage.googleapis.com" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !segments[1] ||
      segments.slice(2).join("/") !== relicPortraitObjectPath(asset)
    )
      throw new Error(`Unrelated cloud portrait URL: ${asset.name}`);
  }
}

/** Preserve the verified PNGs; browser resizing/format selection uses Next Image,
 * just like champion portraits. No local public-directory copies are required.
 */
export async function publishRelicPortraits(
  bundle: PortraitBundle,
  storage: PortraitStorage,
  fetchImage: typeof fetch = fetch,
): Promise<RelicPortraitUrls> {
  const plans = [];
  for (const asset of bundle.assets) {
    const destination = relicPortraitObjectPath(asset);
    const bytes = await fs.readFile(asset.file);
    if (checksum(bytes) !== asset.sha256)
      throw new Error(
        `Portrait changed after package validation: ${asset.name}`,
      );
    plans.push({ asset, destination, bytes });
  }
  const urls: Record<string, string> = {};
  // Four disjoint objects at a time; a failure prevents any database update.
  for (let start = 0; start < plans.length; start += 4) {
    const batch = await Promise.all(
      plans
        .slice(start, start + 4)
        .map(async ({ asset, destination, bytes }) => {
          const url = await storage.uploadImmutableBuffer(
            bytes,
            destination,
            "image/png",
          );
          validateRelicPortraitUrls({ assets: [asset] }, { [asset.name]: url });
          const response = await fetchImage(url, {
            signal: AbortSignal.timeout(30000),
          });
          if (!response.ok)
            throw new Error(
              `Cloud portrait not publicly accessible: ${asset.name} (${response.status})`,
            );
          if (
            checksum(new Uint8Array(await response.arrayBuffer())) !==
            asset.sha256
          )
            throw new Error(`Public portrait hash mismatch: ${asset.name}`);
          return { name: asset.name, url };
        }),
    );
    for (const { name, url } of batch) urls[name] = url;
  }
  return urls;
}
