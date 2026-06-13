import type { MetadataRoute } from "next";
import { getManifestIcons } from "@/lib/app-icons";

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
    icons: getManifestIcons(),
  };
}
