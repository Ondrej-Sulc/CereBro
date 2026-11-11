import type { Metadata } from "next";
import { Suspense } from "react";
import { ArtworkBrowser } from "@/components/game-artwork/artwork-browser";
export const metadata: Metadata = { title: "Asset library | CereBro", description: "Find native game artwork by name, source and dimensions." };
export default function AssetsPage() {
  return <Suspense fallback={<p className="p-8">Loading asset library…</p>}><ArtworkBrowser /></Suspense>;
}
