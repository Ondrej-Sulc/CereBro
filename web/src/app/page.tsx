import type { Metadata } from "next";
import Link from "next/link";
import { HeroVisual } from "@/components/HeroVisual";
import { LiveSetup } from "@/components/LiveSetup";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import {
  LayoutDashboard,
  Map,
  Video,
  Bot,
  Search,
  Award,
  Swords,
  Gamepad2,
  Users,
  Shield,
  Server,
  ChevronRight,
  Heart,
  Compass
} from "lucide-react";
import { Faq } from "@/components/Faq";

export const metadata: Metadata = {
  title: "Quest Planning, War Strategy & Discord Bot - CereBro",
  description:
    "CereBro is the complete toolkit for MCOC players and alliances, combining advanced quest planning, war strategy tools, roster utilities, a Discord bot, and a video library.",
};
import PageBackground from "@/components/PageBackground";
import { InteractiveScreenshotDeck } from "@/components/InteractiveScreenshotDeck";
import { ScrollReveal } from "@/components/ScrollReveal";
import { DISCORD_INVITE } from "@/lib/links";

const getHomeHeroStats = unstable_cache(
  async () => {
    const [players, alliances, rosters, warVideos] = await Promise.all([
      prisma.player.count(),
      prisma.alliance.count(),
      prisma.roster.count(),
      prisma.warVideo.count(),
    ]);

    return {
      players,
      alliances,
      rosters,
      warVideos,
    };
  },
  ["home-hero-live-stats"],
  { revalidate: 900, tags: ["home", "hero-stats"] }
);

