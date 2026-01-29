import Image from "next/image";
import Link from "next/link";
import { 
  Coffee, 
  Server, 
  Sparkles, 
  Code,
  Gamepad2,
  Github,
  Heart,
  MessageSquare,
  ChevronRight
} from "lucide-react";
import PageBackground from "@/components/PageBackground";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About & Support - CereBro",
  description: "Meet the developer behind CereBro and support the project.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen relative page-container pt-20 pb-20">
      <PageBackground />
      <main className="relative z-10">
        
        {/* Header */}
        <div className="max-w-6xl mx-auto px-4 lg:px-6 mb-16 text-center lg:text-left">
             <p className="text-xs uppercase tracking-[0.2em] text-pink-400 font-bold mb-2">
                Project & Community
            </p>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                About & Support
            </h1>
            <p className="text-lg text-slate-300 max-w-2xl leading-relaxed">
                The story behind CereBro and how you can join our community or help keep the project running.
            </p>
        </div>

        {/* Community Hub Section */}
        <section className="pb-16">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <div className="relative group overflow-hidden rounded-3xl border border-indigo-500/30 bg-indigo-500/5 p-8 md:p-12 backdrop-blur-sm transition-all hover:border-indigo-500/50">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-[80px] -z-10" />
                
                <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="text-center md:text-left max-w-xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
                            <MessageSquare className="w-3 h-3" />
                            Community Hub
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4">Join our Discord Server</h2>
                        <p className="text-slate-300 text-lg leading-relaxed">
                            Need help with setup? Want to see the latest updates or try out new bot commands before they go live? Our community server is the place to be.
                        </p>
                    </div>
                    
                    <Link
                        href="https://discord.gg/eRv7fkMHmU"
                        target="_blank"
                        className="flex items-center gap-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-8 py-4 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
                    >
                        <Gamepad2 className="w-6 h-6" />
                        Join CereBro Community
                        <ChevronRight className="w-5 h-5" />
                    </Link>
                </div>
            </div>
          </div>
        </section>

        {/* Meet the Developer */}
        <section className="py-10">
          <div className="max-w-6xl mx-auto px-4 lg:px-6">
            <ScrollReveal direction="up">
              <div className="relative glass rounded-3xl border border-slate-800/50 p-8 md:p-12 overflow-hidden bg-slate-900/40">
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] -z-10" />
                
                <div className="flex flex-col md:flex-row items-center gap-10">
                  {/* Avatar */}
                  <div className="shrink-0">
                      <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border-2 border-indigo-500/30 p-1 bg-slate-900 shadow-xl shadow-indigo-500/10 hover:scale-105 transition-transform duration-500">
                        <Image 
                          src="/avatar.png" 
                          alt="Solomon" 
                          fill 
                          className="object-cover rounded-xl"
                        />
                      </div>
                  </div>

                  {/* Bio Content */}
                  <div className="text-center md:text-left">
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
                      <h2 className="text-3xl font-bold text-white">Hi, I&apos;m Solomon</h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                        Creator of CereBro
                      </span>
                    </div>
                    
                    <p className="text-slate-300 text-lg leading-relaxed mb-6">
                      I&apos;m a developer from Czechia and a passionate MCOC player since 2018. I&apos;ve been a member of my alliance <strong className="text-white">Night Guardians</strong> from the start of my journey. The last few years we have been competing in <strong className="text-white">Tier 1</strong> Alliance Wars.
                    </p>
                    
                    <p className="text-slate-400 leading-relaxed">
                      I&apos;ve been creating spreadsheets for our alliance since the beginning — for defense planning, Alliance Quest, war attack planning, and roster tracking. Manual roster updates became tedious, so I built a Discord bot to parse game screenshots. What started as a small internal tool for the Night Guardians grew into a full-featured bot and, eventually, the platform you see today: CereBro. It&apos;s the result of years spent collecting champion data and building tools to make alliance management less of a chore and more of a tactical advantage.
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
                      <Link 
                        href="https://github.com/Ondrej-Sulc/CereBro" 
                        target="_blank"
                        className="flex items-center gap-2 hover:text-indigo-400 transition-colors"
                      >
                        <Github className="w-4 h-4 text-indigo-400" />
                        GitHub Repo
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Support Section */}
        <section id="support" className="py-10 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-pink-600/10 blur-[100px] rounded-full -z-10 pointer-events-none" />

          <div className="max-w-6xl mx-auto px-4 lg:px-6">
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
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-semibold mb-1">
                    Image Processing
                  </h3>
                  <p className="text-sm text-slate-400">
                    Smart screenshot processing for simple roster tracking.
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
                        One-time/recurring donation
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
