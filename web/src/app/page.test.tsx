import type { ImgHTMLAttributes } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { beforeEach, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ auth: vi.fn(), player: vi.fn(), champions: vi.fn(), relics: vi.fn(), counts: { players: 120, alliances: 12, rosters: 12345, videos: 500 } }));
vi.mock("@/auth", () => ({ auth: boundary.auth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth-helpers", () => ({ getUserPlayerWithAlliance: boundary.player }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  player: { count: async () => boundary.counts.players }, alliance: { count: async () => boundary.counts.alliances },
  roster: { count: async () => boundary.counts.rosters }, warVideo: { count: async () => boundary.counts.videos },
  champion: { findMany: boundary.champions },
  gameRelic: { findMany: boundary.relics },
} }));
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
  const imageProps = { ...props };
  delete imageProps.fill;
  delete imageProps.priority;
  return createElement("img", { alt: "", ...imageProps });
} }));
vi.mock("@/app/actions/auth", () => ({ signInAction: vi.fn() }));
vi.mock("@/components/PageBackground", () => ({ default: () => null }));
vi.mock("@/components/Header", () => ({ default: () => <header aria-label="Site header" /> }));
vi.mock("@/components/UserButton", () => ({ UserButton: () => null }));
vi.mock("@/components/layout/conditional-footer", () => ({ default: () => null }));
vi.mock("@/components/PostHogIdentity", () => ({ PostHogIdentity: () => null }));
vi.mock("@/lib/app-version", () => ({ getAppVersion: () => "test" }));

import Home, { metadata } from "./page";
import { MainLayout } from "@/components/layout/main-layout";

async function renderHome() {
  const application = await MainLayout({ children: await Home() });
  return new JSDOM(renderToStaticMarkup(application)).window.document;
}

beforeEach(() => {
  boundary.auth.mockResolvedValue(null);
  boundary.player.mockResolvedValue(null);
  Object.assign(boundary.counts, { players: 120, alliances: 12, rosters: 12345, videos: 500 });
  boundary.champions.mockResolvedValue([
    { gameId: "ghostrider_reyes", name: "Ghost Rider (Robbie Reyes)", slug: "ghost-rider-robbie-reyes", class: "MYSTIC", images: { hero: "https://storage.googleapis.com/champion-images/test/ghost-rider-hero.webp", p_128: "https://storage.googleapis.com/champion-images/test/ghost-rider.png" } },
    { gameId: "carina_white", name: "Carina Tivan", slug: "carina-tivan", class: "COSMIC", images: { hero: "https://storage.googleapis.com/champion-images/test/carina-hero.webp", p_128: "https://storage.googleapis.com/champion-images/test/carina.png" } },
    { gameId: "gwenom", name: "Gwenom", slug: "gwenom", class: "COSMIC", images: { hero: "https://storage.googleapis.com/champion-images/test/gwenom-hero.webp", p_128: "https://storage.googleapis.com/champion-images/test/gwenom.png" } },
  ]);
  boundary.relics.mockResolvedValue([
    { id: "relic_gambit_offense", name: "Gambit Battlecast", slug: "gambit-offense", type: "battlecast", portraitPath: "https://storage.googleapis.com/champion-images/test/gambit.png" },
    { id: "relic_statcast_hulkling_bprf", name: "Hulkling Statcast", slug: "statcast-hulkling-bprf", type: "statcast", portraitPath: "https://storage.googleapis.com/champion-images/test/hulkling.png" },
  ]);
});

