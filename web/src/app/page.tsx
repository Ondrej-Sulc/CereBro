import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import CommandReference from "@/components/CommandReference";
import { CalendarCheck, Award, Search, Users, Database, BookOpen, Coffee, DollarSign, Heart, Server, HardDrive, Code, Swords } from "lucide-react";
import { Faq } from "@/components/Faq";
import PageBackground from "@/components/PageBackground";
import Tilt from "@/components/TiltWrapper";
import { isUserBotAdmin } from "@/lib/auth-helpers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const isAdmin = await isUserBotAdmin();
  const session = await auth();
  let isOfficer = false;

  if (session?.user?.id) {
    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" }
    });
    if (account?.providerAccountId) {
        const player = await prisma.player.findFirst({
            where: { discordId: account.providerAccountId }
        });
        isOfficer = player?.isOfficer || false;
    }
  }

  return (
    <div className="min-h-screen relative page-container">
      <PageBackground />
      <main>
        <section className="pt-12 lg:pt-12 pb-12">
          <div className="max-w-6xl mx-auto px-4 lg:px-6 grid grid-cols-3 gap-x-6 sm:gap-x-10 gap-y-4 hero-grid">
            {/* Title */}
            <div className="col-span-2 col-start-1 lg:row-start-1 flex flex-col justify-center">
              <span className="inline-flex items-center gap-2 text-xs bg-slate-900/50 border border-slate-700/50 rounded-full px-3 py-1 w-fit mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Now available for all MCOC alliances
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
                CereBro:&nbsp;
                <span className="gradient-text">
                  The tactical advantage for MCOC
                </span>
              </h1>
            </div>

            {/* Logo - re-ordered for mobile */}
            <div className="relative row-start-1 col-start-3 lg:row-start-1 lg:row-span-2 flex items-center">
              <Image
                src="/CereBro_logo_1024.png"
                alt="CereBro Logo"
                width={512}
                height={512}
                className="mx-auto edge-blur animate-float w-28 sm:w-36 md:w-48 lg:w-full"
              />
            </div>

            {/* Description and CTAs - full width on mobile */}
            <div className="col-span-3 lg:col-span-2 lg:col-start-1 lg:row-start-2">
              <p className="text-slate-300 text-sm md:text-base leading-relaxed mt-2 mb-6">
                The ultimate MCOC companion for your Discord server. CereBro
                manages personal rosters with cutting-edge image processing, provides
                in-depth champion data, puts the entire game's glossary at your
                fingertips, automates AQ scheduling, and tracks prestige. Spend
                less time managing and more time playing.
              </p>
              <div className="flex flex-wrap gap-4 mb-6">
                <Link
                  href="https://discord.com/oauth2/authorize"
                  target="_blank"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-sky-500/30"
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
                      strokeWidth="1.7"
                      d="M7 17 17 7m0 0H8m9 0v9"
                    />
                  </svg>
                </Link>
                {isOfficer && (
                  <Link
                    href="/planning"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-red-500/30"
                  >
                    War Planning
                    <Swords className="w-4 h-4" />
                  </Link>
                )}
                <Link
                  href="#commands"
                  className="inline-flex items-center gap-1 px-4 py-2.5 text-sm rounded-lg border border-slate-600/50 hover:bg-slate-800/50 transition"
                >
                  View Commands
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
                      strokeWidth="1.7"
                      d="m9 5 7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>
              <div className="flex gap-6 items-center">
                <div>
                  <p className="text-lg font-bold text-white leading-none">
                    Trusted by Alliances
                  </p>
                  <p className="text-xs text-slate-400">Worldwide</p>
                </div>
                <div className="h-8 w-px bg-slate-700/70"></div>
                <div>
                  <p className="text-lg font-bold text-white leading-none">
                    99.9%
                  </p>
                  <p className="text-xs text-slate-400">Uptime</p>
                </div>
                <div className="h-8 w-px bg-slate-700/70"></div>
                <div>
                  <p className="text-lg font-bold text-white leading-none">
                    Powerful
                  </p>
                  <p className="text-xs text-slate-400">& Feature-Rich</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="section-offset py-10 lg:py-14">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-xs uppercase tracking-wide text-sky-400/80 mb-1">
                  Core Capabilities
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  What CereBro does for your MCOC server
                </h2>
                <p className="text-slate-300 text-sm mt-1">
                  Built to replace spreadsheets, ping chaos, and manual
                  coordination.
                </p>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <Tilt
                tiltMaxAngleX={2}
                tiltMaxAngleY={2}
                perspective={1000}
                glareEnable={true}
                glareMaxOpacity={0.1}
                glarePosition="all"
                scale={1.02}
                className="rounded-xl"
                style={{ overflow: 'hidden' }}
              >
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-sky-500/40 transition h-full">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-300 shrink-0">
                      <Search className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      Advanced Champion Search
                    </h3>
                  </div>
                  <p className="text-sm text-slate-300">
                    Find the perfect champion for any situation with powerful,
                    multi-filter searches.
                  </p>
                </div>
              </Tilt>
              <Tilt
                tiltMaxAngleX={2}
                tiltMaxAngleY={2}
                perspective={1000}
                glareEnable={true}
                glareMaxOpacity={0.1}
                glarePosition="all"
                scale={1.02}
                className="rounded-xl"
                style={{ overflow: 'hidden' }}
              >
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-indigo-500/40 transition h-full">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-300 shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      Personal Roster Management
                    </h3>
                  </div>
                  <p className="text-sm text-slate-300">
                    Keep your champion roster perfectly up-to-date with easy
                    updates via screenshot image processing.
                  </p>
                </div>
              </Tilt>
              <Tilt
                tiltMaxAngleX={2}
                tiltMaxAngleY={2}
                perspective={1000}
                glareEnable={true}
                glareMaxOpacity={0.1}
                glarePosition="all"
                scale={1.02}
                className="rounded-xl"
                style={{ overflow: 'hidden' }}
              >
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-pink-500/40 transition h-full">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-300 shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      In-Depth Champion Database
                    </h3>
                  </div>
                  <p className="text-sm text-slate-300">
                    Access detailed information on any champion's abilities,
                    stats, and immunities.
                  </p>
                </div>
              </Tilt>
              <Tilt
                tiltMaxAngleX={2}
                tiltMaxAngleY={2}
                perspective={1000}
                glareEnable={true}
                glareMaxOpacity={0.1}
                glarePosition="all"
                scale={1.02}
                className="rounded-xl"
                style={{ overflow: 'hidden' }}
              >
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-sky-500/40 transition h-full">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-300 shrink-0">
                      <CalendarCheck className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      Automated AQ Scheduling
                    </h3>
                  </div>
                  <p className="text-sm text-slate-300">
                    Take the headache out of Alliance Quests with a fully
                    automated and interactive scheduling system.
                  </p>
                </div>
              </Tilt>
              <Tilt
                tiltMaxAngleX={2}
                tiltMaxAngleY={2}
                perspective={1000}
                glareEnable={true}
                glareMaxOpacity={0.1}
                glarePosition="all"
                scale={1.02}
                className="rounded-xl"
                style={{ overflow: 'hidden' }}
              >
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-indigo-500/40 transition h-full">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-300 shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      Prestige & Profile Tracking
                    </h3>
                  </div>
                  <p className="text-sm text-slate-300">
                    Easily track your prestige progression and manage multiple
                    in-game accounts seamlessly.
                  </p>
                </div>
              </Tilt>
              <Tilt
                tiltMaxAngleX={2}
                tiltMaxAngleY={2}
                perspective={1000}
                glareEnable={true}
                glareMaxOpacity={0.1}
                glarePosition="all"
                scale={1.02}
                className="rounded-xl"
                style={{ overflow: 'hidden' }}
              >
                <div className="glass rounded-xl p-5 border border-slate-800/40 hover:border-pink-500/40 transition h-full">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-300 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-semibold text-white">
                      MCOC Glossary
                    </h3>
                  </div>
                  <p className="text-sm text-slate-300">
                    Instantly look up any in-game buff, debuff, or keyword with a
                    comprehensive glossary command.
                  </p>
                </div>
              </Tilt>
            </div>
          </div>
        </section>

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
                Slash commands you will love
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
                Search, filter, and copy commands directly into Discord. CereBro
                is fully slash-based and permission-aware.
              </p>
            </div>
          </div>

          <Suspense fallback={<div className="h-96 flex items-center justify-center text-slate-500">Loading commands...</div>}>
            <CommandReference isAdmin={isAdmin} />
          </Suspense>
        </section>

        <section id="howitworks" className="section-offset py-16 relative">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="text-center mb-16">
              <p className="text-xs uppercase tracking-wide text-sky-400/80 mb-2">
                Streamlined Onboarding
              </p>
              <h2 className="text-3xl font-bold text-white mb-4">
                Up and running in minutes
              </h2>
              <p className="text-slate-300 max-w-2xl mx-auto text-lg">
                We've stripped away the complexity. CereBro plugs directly into your
                existing Discord server structure.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 mb-12 relative">
              {/* Connecting Line (Desktop) */}
              <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-sky-500/0 via-sky-500/20 to-sky-500/0 border-t border-dashed border-slate-700/50 -z-10" />

              {/* Step 1 */}
              <Tilt
                tiltMaxAngleX={2}
                tiltMaxAngleY={2}
                perspective={1000}
                glareEnable={true}
                glareMaxOpacity={0.1}
                glarePosition="all"
                scale={1.02}
                className="rounded-xl"
                style={{ overflow: "hidden" }}
              >
                <div className="glass rounded-2xl p-8 border border-slate-800/40 hover:border-sky-500/40 transition h-full group">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-sky-400 mb-6 shadow-lg shadow-sky-900/10 group-hover:scale-110 transition-transform duration-300 relative z-10">
                    <span className="text-xl font-bold">1</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    Invite & Initialize
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Add CereBro to your server. It instantly creates a dedicated
                    workspace for your alliance data, secure and ready.
                  </p>
                </div>
              </Tilt>

              {/* Step 2 */}
              <Tilt
                tiltMaxAngleX={2}
                tiltMaxAngleY={2}
                perspective={1000}
                glareEnable={true}
                glareMaxOpacity={0.1}
                glarePosition="all"
                scale={1.02}
                className="rounded-xl"
                style={{ overflow: "hidden" }}
              >
                <div className="glass rounded-2xl p-8 border border-slate-800/40 hover:border-indigo-500/40 transition h-full group">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-indigo-400 mb-6 shadow-lg shadow-indigo-900/10 group-hover:scale-110 transition-transform duration-300 relative z-10">
                    <span className="text-xl font-bold">2</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    Map Your Roles
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Use{" "}
                    <code className="bg-slate-800 px-1.5 py-0.5 rounded text-indigo-300 text-sm">
                      /alliance config-roles
                    </code>{" "}
                    to link your Discord roles. CereBro automatically grants
                    permissions and sorts members.
                  </p>
                </div>
              </Tilt>

              {/* Step 3 */}
              <Tilt
                tiltMaxAngleX={2}
                tiltMaxAngleY={2}
                perspective={1000}
                glareEnable={true}
                glareMaxOpacity={0.1}
                glarePosition="all"
                scale={1.02}
                className="rounded-xl"
                style={{ overflow: "hidden" }}
              >
                <div className="glass rounded-2xl p-8 border border-slate-800/40 hover:border-pink-500/40 transition h-full group">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-pink-400 mb-6 shadow-lg shadow-pink-900/10 group-hover:scale-110 transition-transform duration-300 relative z-10">
                    <span className="text-xl font-bold">3</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">
                    Register & Sync
                  </h3>
                  <p className="text-slate-400 leading-relaxed">
                    Members run{" "}
                    <code className="bg-slate-800 px-1.5 py-0.5 rounded text-pink-300 text-sm">
                      /register
                    </code>{" "}
                    once. CereBro keeps your roster and prestige data in sync
                    automatically.
                  </p>
                </div>
              </Tilt>
            </div>

            <div className="flex justify-center gap-4">
              <Link
                href="https://discord.com/oauth2/authorize"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 transition-shadow"
              >
                Start setup
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
                    strokeWidth="1.5"
                    d="m9 5 7 7-7 7"
                  />
                </svg>
              </Link>
              <Link
                href="#faq"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg border border-slate-600/50 hover:bg-slate-800/50 transition"
              >
                Read FAQs
              </Link>
            </div>
          </div>
        </section>

        <section id="support" className="section-offset py-16 relative">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-pink-600/20 blur-[100px] rounded-full -z-10 pointer-events-none" />

          <div className="max-w-5xl mx-auto px-4 lg:px-6">
            <div className="relative rounded-3xl border border-pink-500/30 bg-slate-900/60 p-8 md:p-12 overflow-hidden backdrop-blur-sm">
              {/* Top Decor */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent opacity-50" />

              {/* Header */}
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-semibold uppercase tracking-wider mb-4">
                  <Heart className="w-3 h-3 fill-pink-500/50" />
                  Community Powered
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Help Keep CereBro Online
                </h2>
                <p className="text-slate-300 max-w-2xl mx-auto text-lg">
                  CereBro is a free, passion-driven project. Your support directly
                  funds the infrastructure required to process thousands of
                  rosters and war plans daily.
                </p>
              </div>

              {/* Breakdown Grid */}
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                {/* Item 1: Server Costs */}
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-950/30 border border-slate-800/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-sky-400 mb-3 shadow-lg shadow-sky-900/20">
                    <Server className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">
                    Server Costs
                  </h3>
                  <p className="text-sm text-slate-400">
                    Monthly hosting fees to ensure 99.9% uptime and fast response
                    times.
                  </p>
                </div>
                {/* Item 2: Storage */}
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-950/30 border border-slate-800/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-indigo-400 mb-3 shadow-lg shadow-indigo-900/20">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">
                    Data Storage
                  </h3>
                  <p className="text-sm text-slate-400">
                    Secure cloud storage for thousands of user rosters, images,
                    and war history.
                  </p>
                </div>
                {/* Item 3: Development */}
                <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-950/30 border border-slate-800/50">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-pink-400 mb-3 shadow-lg shadow-pink-900/20">
                    <Code className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">
                    Active Development
                  </h3>
                  <p className="text-sm text-slate-400">
                    Dedication to building new features, updating data, and
                    fixing bugs.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                {/* Ko-fi */}
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

                {/* PayPal */}
                <Link
                  href="#"
                  target="_blank"
                  className="group relative overflow-hidden rounded-xl bg-[#0070BA] transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-[#0070BA]/20"
                >
                  <div className="relative flex items-center justify-center gap-4 px-6 py-4 text-white">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-lg leading-none">
                        Donate via PayPal
                      </div>
                      <div className="text-xs text-white/90 mt-1 font-medium">
                        Direct contribution
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="get" className="py-10 pb-16">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="glass rounded-xl border border-slate-800/50 px-6 py-6 md:py-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Ready to give your MCOC server a brain?
                </h3>
                <p className="text-sm text-slate-300">
                  Invite CereBro now and use /register to link your account.
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
                <Link
                  href="https://discord.gg"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-slate-200 hover:text-white"
                >
                  Join support server
                </Link>
              </div>
            </div>
          </div>
        </section>

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