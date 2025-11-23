"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { SmoothScrollLink } from "@/components/SmoothScrollLink";

export default function Header({ userButton }: { userButton: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) { // md breakpoint
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      <header className={`sticky top-0 inset-x-0 z-30 nav-blur transition-colors duration-300 ${isScrolled ? 'bg-slate-950/80 border-b border-slate-800/70' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/CereBro_logo_256.png" alt="CereBro Logo" width={36} height={36} className="rounded-2xl" />
              <div className="hidden sm:block">
                <p className="font-semibold tracking-tight text-sm">CereBro</p>
                <p className="text-[11px] text-slate-400 leading-none">The tactical advantage for MCOC</p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4 text-sm">
              <Link href="/war-videos" className="text-slate-300 hover:text-white transition-colors">War Archive</Link>
            </nav>

            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                {userButton}
              </div>
              <Link href="https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=8&scope=bot%20applications.commands" target="_blank" className="hidden sm:inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold btn-primary text-slate-50 shadow-lg shadow-cyan-500/40">
                <span>Invite CereBro</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 10a1 1 0 0 1 1-1h6.586L9.293 5.707a1 1 0 0 1 1.414-1.414l5 5a1 1 0 0 1 .083.094l.007.01a1 1 0 0 1 .182.573v.06a1 1 0 0 1-.272.628l-5 5a1 1 0 0 1-1.414-1.414L12.586 11H6a1 1 0 0 1-1-1z"/>
                </svg>
              </Link>

              {/* Mobile menu button */}
              <button
                className="md:hidden text-slate-300 hover:text-white transition-colors"
                onClick={toggleMobileMenu}
                aria-label="Open mobile menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-40 flex items-center justify-center"
          onClick={toggleMobileMenu}
        >
          <div 
            className="w-full max-w-xs mx-auto bg-slate-900/95 rounded-lg p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-white">Menu</span>
              <button
                className="text-slate-300 hover:text-white transition-colors"
                onClick={toggleMobileMenu}
                aria-label="Close mobile menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col items-start space-y-6 text-lg mt-6">
              <Link href="/war-videos" className="text-slate-300 hover:text-white transition-colors" onClick={toggleMobileMenu}>War Archive</Link>
              <div className="w-full pt-4 border-t border-slate-800">
                {userButton}
              </div>
              <Link href="https://discord.com/api/oauth2/authorize?client_id=YOUR_BOT_ID&permissions=8&scope=bot%20applications.commands" target="_blank" className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold btn-primary text-slate-50 shadow-lg shadow-cyan-500/40 mt-4">
                <span>Invite CereBro</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5 10a1 1 0 0 1 1-1h6.586L9.293 5.707a1 1 0 0 1 1.414-1.414l5 5a1 1 0 0 1 .083.094l.007.01a1 1 0 0 1 .182.573v.06a1 1 0 0 1-.272.628l-5 5a1 1 0 0 1-1.414-1.414L12.586 11H6a1 1 0 0 1-1-1z"/>
                </svg>
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}