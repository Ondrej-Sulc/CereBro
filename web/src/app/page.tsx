import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import CommandReference from "@/components/CommandReference";
import { HeroVisual } from "@/components/HeroVisual";
import { LiveSetup } from "@/components/LiveSetup";
import { 
  CalendarCheck, 
  Award, 
  Search, 
  Users, 
  Database, 
  BookOpen, 
  Coffee, 
  Server, 
  HardDrive, 
  Code,
  LayoutDashboard,
  Map,
  LineChart,
  Video,
  Bot,
  Zap,
  ShieldAlert,
  Heart,
  Swords,
  Gamepad2
} from "lucide-react";
import { Faq } from "@/components/Faq";
import PageBackground from "@/components/PageBackground";
import Tilt from "@/components/TiltWrapper";
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
                  href="https://discord.com/oauth2/authorize"
                  target="_blank"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-base font-semibold px-6 py-3 rounded-lg shadow-lg shadow-sky-500/30 hover:shadow-sky-500/50 transition-all hover:-translate-y-0.5"
                >
                  <Gamepad2 className="w-5 h-5" />
                  Add to Discord
                </Link>
                <Link
                  href="#platform"
                  className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-lg border border-slate-600/50 bg-slate-800/30 hover:bg-slate-800/50 text-slate-200 transition-all"
                >
                  Explore Features
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

        {/* Platform Split Section */}
        <section id="platform" className="py-16 lg:py-24 relative">
            <div className="max-w-7xl mx-auto px-4 lg:px-6">
                <div className="text-center mb-16">
                    <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Two Powerful Tools. One Platform.</h2>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                        Bridge the gap between your game data and your alliance communication.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
                    {/* Web Dashboard Column */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-b from-sky-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl -z-10" />
                        <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl h-full flex flex-col">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                                    <LayoutDashboard className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white">The War Room</h3>
                                    <p className="text-sky-400 text-sm font-medium uppercase tracking-wider">Web Dashboard</p>
                                </div>
                            </div>
                            
                            <p className="text-slate-300 mb-8 leading-relaxed">
                                A desktop-class interface designed for high-level strategy, analytics, and visual planning.
                            </p>

                            <div className="space-y-6 flex-grow">
                                <div className="flex gap-4">
                                    <div className="mt-1">
                                        <Map className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-semibold">Interactive War Planner</h4>
                                        <p className="text-sm text-slate-400 mt-1">Real-time collaborative map. Visually design your defense and assign lanes with precision.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="mt-1">
                                        <LineChart className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-semibold">Season Analytics</h4>
                                        <p className="text-sm text-slate-400 mt-1">Track deaths, diversity, and attacker efficiency across the entire season.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="mt-1">
                                        <Video className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-semibold">War Archive</h4>
                                        <p className="text-sm text-slate-400 mt-1">A searchable database of fight logs and video uploads for review.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Discord Bot Column */}
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl -z-10" />
                        <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-3xl h-full flex flex-col">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                    <Bot className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white">The Field Assistant</h3>
                                    <p className="text-indigo-400 text-sm font-medium uppercase tracking-wider">Discord Bot</p>
                                </div>
                            </div>
                            
                            <p className="text-slate-300 mb-8 leading-relaxed">
                                Your always-on companion for quick information, notifications, and automated management.
                            </p>

                            <div className="space-y-6 flex-grow">
                                <div className="flex gap-4">
                                    <div className="mt-1">
                                        <Zap className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-semibold">Instant Intel</h4>
                                        <p className="text-sm text-slate-400 mt-1">Access abilities, immunities, and stats instantly. Powered by a deep glossary search.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="mt-1">
                                        <ShieldAlert className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-semibold">Smart Reminders</h4>
                                        <p className="text-sm text-slate-400 mt-1">Automated alerts for AQ moves, War starts, and important events.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="mt-1">
                                        <Users className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-semibold">Automated Setup</h4>
                                        <p className="text-sm text-slate-400 mt-1">The bot initializes on join. Configure your roles once, and let the background sync handle the rest.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
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

        {/* Feature Grid (Secondary) */}
        <section id="features" className="section-offset py-16">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-semibold text-white">
                Everything you need to lead
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Tilt className="rounded-xl h-full">
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-sky-500/40 transition h-full flex flex-col">
                    <Search className="w-8 h-8 text-sky-400 mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Advanced Search</h3>
                    <p className="text-sm text-slate-400">Multi-filter searches to find the perfect champion for any node.</p>
                </div>
              </Tilt>
              <Tilt className="rounded-xl h-full">
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-indigo-500/40 transition h-full flex flex-col">
                    <Users className="w-8 h-8 text-indigo-400 mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Roster Processing</h3>
                    <p className="text-sm text-slate-400">Instant image processing extracts stats from your screenshots. We store the data, not the images.</p>
                </div>
              </Tilt>
              <Tilt className="rounded-xl h-full">
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-pink-500/40 transition h-full flex flex-col">
                    <CalendarCheck className="w-8 h-8 text-pink-400 mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Automated Scheduling</h3>
                    <p className="text-sm text-slate-400">Set your AQ schedule once and let the bot handle the daily reminders.</p>
                </div>
              </Tilt>
              <Tilt className="rounded-xl h-full">
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-sky-500/40 transition h-full flex flex-col">
                    <Award className="w-8 h-8 text-sky-400 mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Prestige Tracking</h3>
                    <p className="text-sm text-slate-400">Track individual and alliance prestige evolution over time.</p>
                </div>
              </Tilt>
              <Tilt className="rounded-xl h-full">
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-indigo-500/40 transition h-full flex flex-col">
                    <BookOpen className="w-8 h-8 text-indigo-400 mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Game Glossary</h3>
                    <p className="text-sm text-slate-400">Instant definitions for buffs, nodes, and interactions.</p>
                </div>
              </Tilt>
              <Tilt className="rounded-xl h-full">
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-pink-500/40 transition h-full flex flex-col">
                    <Database className="w-8 h-8 text-pink-400 mb-4" />
                    <h3 className="text-lg font-semibold text-white mb-2">Central Database</h3>
                    <p className="text-sm text-slate-400">A unified data source for your entire alliance's operations.</p>
                </div>
              </Tilt>
            </div>
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
                  CereBro is a free project built for the community. Your support directly funds the servers and database storage.
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
                  href="https://discord.com/oauth2/authorize"
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