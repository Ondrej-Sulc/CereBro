import React from 'react';
import Image from "next/image";

export const HeroVisual = () => {
  return (
    <div className="relative w-full max-w-[800px] mx-auto perspective-1000 group mt-8 sm:mt-0 pb-12">
      
      {/* Abstract Background Glow - Move it slightly up and make it more diffused */}
      <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-500/10 blur-[120px] rounded-full -z-10" />

      {/* ==============================================
          1. DESKTOP SCREENSHOT (Web Dashboard)
          Positioned Back Left
      ============================================== */}
      <div className="relative w-[85%] aspect-[16/10] bg-[#0f172a] rounded-xl border border-slate-700/40 shadow-2xl shadow-black/80 transform rotate-y-3 rotate-x-1 transition-transform duration-700 ease-out z-10 hover:z-30 hover:rotate-y-0 hover:rotate-x-0 group-hover:translate-x-[-10px] overflow-hidden">
        {/* Modern Browser Chrome */}
        <div className="h-7 bg-[#1e293b] border-b border-slate-700/50 flex items-center px-4 gap-4">
          <div className="flex gap-1.5 opacity-40">
             <div className="w-2 h-2 rounded-full bg-slate-500" />
             <div className="w-2 h-2 rounded-full bg-slate-500" />
             <div className="w-2 h-2 rounded-full bg-slate-500" />
          </div>
          <div className="flex-1 max-w-sm h-4 bg-[#0f172a]/50 rounded-md border border-slate-700/30 flex items-center px-2">
             <div className="w-full h-[2px] bg-slate-700/50 rounded-full max-w-[120px]" />
          </div>
        </div>
        
        {/* The Image */}
        <div className="relative w-full h-full bg-slate-900">
           <Image 
             src="/hero-desktop.png" 
             alt="CereBro War Room Interface" 
             fill
             className="object-cover object-top"
             priority
           />
        </div>
      </div>

      {/* ==============================================
          2. MOBILE SCREENSHOT (Discord App)
          Positioned Front Right
      ============================================== */}
      <div className="absolute bottom-[-5%] right-0 w-[32%] aspect-[9/19] bg-[#313338] rounded-2xl border-[5px] border-[#1E1F22] shadow-2xl shadow-black/90 transform -rotate-y-6 translate-z-20 transition-transform duration-700 ease-out z-40 hover:z-50 hover:rotate-y-0 hover:translate-y-[-10px] group-hover:translate-x-[15px] overflow-hidden">
        
        {/* Phone Notch / Discord Icon Area */}
        <div className="absolute top-0 inset-x-0 h-6 bg-[#1E1F22] z-10 flex items-center justify-center">
            <div className="w-16 h-4 bg-[#0f172a] rounded-full flex items-center justify-center gap-1.5">
                {/* Discord Icon SVG */}
                <svg className="w-2.5 h-2.5 text-[#5865F2] fill-current" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <div className="w-4 h-[1px] bg-slate-700/50" />
            </div>
        </div>

        {/* The Image */}
        <div className="relative w-full h-full bg-[#313338]">
           <Image 
             src="/hero-mobile.png" 
             alt="CereBro Mobile Discord Interface" 
             fill
             className="object-cover object-top"
             priority
           />
        </div>
      </div>
    </div>
  );
};