import Link from "next/link";
import { HeroVisual } from "@/components/HeroVisual";
import { LiveSetup } from "@/components/LiveSetup";
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
  ChevronRight,
  Heart
} from "lucide-react";
import { Faq } from "@/components/Faq";
import PageBackground from "@/components/PageBackground";
import { InteractiveScreenshotDeck } from "@/components/InteractiveScreenshotDeck";
import { ScrollReveal } from "@/components/ScrollReveal";

export default async function Home() {

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
                Your Alliance&apos;s <br className="hidden lg:block"/>
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
                  className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-lg border border-indigo-500/50 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 transition-all"
                >
                  Join Community Discord
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
        <section id="web-platform" className="py-20 lg:py-32 relative overflow-hidden bg-slate-900/10">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-b from-transparent via-sky-500/5 to-sky-500/5 blur-[120px] -z-10" />
            
            <div className="max-w-7xl mx-auto px-4 lg:px-6">
                <div className="text-center mb-20">
                    <ScrollReveal direction="up">
                        <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-base font-bold uppercase tracking-[0.2em] mb-6">
                            <LayoutDashboard className="w-5 h-5" />
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
                                Plan your Attacks and Defense with player&apos;s rosters right at your fingertips, assign nodes, see the whole board. It&apos;s the easiest way to plan.
                            </p>
                        </ScrollReveal>
                        <ScrollReveal direction="left" className="order-1 lg:order-2 flex justify-center">
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
                        <ScrollReveal direction="right" className="order-1 lg:order-1 flex justify-center">
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

                    {/* Feature 3: Smart Roster & Prestige */}
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <ScrollReveal direction="right" className="order-2 lg:order-1">
                            <div className="w-12 h-12 rounded-xl bg-sky-900/50 border border-sky-800 flex items-center justify-center text-sky-400 mb-6">
                                <Award className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Smart Roster & Prestige</h3>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                Visualize your roster with advanced filtering. Simulate prestige rank-ups and optimize your signature stone usage with our intelligent budget calculator.
                            </p>
                        </ScrollReveal>
                        <ScrollReveal direction="left" className="order-1 lg:order-2 flex justify-center">
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

                    {/* Feature 4: Alliance Roster Overview */}
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <ScrollReveal direction="left" className="order-2 lg:order-2">
                            <div className="w-12 h-12 rounded-xl bg-sky-900/50 border border-sky-800 flex items-center justify-center text-sky-400 mb-6">
                                <Users className="w-6 h-6" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Alliance Roster Overview</h3>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                Officers get a bird&apos;s-eye view of the entire alliance. Filter champions by Battlegroup, Class, or Rank to find the perfect defenders or counters for war.
                            </p>
                        </ScrollReveal>
                        <ScrollReveal direction="right" className="order-1 lg:order-1 flex justify-center">
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
                                    widthClass="w-36 sm:w-48 md:w-64"
                                    overlap="-space-x-24 sm:-space-x-32 md:-space-x-36"
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
                                    widthClass="w-40 sm:w-56 md:w-72"
                                    overlap="-space-x-20 sm:-space-x-32 md:-space-x-40"
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
                <span className="text-emerald-400 font-mono text-xs uppercase tracking-wider mb-2 block">Easy Onboarding</span>
                <h2 className="text-3xl font-bold text-white">Setup in Seconds</h2>
                <p className="text-slate-400 mt-2">No complex config files. Just invite and link.</p>
             </div>
             <LiveSetup />
          </div>
        </section>
        
        {/* About & Support Teaser */}
        <section className="py-20 bg-slate-950">
            <div className="max-w-6xl mx-auto px-4 lg:px-6">
                <div className="glass rounded-3xl border border-slate-800 p-10 md:p-16 text-center relative overflow-hidden">
                     {/* Decorative Gradients */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[100px] -z-10" />
                    <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-500/5 blur-[100px] -z-10" />

                    <Heart className="w-12 h-12 text-pink-500/50 mx-auto mb-6" />
                    
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Built for the Community
                    </h2>
                    <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                        CereBro is a passion project maintained by an active player. Learn more about the developer and how you can support the project&apos;s growth.
                    </p>

                    <Link 
                        href="/about" 
                        className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium px-8 py-4 rounded-full transition-all hover:scale-105"
                    >
                        View About & Support
                        <ChevronRight className="w-4 h-4" />
                    </Link>
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
