import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type ChampionLookupOption = { name: string; slug: string };

// A public navigation index. Keep kits, artwork and personal roster data out of
// this response; the homepage requests it only when the lookup is opened.
export const getChampionLookupOptions = unstable_cache(
  async (): Promise<ChampionLookupOption[]> => {
    const rows = await prisma.champion.findMany({
      where: { isPlayable: true, slug: { not: null, notIn: [""] } },
      select: { name: true, slug: true },
      orderBy: { name: "asc" },
    });
    return rows.flatMap(({ name, slug }) => name.trim() && slug?.trim() ? [{ name, slug }] : []);
  },
  ["public-champion-lookup-v1"],
  { revalidate: 900, tags: ["champions", "champion-details"] },
);
