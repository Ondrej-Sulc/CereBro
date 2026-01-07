import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import CommandReference from "@/components/CommandReference";
import { HeroVisual } from "@/components/HeroVisual";
import { LiveSetup } from "@/components/LiveSetup";
import { 
  Coffee, 
  Server, 
  HardDrive, 
  Code,
  LayoutDashboard,
  Map,
  LineChart,
  Video,
  Bot,
  Search,
  Award,
  Heart,
  Swords,
  Gamepad2
} from "lucide-react";
import { Faq } from "@/components/Faq";
import PageBackground from "@/components/PageBackground";
import Tilt from "@/components/TiltWrapper";
import { InteractiveScreenshotDeck } from "@/components/InteractiveScreenshotDeck";
import { ScrollReveal } from "@/components/ScrollReveal";
import { isUserBotAdmin } from "@/lib/auth-helpers";

export default async function Home() {
  const isAdmin = await isUserBotAdmin();

  return (
    <div className="min-h-screen relative page-container">
      <PageBackground />
      <main>
        {/* Hero Section */}
        <section className="pt-12 lg:pt-16 pb-20 lg:pb-32 relative">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div className="flex flex-col justify-center order-2 lg:order-1 relative z-10">
              <span className="inline-flex items-center gap-2 text-xs bg-slate-900/50 border border-slate-700/50 rounded-full px-3 py-1 w-fit mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Ready for Battle
              </span>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
                Your Alliance's <br className="hidden lg:block"/>
                <span className="gradient-text">Tactical Advantage</span>
              </h1>
              
              <p className="text-slate-300 text-lg leading-relaxed mb-8 max-w-xl">
                CereBro is the complete operating system for MCOC alliances. It combines a <strong>strategic Web Dashboard</strong> for war planning with a <strong>Discord Bot</strong> for daily utility.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="https://discord.com/oauth2/authorize?client_id=1184180809771520091"
                  target="_blank"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-base font-semibold px-6 py-3 rounded-lg shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 transition-all hover:-translate-y-0.5"
                >
                  <Gamepad2 className="w-5 h-5" />
                  Add to Discord
                </Link>
                <Link
                  href="https://discord.gg/eRv7fkMHmU"
                  target="_blank"
                  className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-lg border border-slate-600/50 bg-slate-800/30 hover:bg-slate-800/50 text-slate-200 transition-all"
                >
                  Support Server
                </Link>
              </div>

              {/* Stats / Trust */}
              <div className="mt-10 pt-8 border-t border-slate-800/50 flex gap-8">
                <div>
                  <p className="text-2xl font-bold text-white">24/7</p>
                  <p className="text-sm text-slate-400">Uptime</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">Active</p>
                  <p className="text-sm text-slate-400">Development</p>
                </div>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="relative order-1 lg:order-2 flex items-center justify-center min-h-[400px]">
               <HeroVisual />
            </div>
          </div>
        </section>

        {/* Web Dashboard Section */}
        <section id="web-platform" className="py-20 lg:py-32 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-b from-transparent via-sky-500/5 to-sky-500/5 blur-[120px] -z-10" />
            
            <div className="max-w-7xl mx-auto px-4 lg:px-6">
                <div className="text-center mb-20">
                    <ScrollReveal direction="up">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-sm font-medium uppercase tracking-wider mb-4">
                            <LayoutDashboard className="w-4 h-4" />
                            Web Dashboard
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                            Plan Better. Win More.
                        </h2>
                        <p className="text-slate-300 text-lg max-w-2xl mx-auto">
                            Stop using spreadsheets. Manage your war strategy on a big screen with tools built specifically for the game.
                        </p>
                    </ScrollReveal>
                </div>

                <div className="space-y-24">
                    {/* Feature 1: Map */}
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <ScrollReveal direction="right" className="order-2 lg:order-1">
                            <div className="w-12 h-12 rounded-xl bg-sky-900/50 border border-sky-800 flex items-center justify-center text-sky-400 mb-6">
                                <Map className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Interactive War Map</h3>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                Plan your Attacks and Defense with player's rosters right at your fingertips, assign nodes, see the whole board. It’s the easiest way to plan.
                            </p>
                        </ScrollReveal>
                        <ScrollReveal direction="left" className="order-1 lg:order-2">
                            <Tilt glareEnable={true} glareMaxOpacity={0.3} scale={1.02} transitionSpeed={2000} tiltMaxAngleX={8} tiltMaxAngleY={8}>
                                <div className="relative rounded-xl border border-slate-800 bg-slate-900/50 aspect-video flex items-center justify-center overflow-hidden group hover:border-sky-500/30 transition-all shadow-2xl shadow-sky-900/10">
                                    <Image 
                                      src="/war-map.png" 
                                      alt="War Map" 
                                      fill 
                                      className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Tilt>
                        </ScrollReveal>
                    </div>

                    {/* Feature 2: Archive (Swapped) */}
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <ScrollReveal direction="left" className="order-2 lg:order-2">
                            <div className="w-12 h-12 rounded-xl bg-sky-900/50 border border-sky-800 flex items-center justify-center text-sky-400 mb-6">
                                <Video className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Video Library</h3>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                Upload your fights and tag them. Search the archive later to find the best counters for any defender.
                            </p>
                        </ScrollReveal>
                        <ScrollReveal direction="right" className="order-1 lg:order-1">
                             <Tilt glareEnable={true} glareMaxOpacity={0.3} scale={1.02} transitionSpeed={2000} tiltMaxAngleX={8} tiltMaxAngleY={8}>
                                <div className="relative rounded-xl border border-slate-800 bg-slate-900/50 aspect-video flex items-center justify-center overflow-hidden group hover:border-sky-500/30 transition-all shadow-2xl shadow-sky-900/10">
                                    <Image 
                                      src="/war-archive.png" 
                                      alt="War Archive" 
                                      fill 
                                      className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Tilt>
                        </ScrollReveal>
                    </div>

                    {/* Feature 3: Stats (Swapped) */}
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <ScrollReveal direction="right" className="order-2 lg:order-1">
                            <div className="w-12 h-12 rounded-xl bg-sky-900/50 border border-sky-800 flex items-center justify-center text-sky-400 mb-6">
                                <LineChart className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Season Stats</h3>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                See who died and who cleared their lane. We track the stats automatically so you know exactly how the season is going.
                            </p>
                        </ScrollReveal>
                        <ScrollReveal direction="left" className="order-1 lg:order-2">
                             <Tilt glareEnable={true} glareMaxOpacity={0.3} scale={1.02} transitionSpeed={2000} tiltMaxAngleX={8} tiltMaxAngleY={8}>
                                <div className="relative rounded-xl border border-slate-800 bg-slate-900/50 aspect-video flex items-center justify-center overflow-hidden group hover:border-sky-500/30 transition-all shadow-2xl shadow-sky-900/10">
                                    <Image 
                                      src="/season-stats.png" 
                                      alt="Season Stats" 
                                      fill 
                                      className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-sky-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </Tilt>
                        </ScrollReveal>
                    </div>
                </div>
            </div>
        </section>

        {/* Discord Bot Section */}
        <section id="discord-bot" className="py-20 lg:py-32 relative overflow-hidden bg-slate-900/30 border-y border-slate-800/50">
            <div className="absolute bottom-0 left-0 w-1/2 h-full bg-indigo-500/5 blur-[120px] -z-10" />

            <div className="max-w-7xl mx-auto px-4 lg:px-6">
                <div className="text-center mb-20">
                    <ScrollReveal direction="up">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium uppercase tracking-wider mb-4">
                            <Bot className="w-4 h-4" />
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
                        <ScrollReveal direction="right" className="order-2 lg:order-1">
                            <div className="w-12 h-12 rounded-xl bg-indigo-900/50 border border-indigo-800 flex items-center justify-center text-indigo-400 mb-6">
                                <Search className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Instant Champion Intel</h3>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                Get abilities, immunities, and duel targets instantly. Powerful search tools let you query the game glossary or find the perfect counter in your roster.
                            </p>
                        </ScrollReveal>
                        <ScrollReveal direction="left" className="order-1 lg:order-2 flex justify-center">
                            <div className="w-full max-w-[600px]">
                                <InteractiveScreenshotDeck 
                                    images={[
                                        '/discord-champion-1.png',
                                        '/discord-champion-2.png',
                                        '/discord-champion-3.png',
                                        '/discord-champion-4.png'
                                    ]}
                                    alt="Champion Intel Feature"
                                    widthClass="w-50 md:w-64"
                                    overlap="-space-x-36"
                                />
                            </div>
                        </ScrollReveal>
                    </div>

                    {/* Feature 2: Roster & Prestige (Swapped) */}
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <ScrollReveal direction="left" className="order-2 lg:order-2">
                            <div className="w-12 h-12 rounded-xl bg-indigo-900/50 border border-indigo-800 flex items-center justify-center text-indigo-400 mb-6">
                                <Award className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Roster & Prestige</h3>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                Update your roster in seconds. Just upload screenshots, and our image processing technology adds your champions automatically.
                            </p>
                        </ScrollReveal>
                        <ScrollReveal direction="right" className="order-1 lg:order-1 flex justify-center">
                            <div className="w-full max-w-[600px]">
                                <InteractiveScreenshotDeck 
                                    images={[
                                        '/discord-roster-3.png',
                                        '/discord-roster-2.png',
                                        '/discord-roster-1.png',
                                    ]}
                                    alt="Roster Management Feature"
                                    widthClass="w-64 md:w-72"
                                    overlap="-space-x-40"
                                />
                            </div>
                        </ScrollReveal>
                    </div>

                    {/* Feature 3: War & Quest Support */}
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <ScrollReveal direction="right" className="order-2 lg:order-1">
                            <div className="w-12 h-12 rounded-xl bg-indigo-900/50 border border-indigo-800 flex items-center justify-center text-indigo-400 mb-6">
                                <Swords className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">War & Quest Support</h3>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                Receive your War assignments directly in your DMs. Track Alliance Quest movement and stay coordinated with smart alerts.
                            </p>
                        </ScrollReveal>
                        <ScrollReveal direction="left" className="order-1 lg:order-2 flex justify-center">
                            <div className="w-full max-w-[600px]">
                                <InteractiveScreenshotDeck 
                                    images={[
                                        '/discord-war-3.png',
                                        '/discord-war-2.png',
                                        '/discord-war-1.png',
                                    ]}
                                    alt="War Planning Feature"
                                    widthClass="w-64 md:w-72"
                                    overlap="-space-x-40"
                                />
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </div>
        </section>

        {/* Live Setup Section */}
        <section id="setup" className="py-16 bg-slate-900/30 border-y border-slate-800/50">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
             <div className="text-center mb-12">
                <span className="text-emerald-400 font-mono text-xs uppercase tracking-wider mb-2 block">Easy Onboarding</span>
                <h2 className="text-3xl font-bold text-white">Setup in Seconds</h2>
                <p className="text-slate-400 mt-2">No complex config files. Just invite and link.</p>
             </div>
             <LiveSetup />
          </div>
        </section>



        {/* Command Reference */}
        <section
          id="commands"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14 scroll-mt-28 relative z-10"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-300/80">
                Command reference
              </p>
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-50 mt-1">
                Slash commands
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                Comprehensive list of commands available in your server.
              </p>
            </div>
          </div>

          <Suspense fallback={<div className="h-96 flex items-center justify-center text-slate-500">Loading commands...</div>}>
            <CommandReference isAdmin={isAdmin} />
          </Suspense>
        </section>

        {/* Meet the Developer */}
        <section className="py-20 bg-slate-950/50">
          <div className="max-w-4xl mx-auto px-4 lg:px-6">
            <ScrollReveal direction="up">
              <div className="relative glass rounded-3xl border border-slate-800/50 p-8 md:p-12 overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -z-10" />
                
                <div className="flex flex-col md:flex-row items-center gap-10">
                  {/* Avatar with Tilt */}
                  <div className="shrink-0">
                    <Tilt glareEnable={true} glareMaxOpacity={0.2} scale={1.05} tiltMaxAngleX={10} tiltMaxAngleY={10}>
                      <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border-2 border-indigo-500/30 p-1 bg-slate-900 shadow-xl shadow-indigo-500/10">
                        <Image 
                          src="/avatar.png" 
                          alt="Solomon" 
                          fill 
                          className="object-cover rounded-xl"
                        />
                      </div>
                    </Tilt>
                  </div>

                  {/* Bio Content */}
                  <div className="text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                      <h2 className="text-3xl font-bold text-white">Hi, I'm Solomon</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                        Creator of CereBro
                      </span>
                    </div>
                    
                    <p className="text-slate-300 text-lg leading-relaxed mb-6">
                      I'm a developer from Czechia and a passionate MCOC player since 2018. I've been a member of my alliance <strong className="text-white">Night Guardians</strong> from the start of my journey. The last few years we have been competing in <strong className="text-white">Tier 1</strong> Alliance Wars.
                    </p>
                    
                    <p className="text-slate-400 leading-relaxed">
                      I've been creating spreadsheets for our alliance since the beginning — for defense planning, Alliance Quest, war attack planning, and roster tracking. Manual roster updates became tedious, so I built a Discord bot to parse game screenshots. What started as a small internal tool for the Night Guardians grew into a full-featured bot and, eventually, the platform you see today: CereBro. It's the result of years spent collecting champion data and building tools to make alliance management less of a chore and more of a tactical advantage.
                    </p>

                    <div className="mt-8 flex flex-wrap justify-center md:justify-start gap-6 opacity-60 italic text-sm">
                      <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-indigo-400" />
                        Full-stack Developer
                      </div>
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="w-4 h-4 text-indigo-400" />
                        Summoner since 2018
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Support Section */}
        <section id="support" className="section-offset py-16 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-pink-600/20 blur-[100px] rounded-full -z-10 pointer-events-none" />

          <div className="max-w-5xl mx-auto px-4 lg:px-6">
            <div className="relative rounded-3xl border border-pink-500/30 bg-slate-900/60 p-8 md:p-12 overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent opacity-50" />

              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-semibold uppercase tracking-wider mb-4">
                  <Heart className="w-3 h-3 fill-pink-500/50" />
                  Community Powered
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Help Keep CereBro Online
                </h2>
                <p className="text-slate-300 max-w-2xl mx-auto text-lg">
                  CereBro is a free project built for the community. Your support directly funds the hosting and development.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 mb-12">
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-950/30 border border-slate-800/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-sky-400 mb-3 shadow-lg shadow-sky-900/20">
                    <Server className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">
                    Server Costs
                  </h3>
                  <p className="text-sm text-slate-400">
                    High-performance hosting for reliable 99.9% uptime.
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-950/30 border border-slate-800/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-indigo-400 mb-3 shadow-lg shadow-indigo-900/20">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">
                    Data Storage
                  </h3>
                  <p className="text-sm text-slate-400">
                    Database storage for thousands of champion records.
                  </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-950/30 border border-slate-800/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-pink-400 mb-3 shadow-lg shadow-pink-900/20">
                    <Code className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">
                    Active Development
                  </h3>
                  <p className="text-sm text-slate-400">
                    Continuous feature updates and game data maintenance.
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-1 gap-4 max-w-xl mx-auto">
                <Link
                  href="https://ko-fi.com/cerebrobot"
                  target="_blank"
                  className="group relative overflow-hidden rounded-xl bg-[#FF5E5B] transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#FF5E5B]/20"
                >
                  <div className="relative flex items-center justify-center gap-4 px-6 py-4 text-white">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <Coffee className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-lg leading-none">
                        Support on Ko-fi
                      </div>
                      <div className="text-xs text-white/90 mt-1 font-medium">
                        One-time donation
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="get" className="py-10 pb-16">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="glass rounded-xl border border-slate-800/50 px-6 py-6 md:py-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Ready to upgrade your alliance?
                </h3>
                <p className="text-sm text-slate-300">
                  Invite CereBro now to get started.
                </p>
              </div>
              <div className="flex gap-3 items-center">
                <Link
                  href="https://discord.com/oauth2/authorize?client_id=1184180809771520091"
                  target="_blank"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-medium px-5 py-2 rounded-lg shadow-lg shadow-sky-500/25"
                >
                  Invite to Discord
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
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="section-offset py-10 lg:py-14">
          <div className="max-w-4xl mx-auto px-4 lg:px-6">
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