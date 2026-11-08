import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export type HomeFeaturedRelic = {
  name: string;
  href: string;
  type: "battlecast" | "statcast";
  artworkUrl: string;
};

const candidates = [
  { id: "relic_gambit_offense", type: "battlecast" },
  { id: "relic_statcast_hulkling_bprf", type: "statcast" },
] as const;

// Small editorial examples, independent of inventory and compatibility rules.
// Resolve both from the deployed catalog rather than pinning a guessed route.
export const getHomeFeaturedRelics = unstable_cache(
  async (): Promise<HomeFeaturedRelic[]> => {
    const relics = await prisma.gameRelic.findMany({
      where: { isCurrent: true, id: { in: candidates.map(({ id }) => id) } },
      select: { id: true, name: true, slug: true, type: true, portraitPath: true },
      take: candidates.length,
    });

    return candidates.flatMap(({ id, type }) => {
      const relic = relics.find((row) => row.id === id);
      if (!relic?.slug || relic.type !== type || !/^https?:\/\//.test(relic.portraitPath)) return [];
      return [{ name: relic.name, href: `/relics/${relic.slug}`, type, artworkUrl: relic.portraitPath }];
    });
  },
  ["home-featured-relics-v1"],
  { revalidate: 900, tags: ["home", "relics"] },
);
