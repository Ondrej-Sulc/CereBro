"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Swords, Menu, Book, Shield, UploadCloud, Trophy, ChevronDown, LayoutGrid, Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export default function Header({ userButton, isInAlliance, canUploadFiles }: { userButton: React.ReactNode; isInAlliance: boolean; canUploadFiles: boolean }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Automatically close mobile menu on route change using the render-sync pattern
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  }

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
              <p className="hidden lg:block text-[11px] text-slate-400 leading-none">The tactical advantage for MCOC</p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/profile/roster" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
              <LayoutGrid className="w-4 h-4" />
              My Roster
            </Link>
            
            <Link href="/war-videos" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
              <Book className="w-4 h-4" />
              War Archive
            </Link>

            {isInAlliance ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-800/50 h-auto py-2 px-3 data-[state=open]:text-white data-[state=open]:bg-slate-800/50"
                  >
                    <Users className="w-4 h-4" />
                    Alliance
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-slate-950 border-slate-800 text-slate-300">
                  <DropdownMenuLabel className="text-xs font-normal text-slate-500 uppercase tracking-wider">Management</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/alliance" className="cursor-pointer flex items-center gap-2 w-full focus:bg-slate-800 focus:text-white">
                        <Users className="w-4 h-4 text-slate-300" />
                        <span>Overview</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/alliance/roster" className="cursor-pointer flex items-center gap-2 w-full focus:bg-slate-800 focus:text-white">
                        <LayoutGrid className="w-4 h-4 text-slate-300" />
                        <span>Roster Overview</span>
                    </Link>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-slate-800" />
                  <DropdownMenuLabel className="text-xs font-normal text-slate-500 uppercase tracking-wider">War Room</DropdownMenuLabel>
                  
                  <DropdownMenuItem asChild>
                    <Link href="/planning" className="cursor-pointer flex items-center gap-2 w-full focus:bg-slate-800 focus:text-white">
                        <Swords className="w-4 h-4 text-red-400" />
                        <span>Attack Planning</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/planning/defense" className="cursor-pointer flex items-center gap-2 w-full focus:bg-slate-800 focus:text-white">
                        <Shield className="w-4 h-4 text-sky-400" />
                        <span>Defense Strategy</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/analysis/season-overview" className="cursor-pointer flex items-center gap-2 w-full focus:bg-slate-800 focus:text-white">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        <span>Season Stats</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
                <Link href="/alliance/onboarding" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
                    <Users className="w-4 h-4" />
                    Join Alliance
                </Link>
            )}

            <Link href="/war-videos/upload/init">
              <Button variant="outline" className="flex items-center gap-2 bg-slate-900/50 border-slate-700/50 hover:bg-slate-800/50 hover:border-sky-500/50 transition-colors h-9 px-3">
                <UploadCloud className="w-4 h-4" />
                <span className="hidden lg:inline">{canUploadFiles ? "Upload Video" : "Add Video"}</span>
              </Button>
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              {userButton}
            </div>

            {/* Mobile menu button */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
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
                    <Link 
                        href="/profile/roster" 
                        className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      <LayoutGrid className="w-5 h-5" />
                      My Roster
                    </Link>
                    <Link 
                        href="/war-videos" 
                        className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      <Book className="w-5 h-5" />
                      War Archive
                    </Link>
                    
                    {isInAlliance ? (
                      <>
                        <div className="h-px bg-slate-800/50 my-1" />
                        <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold pl-1">Alliance</span>
                        
                        <Link 
                            href="/alliance" 
                            className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors pl-2"
                        >
                            <Users className="w-5 h-5 text-slate-300" />
                            Overview
                        </Link>
                        <Link 
                            href="/alliance/roster" 
                            className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors pl-2"
                        >
                            <LayoutGrid className="w-5 h-5 text-slate-300" />
                            Roster Overview
                        </Link>
                        <Link 
                            href="/planning" 
                            className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors pl-2"
                        >
                            <Swords className="w-5 h-5 text-red-400" />
                            Attack Planning
                        </Link>
                        <Link 
                            href="/planning/defense" 
                            className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors pl-2"
                        >
                            <Shield className="w-5 h-5 text-sky-400" />
                            Defense Strategy
                        </Link>
                        <Link 
                            href="/analysis/season-overview" 
                            className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors pl-2"
                        >
                            <Trophy className="w-5 h-5 text-yellow-500" />
                            Season Stats
                        </Link>
                        
                        <div className="h-px bg-slate-800/50 my-1" />
                      </>
                    ) : (
                        <Link 
                            href="/alliance/onboarding" 
                            className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors"
                        >
                            <Users className="w-5 h-5 text-slate-300" />
                            Join/Create Alliance
                        </Link>
                    )}

                    <Link 
                        href="/war-videos/upload/init" 
                        className="flex items-center gap-2 text-lg font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      <UploadCloud className="w-5 h-5" />
                      {canUploadFiles ? "Upload Video" : "Add Video"}
                    </Link>
                  </div>
                  
                  <div className="h-px bg-slate-800 my-2" />
                  
                  <div>
                    {userButton}
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