it.each([
  { state: "guest", signedIn: false, player: null, canPlan: false },
  { state: "signed in without an alliance", signedIn: true, player: { allianceId: null, isBotAdmin: false }, canPlan: false },
  { state: "alliance member", signedIn: true, player: { allianceId: "alliance-1", isBotAdmin: false }, canPlan: true },
  { state: "bot admin", signedIn: true, player: { allianceId: null, isBotAdmin: true }, canPlan: true },
])("keeps war planning and Discord primary with a useful first action for $state", async ({ signedIn, player, canPlan }) => {
  boundary.auth.mockResolvedValue(signedIn ? { user: { id: "user-1" } } : null);
  boundary.player.mockResolvedValue(player ? { ...player, id: "player-1", permissions: [], isOfficer: false, alliance: null } : null);
  const document = await renderHome();
  const links = [...document.querySelectorAll<HTMLAnchorElement>("main a")];
  for (const destination of ["/champions?view=catalog", "/champions/ghost-rider-robbie-reyes", "/champions/carina-tivan", "/champions/gwenom", "/crystals", "/crystals/champions", "/crystals/champions?reward=ascension&rarity=7", "/relics?view=catalog"]) {
    const link = links.find(item => item.getAttribute("href") === destination);
    expect(link, destination).toBeDefined();
    expect(link!.textContent?.trim().length).toBeGreaterThan(5);
  }
  expect(document.querySelector('a[href="/champions"]')).toBeNull();
  expect(document.querySelector('a[href="/relics"]')).toBeNull();
  const sections = [...document.querySelectorAll("main > div > section")];
  expect(sections.findIndex(section => section.id === "web-platform")).toBeLessThan(sections.findIndex(section => section.id === "explore"));
  const hero = sections[0];
  expect(hero.querySelector("h1")?.textContent).toBe("The Ultimate MCOCTactical Advantage");
  expect(hero.textContent).toContain("Plan Alliance Wars");
  expect(hero.textContent).toContain("assignments in Discord");
  expect(hero.textContent).toContain("Free to use");
  expect(hero.querySelector("a")?.getAttribute("href")).toBe(canPlan ? "/planning" : "#setup");
  expect(hero.querySelector("a")?.textContent).toContain(canPlan ? "Open War Planner" : "Set up your alliance");
  const exploreAction = [...hero.querySelectorAll("a")].find(link => link.textContent?.trim() === "Explore game tools");
  expect(exploreAction?.getAttribute("href")).toBe("#explore");
  expect(hero.querySelector('a[href^="https://discord.com/oauth2/authorize"]')).toBeNull();
  expect(document.body.textContent).toContain("Kit overview");
  expect(document.body.textContent).toContain("How to obtain");
  expect(document.body.textContent).toContain("Battlecasts");
  expect(document.body.textContent).toContain("Statcasts");
  expect(document.body.textContent).toContain("recorded category rates");
  expect(document.body.textContent).toContain("historical");
  expect(document.body.textContent).toContain("Champions tracked");
  expect([...hero.querySelectorAll("button")].some(button => button.textContent?.includes("Sign in with Discord"))).toBe(!signedIn);
});

it("places live community counters directly below the hero and preserves exact counts accessibly", async () => {
  Object.assign(boundary.counts, { players: 18765, alliances: 806, rosters: 1234567, videos: 11003 });
  const document = await renderHome();
  const sections = [...document.querySelectorAll("main > div > section")];
  expect(sections[1].getAttribute("aria-labelledby")).toBe("community-stats-title");
  expect(document.querySelectorAll("#community-stats-title")).toHaveLength(1);
  const counters = [...sections[1].querySelectorAll("dl > div")];
  expect(counters.map(counter => counter.querySelector("dt")?.textContent)).toEqual(["Players", "Alliances", "Champions tracked", "War videos"]);
  expect(counters.map(counter => counter.querySelector("dd")?.textContent)).toEqual(["18K+", "806", "1M+", "11K+"]);
  expect(counters.map(counter => counter.querySelector("dd")?.getAttribute("aria-label"))).toEqual(["18,765", "806", "1,234,567", "11,003"]);

  Object.assign(boundary.counts, { players: 0, alliances: 9999, rosters: 10000, videos: 999999 });
  const updated = await renderHome();
  expect([...updated.querySelectorAll('section[aria-labelledby="community-stats-title"] dd')].map(counter => counter.textContent)).toEqual(["0", "9,999", "10K+", "999K+"]);
});

it("uses functional headings and keeps the catalog usable when featured champions are unavailable", async () => {
  boundary.champions.mockResolvedValue([]);
  boundary.relics.mockResolvedValue([]);
  const document = await renderHome();
  expect(document.querySelector("#operations-title")?.textContent).toBe("War planning & Discord");
  expect(document.querySelector("#explore-title")?.textContent).toBe("Champions, crystals & relics");
  expect(document.querySelector("#setup-title")?.textContent).toBe("Alliance setup");
  expect(document.querySelector('#explore a[href="/champions?view=catalog"]')).not.toBeNull();
  expect(document.querySelectorAll('#explore a[href^="/champions/"]')).toHaveLength(0);
  expect(document.querySelectorAll('#explore img[src*="iron_man"]')).toHaveLength(0);
  expect(document.body.textContent).not.toContain("Get to know your next move");
  expect(document.querySelector("#explore")?.textContent).toContain("Kit overview");
  expect(document.querySelector('ul[aria-label="Champion page sections"] a')).toBeNull();
  expect(document.querySelector('#explore a[href="/relics?view=catalog"]')).not.toBeNull();
  expect(document.querySelectorAll('#explore a[href^="/relics/"]')).toHaveLength(0);
});

