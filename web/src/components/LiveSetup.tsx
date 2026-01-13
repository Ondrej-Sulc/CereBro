import React from 'react';
import { Bot, RefreshCw, CheckCircle2, Link as LinkIcon } from 'lucide-react';
import Tilt from "@/components/TiltWrapper";
import Link from 'next/link';

export const LiveSetup = () => {
  return (
    <div className="relative">
      {/* Connecting Line (Desktop) */}
      <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-sky-500/0 via-sky-500/30 to-sky-500/0 border-t border-dashed border-slate-700/50 -z-10" />

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Step 1: Invite */}
        <Tilt className="h-full">
          <div className="relative h-full bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm group hover:border-sky-500/30 transition-colors flex flex-col">
            <div className="absolute -top-3 left-6 bg-slate-950 px-2 text-xs font-bold text-sky-500 border border-sky-500/20 rounded-full uppercase tracking-wider">
              Step 01
            </div>
            
            <div className="mb-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform shadow-lg shadow-sky-500/10">
                <Bot size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Invite & Auto-Init</h3>
                <p className="text-xs text-slate-400">Bot starts setup on join</p>
              </div>
            </div>
            
            {/* Visual Mockup */}
            <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800/50 font-mono text-[10px] text-slate-300 mb-4 flex-grow">
               <span className="text-emerald-400">➜</span> /invite <br/>
               <span className="text-sky-400 opacity-80">CereBro:</span> Setup wizard started.<br/>
               <span className="opacity-50">Creating alliance workspace...</span>
            </div>

            <Link
                href="https://discord.com/oauth2/authorize"
                target="_blank"
                className="w-full flex items-center justify-center gap-2 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-xs font-semibold py-2 rounded-lg border border-sky-500/20 transition-colors"
            >
                <LinkIcon size={12} />
                Get Invite Link
            </Link>
          </div>
        </Tilt>

        {/* Step 2: Configure */}
        <Tilt className="h-full">
          <div className="relative h-full bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm group hover:border-indigo-500/30 transition-colors flex flex-col">
            <div className="absolute -top-3 left-6 bg-slate-950 px-2 text-xs font-bold text-indigo-500 border border-indigo-500/20 rounded-full uppercase tracking-wider">
              Step 02
            </div>

            <div className="mb-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:rotate-12 transition-transform duration-700 shadow-lg shadow-indigo-500/10">
                <RefreshCw size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Configure Roles</h3>
                <p className="text-xs text-slate-400">Map Discord roles once</p>
              </div>
            </div>

            {/* Visual Mockup */}
            <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800/50 font-mono text-[10px] text-slate-300 flex-grow">
               <span className="text-emerald-400">➜</span> /setup roles <br/>
               <div className="mt-1 pl-2 border-l border-slate-700">
                   Officers: <span className="text-indigo-400">@Council</span><br/>
                   Member: <span className="text-indigo-400">@Symbiote</span>
               </div>
               <span className="text-green-400">✔ Configuration saved.</span>
            </div>
          </div>
        </Tilt>

        {/* Step 3: Auto-Sync */}
        <Tilt className="h-full">
          <div className="relative h-full bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 backdrop-blur-sm group hover:border-emerald-500/30 transition-colors flex flex-col">
            <div className="absolute -top-3 left-6 bg-slate-950 px-2 text-xs font-bold text-emerald-500 border border-emerald-500/20 rounded-full uppercase tracking-wider">
              Step 03
            </div>

            <div className="mb-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform shadow-lg shadow-emerald-500/10">
                <CheckCircle2 size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-white">Auto-Sync</h3>
                <p className="text-xs text-slate-400">Background magic</p>
              </div>
            </div>

            {/* Visual Mockup */}
            <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800/50 font-mono text-[10px] text-slate-300 flex-grow">
               <div className="flex items-center gap-2 mb-1">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                 <span className="text-white font-bold">Sync Active</span>
               </div>
               <div className="space-y-1 opacity-70">
                   <p>• 30 members linked</p>
                   <p>• Permissions granted</p>
                   <p>• Web access enabled</p>
               </div>
            </div>
          </div>
        </Tilt>

      </div>
    </div>
  );
};