import { beforeEach, expect, it, vi } from "vitest";

const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany } } }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { getHomeFeaturedChampions } from "./home-featured-champions";

beforeEach(() => { findMany.mockReset(); });

it("projects only curated champion previews with the deployed names, routes, classes and artwork", async () => {
  findMany.mockResolvedValue([
    { gameId: "gwenom", name: "Gwenom", slug: "gwenom", class: "COSMIC", images: { hero: "https://example.com/gwenom.webp", p_128: "https://example.com/gwenom.png" } },
    { gameId: "ironman", name: "Iron Man", slug: "iron-man", images: { hero: "https://example.com/iron-man.webp" } },
    { gameId: "ghostrider_reyes", name: "Ghost Rider (Robbie Reyes)", slug: "ghost-rider-robbie-reyes", class: "MYSTIC", images: { hero: "https://example.com/ghost-rider.webp", p_128: "https://example.com/ghost-rider.png" } },
  ]);

  expect(await getHomeFeaturedChampions()).toEqual([
    { name: "Ghost Rider (Robbie Reyes)", championClass: "MYSTIC", href: "/champions/ghost-rider-robbie-reyes", artworkUrl: "https://example.com/ghost-rider.webp", portraitUrl: "https://example.com/ghost-rider.png" },
    { name: "Gwenom", championClass: "COSMIC", href: "/champions/gwenom", artworkUrl: "https://example.com/gwenom.webp", portraitUrl: "https://example.com/gwenom.png" },
  ]);
});

it("keeps usable artwork fallbacks and omits candidates without a route or real artwork", async () => {
  findMany.mockResolvedValue([
    { gameId: "ghostrider_reyes", name: "Ghost Rider (Robbie Reyes)", slug: null, images: { hero: "https://example.com/ghost-rider.webp" } },
    { gameId: "carina_white", name: "Carina Tivan", slug: "carina-tivan", images: {} },
    { gameId: "gwenom", name: "Gwenom", slug: "gwenom", images: { full_secondary: "https://example.com/gwenom.png" } },
  ]);

  expect(await getHomeFeaturedChampions()).toEqual([
    { name: "Gwenom", championClass: null, href: "/champions/gwenom", artworkUrl: "https://example.com/gwenom.png", portraitUrl: "https://example.com/gwenom.png" },
  ]);
});

it("keeps explicitly unknown class metadata neutral instead of inferring it from the champion", async () => {
  findMany.mockResolvedValue([
    { gameId: "ghostrider_reyes", name: "Ghost Rider (Robbie Reyes)", slug: "ghost-rider-robbie-reyes", class: null, images: { hero: "https://example.com/ghost-rider.webp" } },
  ]);
  expect((await getHomeFeaturedChampions())[0].championClass).toBeNull();
});

it("returns no invented previews when the deployed catalog has no featured candidates", async () => {
  findMany.mockResolvedValue([]);
  expect(await getHomeFeaturedChampions()).toEqual([]);
});
