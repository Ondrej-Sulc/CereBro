import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CereBro",
    short_name: "CereBro",
    description:
      "CereBro is a comprehensive management platform for MCOC Alliances.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
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
    ],
  };
}
