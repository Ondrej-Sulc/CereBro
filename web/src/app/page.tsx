import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import CommandReference from "@/components/CommandReference";
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                        />
                      </svg>
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm-3.75 0h.008v.015h-.008V9.375z"
                        />
                      </svg>
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5z"
                        />
                      </svg>
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M-4.5 12h13.5"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                        />
                      </svg>
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-.625m3.75.625l-6.25 3.75"
                        />
                      </svg>
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
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v-3m0 3h.008v.008H12v-.008z"
                        />
                      </svg>
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

        <section id="howitworks" className="section-offset py-10 lg:py-14">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="text-center mb-10">
              <p className="text-xs uppercase tracking-wide text-sky-400/80 mb-1">
                How it works
              </p>
              <h2 className="text-2xl font-semibold text-white mb-3">
                Simple to set up, powerful when configured
              </h2>
              <p className="text-sm text-slate-300 max-w-2xl mx-auto">
                CereBro guides your officers through initial setup, then
                automates daily operations.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
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
                <div className="glass rounded-xl p-6 border border-slate-800/40 hover:border-sky-500/40 transition h-full">
                  <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-300 mb-4 border border-sky-500/20">
                    <span className="text-lg font-bold">1</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">Invite the bot</h3>
                  <p className="text-sm text-slate-300">
                    Grant required permissions for channels and roles. CereBro will guide you through the setup process.
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
                <div className="glass rounded-xl p-6 border border-slate-800/40 hover:border-indigo-500/40 transition h-full">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-300 mb-4 border border-indigo-500/20">
                    <span className="text-lg font-bold">2</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">Register Your Profile</h3>
                  <p className="text-sm text-slate-300">
                    Use the /register command to link your MCOC in-game name and start building your roster.
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
                <div className="glass rounded-xl p-6 border border-slate-800/40 hover:border-pink-500/40 transition h-full">
                  <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-300 mb-4 border border-pink-500/20">
                    <span className="text-lg font-bold">3</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">Review dashboards</h3>
                  <p className="text-sm text-slate-300">
                    Use web or Discord embeds to monitor progress and manage your alliance efficiently.
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

        <section id="support" className="section-offset py-10 lg:py-14">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 text-center">
            <p className="text-xs uppercase tracking-wide text-pink-400/80 mb-1">
              Support the Project
            </p>
            <h2 className="text-2xl font-semibold text-white mb-3">
              Help Keep CereBro Running
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl mx-auto mb-8">
              CereBro is a passion project, offered completely free. If you find
              the bot useful, please consider supporting its development and
              hosting costs. Donations are greatly appreciated but never
              required.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg mx-auto">
              <a
                href="https://ko-fi.com/cerebrobot"
                target="_blank"
                rel="noopener noreferrer"
                className="glass rounded-xl p-5 border border-slate-800/40 hover:border-pink-500/40 transition card-tilt flex items-center gap-4"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-8 h-8 text-pink-300 icon icon-tabler icon-tabler-coffee"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M3 14c.83 .642 2.077 1.017 3.5 1h9c1.423 .017 2.67 -.358 3.5 -1" />
                  <path d="M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2h8a2.4 2.4 0 0 0 1 -2a2.4 2.4 0 0 0 -1 -2h-8z" />
                  <path d="M3 14v3m18 -3v3" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-white text-left">
                    Buy me a snack
                  </h3>
                  <p className="text-xs text-slate-300 text-left">
                    A small, one-time donation through Ko-fi.
                  </p>
                </div>
              </a>
              <a
                href="#"
                target="_blank"
                rel="noopener noreferrer"
                className="glass rounded-xl p-5 border border-slate-800/40 hover:border-sky-500/40 transition card-tilt flex items-center gap-4"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-8 h-8 text-sky-300 icon icon-tabler icon-tabler-currency-dollar"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2" />
                  <path d="M12 18v3m0 -18v3" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-white text-left">
                    Donate with PayPal
                  </h3>
                  <p className="text-xs text-slate-300 text-left">
                    Make a direct donation using PayPal.
                  </p>
                </div>
              </a>
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