export default async function Home() {
  const { players, alliances, rosters, warVideos } = await getHomeHeroStats();

  const heroStats = [
    { label: "Registered Players", value: players, icon: Users },
    { label: "Active Alliances", value: alliances, icon: Shield },
    { label: "Champions Managed", value: rosters, icon: LayoutDashboard },
    { label: "War Videos Uploaded", value: warVideos, icon: Video },
  ];

  const numberFormatter = new Intl.NumberFormat("en-US");

  return (
    <div className="min-h-screen relative page-container">
      <PageBackground />
      <main>
        {/* Hero Section */}
        <section className="pt-12 lg:pt-16 pb-20 lg:pb-32 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div className="flex flex-col justify-center order-1 lg:order-1 relative z-10">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
                The Ultimate MCOC <br className="hidden lg:block" />
                <span className="gradient-text">Tactical Advantage</span>
              </h1>

              <p className="text-slate-300 text-lg leading-relaxed mb-8 max-w-xl">
                CereBro is the complete toolkit for MCOC players and alliances. It offers <strong>powerful quest planning</strong>, war strategy tools, and a <strong>Discord Bot</strong> for daily utility.
              </p>

              <div className="flex flex-col items-start gap-4 max-w-xl">
                <Link
                  href={DISCORD_INVITE}
                  target="_blank"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-base font-semibold px-6 py-3 rounded-lg shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 transition-all hover:-translate-y-0.5"
                >
                  <Users className="w-5 h-5" />
                  Join Community Discord
                </Link>
                <div className="flex flex-col items-start gap-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      href="https://discord.com/oauth2/authorize?client_id=1184180809771520091"
                      target="_blank"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium rounded-lg border border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-all"
                    >
                      <Gamepad2 className="w-5 h-5" />
                      Add to Your Server
                    </Link>
                    <Link
                      href="/support"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 text-base font-medium rounded-lg border border-pink-500/50 bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 transition-all"
                    >
                      <Heart className="w-5 h-5" />
                      Support CereBro
                    </Link>
                  </div>
                  <p className="text-sm text-slate-400 max-w-md">
                    New here? Join the community first for help and updates. Add CereBro to your own Discord server when you&apos;re ready to set it up for your alliance.
                  </p>
                </div>
              </div>

              {/* Live Stats */}
              <div className="mt-10 pt-8 border-t border-slate-800/50 w-full max-w-2xl">
                <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80 mb-3">
                  Live Community Stats
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {heroStats.map(({ label, value, icon: Icon }) => (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-700/70 bg-gradient-to-b from-slate-900/80 to-slate-900/40 px-4 py-4 shadow-sm shadow-sky-900/10"
                    >
                      <div className="flex items-center gap-2 text-slate-400 mb-2 min-h-[2rem]">
                        <Icon className="w-4 h-4 shrink-0 text-sky-300/80" />
                        <span className="text-[11px] uppercase tracking-wide leading-4">{label}</span>
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {numberFormatter.format(value)}+
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative order-2 lg:order-2 flex items-center justify-center min-h-[400px]">
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* Web Dashboard Section */}
        <section id="web-platform" className="py-20 lg:py-32 relative overflow-hidden bg-slate-900/10">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-b from-transparent via-sky-500/5 to-sky-500/5 blur-[120px] -z-10" />

          <div className="max-w-7xl mx-auto px-4 lg:px-6">
            <div className="text-center mb-20">
              <ScrollReveal direction="up">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-base font-bold uppercase tracking-[0.2em] mb-6">
                  <LayoutDashboard className="w-5 h-5" />
                  The Platform
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  Plan Better. Win More.
                </h2>
                <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                  Stop using spreadsheets. Manage your questing and war strategy on a big screen with tools built specifically for the game.
                </p>
              </ScrollReveal>
            </div>

            <div className="space-y-24">
              {/* Feature 1: Quest Planner */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <ScrollReveal direction="right" className="order-1 lg:order-1">
                  <div className="w-12 h-12 rounded-xl bg-pink-900/50 border border-pink-800 flex items-center justify-center text-pink-400 mb-6">
                    <Compass className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Advanced Quest Planner</h3>
                  <p className="text-slate-400 text-lg leading-relaxed">
                    Build the perfect team with the Quest Planner. See the path ahead, identify the most popular counters from community data, and optimize your run.
                  </p>
                </ScrollReveal>
                <ScrollReveal direction="left" className="order-2 lg:order-2 flex justify-center">
                  <div className="w-full max-w-[600px]">
                    <InteractiveScreenshotDeck
                      images={['/quest-planner.png']}
                      alt="Quest Planner Interface"
                      orientation="landscape"
                      overlap="space-x-0"
                    />
                  </div>
                </ScrollReveal>
              </div>

              {/* Feature 2: War Map (Swapped) */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <ScrollReveal direction="left" className="order-1 lg:order-2">
                  <div className="w-12 h-12 rounded-xl bg-sky-900/50 border border-sky-800 flex items-center justify-center text-sky-400 mb-6">
                    <Map className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Interactive War Map</h3>
                  <p className="text-slate-400 text-lg leading-relaxed">
                    Plan your Attacks and Defense with player&apos;s rosters right at your fingertips. Assign nodes, see the whole board, and execute your strategy. It&apos;s the easiest way to plan Alliance Wars.
                  </p>
                </ScrollReveal>
                <ScrollReveal direction="right" className="order-2 lg:order-1 flex justify-center">
                  <div className="w-full max-w-[600px]">
                    <InteractiveScreenshotDeck
                      images={['/war-map.png']}
                      alt="Interactive War Map"
                      orientation="landscape"
                      overlap="space-x-0"
                    />
                  </div>
                </ScrollReveal>
              </div>

              {/* Feature 3: Archive */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <ScrollReveal direction="right" className="order-1 lg:order-1">
                  <div className="w-12 h-12 rounded-xl bg-sky-900/50 border border-sky-800 flex items-center justify-center text-sky-400 mb-6">
                    <Video className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Video Library</h3>
                  <p className="text-slate-400 text-lg leading-relaxed">
                    Upload your fights and tag them. Search the archive later to find the best counters for any defender.
                  </p>
                </ScrollReveal>
                <ScrollReveal direction="left" className="order-2 lg:order-2 flex justify-center">
                  <div className="w-full max-w-[600px]">
                    <InteractiveScreenshotDeck
                      images={['/war-archive.png']}
                      alt="Video Library"
                      orientation="landscape"
                      overlap="space-x-0"
                    />
                  </div>
                </ScrollReveal>
              </div>

              {/* Feature 4: Smart Roster & Prestige (Swapped) */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <ScrollReveal direction="left" className="order-1 lg:order-2">
                  <div className="w-12 h-12 rounded-xl bg-sky-900/50 border border-sky-800 flex items-center justify-center text-sky-400 mb-6">
                    <Award className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Smart Roster & Prestige</h3>
                  <p className="text-slate-400 text-lg leading-relaxed">
                    Visualize your roster with advanced filtering. Simulate prestige rank-ups and optimize your signature stone usage with our intelligent budget calculator.
                  </p>
                </ScrollReveal>
                <ScrollReveal direction="right" className="order-2 lg:order-1 flex justify-center">
                  <div className="w-full max-w-[600px]">
                    <InteractiveScreenshotDeck
                      images={['/web-roster.png']}
                      alt="Roster & Prestige"
                      orientation="landscape"
                      overlap="space-x-0"
                    />
                  </div>
                </ScrollReveal>
              </div>

              {/* Feature 5: Alliance Roster Overview */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <ScrollReveal direction="right" className="order-1 lg:order-1">
                  <div className="w-12 h-12 rounded-xl bg-sky-900/50 border border-sky-800 flex items-center justify-center text-sky-400 mb-6">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Alliance Roster Overview</h3>
                  <p className="text-slate-400 text-lg leading-relaxed">
                    Officers get a bird&apos;s-eye view of the entire alliance. Filter champions by Battlegroup, Class, or Rank to find the perfect defenders or counters for war.
                  </p>
                </ScrollReveal>
                <ScrollReveal direction="left" className="order-2 lg:order-2 flex justify-center">
                  <div className="w-full max-w-[600px]">
                    <InteractiveScreenshotDeck
                      images={['/web-alliance-roster.png']}
                      alt="Alliance Roster Overview"
                      orientation="landscape"
                      overlap="space-x-0"
                    />
                  </div>
                </ScrollReveal>
              </div>
            </div>
          </div>
        </section>

        {/* Discord Bot Section */}
        <section id="discord-bot" className="py-20 lg:py-32 relative overflow-hidden bg-slate-900/40 border-y border-slate-800/50">
          <div className="absolute bottom-0 left-0 w-1/2 h-full bg-indigo-500/5 blur-[120px] -z-10" />

          <div className="max-w-7xl mx-auto px-4 lg:px-6">
            <div className="text-center mb-20">
              <ScrollReveal direction="up">
                <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-base font-bold uppercase tracking-[0.2em] mb-6">
                  <Bot className="w-5 h-5" />
                  Discord Bot
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                  Your Daily Helper
                </h2>
                <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                  Get info, reminders, and roster updates without leaving your chat app.
                </p>
              </ScrollReveal>
            </div>

            <div className="space-y-24">
              {/* Feature 1: Champion Intel */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <ScrollReveal direction="right" className="order-1 lg:order-1">
                  <div className="w-12 h-12 rounded-xl bg-indigo-900/50 border border-indigo-800 flex items-center justify-center text-indigo-400 mb-6">
                    <Search className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Instant Champion Intel</h3>
                  <p className="text-slate-400 text-lg leading-relaxed">
                    Get abilities, immunities, and duel targets instantly. Powerful search tools let you query the game glossary or find the perfect counter in your roster.
                  </p>
                </ScrollReveal>
                <ScrollReveal direction="left" className="order-2 lg:order-2 flex justify-center">
                  <div className="w-full max-w-[600px]">
                    <InteractiveScreenshotDeck
                      images={[
                        '/discord-champion-1.png',
                        '/discord-champion-2.png',
                        '/discord-champion-3.png',
                        '/discord-champion-4.png'
                      ]}
                      alt="Champion Intel Feature"
                      widthClass="w-36 sm:w-48 md:w-64"
                      overlap="-space-x-24 sm:-space-x-32 md:-space-x-36"
                    />
                  </div>
                </ScrollReveal>
              </div>

              {/* Feature 2: Roster & Prestige (Swapped) */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <ScrollReveal direction="left" className="order-1 lg:order-2">
                  <div className="w-12 h-12 rounded-xl bg-indigo-900/50 border border-indigo-800 flex items-center justify-center text-indigo-400 mb-6">
                    <Award className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">Roster & Prestige</h3>
                  <p className="text-slate-400 text-lg leading-relaxed">
                    Update your roster in seconds. Just upload screenshots, and our image processing technology adds your champions automatically.
                  </p>
                </ScrollReveal>
                <ScrollReveal direction="right" className="order-2 lg:order-1 flex justify-center">
                  <div className="w-full max-w-[600px]">
                    <InteractiveScreenshotDeck
                      images={[
                        '/discord-roster-3.png',
                        '/discord-roster-2.png',
                        '/discord-roster-1.png',
                      ]}
                      alt="Roster Management Feature"
                      widthClass="w-40 sm:w-56 md:w-72"
                      overlap="-space-x-20 sm:-space-x-32 md:-space-x-40"
                    />
                  </div>
                </ScrollReveal>
              </div>

              {/* Feature 3: War & Quest Support */}
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <ScrollReveal direction="right" className="order-1 lg:order-1">
                  <div className="w-12 h-12 rounded-xl bg-indigo-900/50 border border-indigo-800 flex items-center justify-center text-indigo-400 mb-6">
                    <Swords className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4">War & Quest Support</h3>
                  <p className="text-slate-400 text-lg leading-relaxed">
                    Receive your War assignments directly in your DMs. Track Alliance Quest movement and stay coordinated with smart alerts.
                  </p>
                </ScrollReveal>
                <ScrollReveal direction="left" className="order-2 lg:order-2 flex justify-center">
                  <div className="w-full max-w-[600px]">
                    <InteractiveScreenshotDeck
                      images={[
                        '/discord-war-3.png',
                        '/discord-war-2.png',
                        '/discord-war-1.png',
                      ]}
                      alt="War Planning Feature"
                      widthClass="w-40 sm:w-56 md:w-72"
                      overlap="-space-x-20 sm:-space-x-32 md:-space-x-40"
                    />
                  </div>
                </ScrollReveal>
              </div>

              {/* Command Reference Teaser */}
              <div className="mt-20 flex justify-center">
                <Link href="/commands" className="group flex items-center gap-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-indigo-500/50 rounded-full px-6 py-3 transition-all">
                  <span className="text-slate-300 font-medium group-hover:text-white">View Full Command Reference</span>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Live Setup Section */}
        <section id="setup" className="py-16 bg-slate-900/30 border-y border-slate-800/50">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="text-center mb-12">
              <span className="text-emerald-400 font-mono text-xs uppercase tracking-wider mb-2 block">Getting Started</span>
              <h2 className="text-3xl font-bold text-white">Real Setup Flow</h2>
              <p className="text-slate-400 mt-2">A practical onboarding path for both officers and members.</p>
            </div>
            <LiveSetup />
          </div>
        </section>

        {/* Final CTA */}
        <section id="get" className="py-10 pb-16">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="glass rounded-xl border border-slate-800/50 px-6 py-6 md:py-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Ready to get started?
                </h3>
                <p className="text-sm text-slate-300 max-w-xl">
                  Join the community Discord for setup help, updates, and support. Add CereBro to your own server once you&apos;re ready to use it for yourself or your alliance.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <Link
                  href={DISCORD_INVITE}
                  target="_blank"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-lg shadow-lg shadow-sky-500/25"
                >
                  Join Community Discord
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                      d="M7 17 17 7m0 0H8m9 0v9"
                    />
                  </svg>
                </Link>
                <Link
                  href="https://discord.com/oauth2/authorize?client_id=1184180809771520091"
                  target="_blank"
                  className="inline-flex items-center gap-2 border border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                >
                  Add to Your Server
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.6"
                      d="M7 17 17 7m0 0H8m9 0v9"
                    />
                  </svg>
                </Link>
                <Link
                  href="/support"
                  className="inline-flex items-center justify-center gap-2 border border-pink-500/40 bg-pink-500/10 hover:bg-pink-500/20 text-pink-200 text-sm font-medium px-5 py-2 rounded-lg transition-colors"
                >
                  <Heart className="w-4 h-4" />
                  Support CereBro
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section-offset py-10 lg:py-14">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <p className="text-xs uppercase tracking-wide text-sky-400/80 mb-1 text-center">
              Questions
            </p>
            <h2 className="text-2xl font-semibold text-white mb-5 text-center">
              CereBro FAQ
            </h2>
            <div className="space-y-3">
              <Faq />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
