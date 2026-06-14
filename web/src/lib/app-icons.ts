import type { Metadata, MetadataRoute } from "next";

function isBetaEnvironment(): boolean {
  const explicitEnv = [
    process.env.NEXT_PUBLIC_APP_ENV,
    process.env.APP_ENV,
    process.env.RAILWAY_ENVIRONMENT_NAME,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());

  if (explicitEnv.some((value) => ["beta", "dev", "preview", "staging"].includes(value))) {
    return true;
  }

  return process.env.VERCEL_ENV === "preview" || process.env.RAILWAY_GIT_BRANCH === "dev";
}

const productionMetadataIcons = {
  icon: [
    { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { url: "/CereBro_logo_512.png", sizes: "512x512", type: "image/png" },
  ],
  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  shortcut: ["/icon-192.png"],
} satisfies Metadata["icons"];

const betaMetadataIcons = {
  icon: [
    { url: "/icon-dev-192.png", sizes: "192x192", type: "image/png" },
    { url: "/CereBro_Dev_512.png", sizes: "512x512", type: "image/png" },
  ],
  apple: [{ url: "/apple-touch-icon-dev.png", sizes: "180x180", type: "image/png" }],
  shortcut: ["/icon-dev-192.png"],
} satisfies Metadata["icons"];

const productionManifestIcons = [
  {
    src: "/icon-192.png",
    sizes: "192x192",
    type: "image/png",
  },
  {
    src: "/CereBro_logo_512.png",
    sizes: "512x512",
    type: "image/png",
  },
] satisfies MetadataRoute.Manifest["icons"];

const betaManifestIcons = [
  {
    src: "/icon-dev-192.png",
    sizes: "192x192",
    type: "image/png",
  },
  {
    src: "/CereBro_Dev_512.png",
    sizes: "512x512",
    type: "image/png",
  },
] satisfies MetadataRoute.Manifest["icons"];

export function getMetadataIcons(): Metadata["icons"] {
  return isBetaEnvironment() ? betaMetadataIcons : productionMetadataIcons;
}

export function getManifestIcons(): MetadataRoute.Manifest["icons"] {
  return isBetaEnvironment() ? betaManifestIcons : productionManifestIcons;
}
