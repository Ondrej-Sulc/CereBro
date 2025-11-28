"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Swords, Menu, Book } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function Header({ userButton, isOfficer }: { userButton: React.ReactNode; isOfficer: boolean }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
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
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/war-videos" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
              <Book className="w-4 h-4" />
              War Archive
            </Link>
            {isOfficer && (
              <Link href="/planning" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
                <Swords className="w-4 h-4" />
                War Planning
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              {userButton}
            </div>
            <Link href="https://discord.com/api/oauth2/authorize?client_id=1259256672314130545&permissions=8&scope=bot%20applications.commands" target="_blank" className="hidden sm:inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold btn-primary text-slate-50 shadow-lg shadow-cyan-500/40">
              <span>Invite CereBro</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5 10a1 1 0 0 1 1-1h6.586L9.293 5.707a1 1 0 0 1 1.414-1.414l5 5a1 1 0 0 1 .083.094l.007.01a1 1 0 0 1 .182.573v.06a1 1 0 0 1-.272.628l-5 5a1 1 0 0 1-1.414-1.414L12.586 11H6a1 1 0 0 1-1-1z"/>
              </svg>
            </Link>

            {/* Mobile menu button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-slate-300 hover:text-white hover:bg-slate-800/50">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] border-l border-slate-800 bg-slate-950 p-6">
                <SheetHeader className="mb-8">
                  <SheetTitle className="flex items-center gap-3">
                    <Image src="/CereBro_logo_256.png" alt="CereBro Logo" width={32} height={32} className="rounded-xl" />
                    <span className="font-bold text-white">CereBro</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4">
                    <Link href="/war-videos" className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors">
                      <Book className="w-5 h-5" />
                      War Archive
                    </Link>
                    {isOfficer && (
                      <Link href="/planning" className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors">
                        <Swords className="w-5 h-5" />
                        War Planning
                      </Link>
                    )}
                  </div>
                  
                  <div className="h-px bg-slate-800 my-2" />
                  
                  <div>
                    {userButton}
                  </div>

                  <Link 
                    href="https://discord.com/api/oauth2/authorize?client_id=1259256672314130545&permissions=8&scope=bot%20applications.commands" 
                    target="_blank" 
                    className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold btn-primary text-slate-50 shadow-lg shadow-cyan-500/40 w-full"
                  >
                    <span>Invite CereBro</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 10a1 1 0 0 1 1-1h6.586L9.293 5.707a1 1 0 0 1 1.414-1.414l5 5a1 1 0 0 1 .083.094l.007.01a1 1 0 0 1 .182.573v.06a1 1 0 0 1-.272.628l-5 5a1 1 0 0 1-1.414-1.414L12.586 11H6a1 1 0 0 1-1-1z"/>
                    </svg>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}