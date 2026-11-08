import { unstable_cache } from "next/cache";
import type { ChampionClass } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getChampionImageUrl } from "@/lib/championHelper";

export type HomeFeaturedChampion = {
  name: string;
  href: string;
  artworkUrl: string;
  portraitUrl: string;
  championClass: ChampionClass | null;
};

// Editorial previews, not a release feed. Resolve artwork and routes from the
// deployed catalog so an absent champion never becomes a broken homepage link.
const featuredGameIds = ["ghostrider_reyes", "carina_white", "gwenom"];
const isPublicImage = (url: string) => /^https?:\/\//.test(url);

export const getHomeFeaturedChampions = unstable_cache(
  async (): Promise<HomeFeaturedChampion[]> => {
    const champions = await prisma.champion.findMany({
      where: {
        gameId: { in: featuredGameIds },
        isPlayable: true,
        slug: { not: null },
        releaseDate: { lte: new Date() },
      },
      select: { gameId: true, name: true, slug: true, images: true, class: true },
    });

    return featuredGameIds.flatMap((gameId) => {
      const champion = champions.find((row) => row.gameId === gameId);
      if (!champion?.slug) return [];
      const artworkUrl = getChampionImageUrl(champion.images, "full", "hero");
      const portrait = getChampionImageUrl(champion.images, "128");
      if (!isPublicImage(artworkUrl)) return [];
      return [{
        name: champion.name,
        championClass: champion.class ?? null,
        href: `/champions/${champion.slug}`,
        artworkUrl,
        portraitUrl: isPublicImage(portrait) ? portrait : artworkUrl,
      }];
    });
  },
  ["home-featured-champions-v2"],
  { revalidate: 900, tags: ["home", "champions"] },
);