it("links champion topics to the first featured champion's real tabs and shows both relic types", async () => {
  const document = await renderHome();
  const topicLinks = [...document.querySelectorAll<HTMLAnchorElement>('ul[aria-label="Ghost Rider (Robbie Reyes) detail sections"] a')];
  expect(topicLinks.map(link => [link.textContent, link.getAttribute("href")])).toEqual([
    ["Kit overview", "/champions/ghost-rider-robbie-reyes?tab=overview"],
    ["Full abilities", "/champions/ghost-rider-robbie-reyes?tab=abilities"],
    ["Synergies", "/champions/ghost-rider-robbie-reyes?tab=synergies"],
    ["Stats & attacks", "/champions/ghost-rider-robbie-reyes?tab=stats"],
    ["How to obtain", "/champions/ghost-rider-robbie-reyes?tab=crystals"],
  ]);
  for (const link of topicLinks) expect(link.getAttribute("aria-label")).toContain("Ghost Rider (Robbie Reyes)");
  expect(document.querySelector('a[href="/relics/gambit-offense"]')?.textContent).toBe("Battlecast");
  expect(document.querySelector('a[href="/relics/statcast-hulkling-bprf"]')?.textContent).toBe("Statcast");
  expect(document.querySelector('a[href="/relics/gambit-offense"] img')?.getAttribute("src")).toContain("gambit.png");
  expect(document.querySelector('a[href="/relics/statcast-hulkling-bprf"] img')?.getAttribute("src")).toContain("hulkling.png");
  const card = [...document.querySelectorAll("#explore article")].find(article => article.querySelector("h3")?.textContent === "Champion pages");
  expect(card?.querySelectorAll("h3")).toHaveLength(1);
});

it("offers champion page lookup separately from acquisition sources", async () => {
  const document = await renderHome();
  const label = [...document.querySelectorAll("label")].find(item => item.textContent === "Search champion pages");
  const lookup = document.getElementById(label!.htmlFor);
  expect(lookup?.getAttribute("role")).toBe("combobox");
  expect(lookup?.getAttribute("aria-expanded")).toBe("false");
  expect(document.querySelector('#explore a[href="/champions?view=catalog"]')).not.toBeNull();
  const acquisition = [...document.querySelectorAll("#explore article")].find(article => article.querySelector("h3")?.textContent === "How to get a champion");
  expect(acquisition?.querySelector('a[href="/crystals/champions"]')?.textContent?.trim()).toBe("Find sources");
  expect(acquisition?.querySelector('a[href="/crystals/champions?reward=ascension&rarity=7"]')).not.toBeNull();
});

it("retains planning, roster, bot, setup and supporter entry points and describes the full site in metadata", async () => {
  const document = await renderHome();
  for (const destination of ["/planning/quests", "/planning", "/war-videos", "/profile/roster", "/alliance/roster", "/commands", "/support"]) {
    expect(document.querySelector(`a[href="${destination}"]`), destination).not.toBeNull();
  }
  expect(document.querySelector("#discord-bot")).not.toBeNull();
  expect(document.querySelector("#setup")).not.toBeNull();
  expect(document.body.textContent).toContain("Join Community Discord");
  expect(document.body.textContent).toContain("Add to Your Server");
  expect(metadata.description).toMatch(/champion/i);
  expect(metadata.description).toMatch(/crystal/i);
  expect(metadata.description).toMatch(/relic/i);
  expect(document.body.textContent).toContain("AQ check-ins");
  expect(document.body.textContent).toContain("Check in your Alliance Quest progress");
  expect(document.querySelector('#setup a[href="/alliance/onboarding"]')).not.toBeNull();
  expect(document.querySelector('#setup a[href="/alliance"]')).not.toBeNull();
  expect(document.querySelector("#setup")?.textContent).toContain("Officers approve join requests");
  expect(document.querySelector("#setup")?.textContent).toContain("link its Discord server");
  expect(document.querySelectorAll("#faq details").length).toBeGreaterThan(0);
  expect(document.body.textContent).not.toContain("within 24 hours");
});

it("uses the application's single main landmark for all homepage content", async () => {
  const document = await renderHome();
  expect(document.querySelectorAll("main")).toHaveLength(1);
  expect(document.querySelector("main main")).toBeNull();
  const main = document.querySelector("main");
  expect(document.querySelector("#home-title")?.closest("main")).toBe(main);
  expect(document.querySelector("#explore")?.closest("main")).toBe(main);
  expect(document.querySelector("#setup")?.closest("main")).toBe(main);
  expect(document.querySelector("#faq")?.closest("main")).toBe(main);
});

it("distinguishes officer setup from member joining while retaining both officer entry paths", async () => {
  const document = await renderHome();
  const cards = [...document.querySelectorAll("#setup article")];
  const officers = cards.find(card => card.querySelector("h3")?.textContent === "For officers");
  const members = cards.find(card => card.querySelector("h3")?.textContent === "For members");
  expect(officers?.querySelector('a[href^="https://discord.com/oauth2/authorize"]')).not.toBeNull();
  expect(officers?.querySelector('a[href="/alliance/onboarding"]')).not.toBeNull();
  expect(officers?.textContent).toContain("configure roles and channels");
  expect(members?.querySelector('a[href="/alliance/onboarding"]')?.textContent).toContain("Request to join");
  expect(members?.textContent).toContain("role sync");
  expect(members?.textContent).toContain("Officers approve join requests");
  expect(members?.querySelector('a[href^="https://discord.com/oauth2/authorize"]')).toBeNull();
  expect(document.querySelector("#setup")?.textContent).toContain("link its Discord server");
});
