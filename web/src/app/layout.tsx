import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PHProvider, PostHogPageview } from "@/components/PostHogProvider";
import { MainLayout } from "@/components/layout/main-layout";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { VersionChecker } from "@/components/version-checker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CereBro - MCOC Discord Bot",
  description: "CereBro is the ultimate MCOC Discord bot, offering cutting-edge image processing for roster management, in-depth champion data, a comprehensive glossary, automated AQ tracking, and prestige tracking for a tactical advantage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appVersion = process.env.APP_VERSION || 'dev';

  return (
    <html lang="en" className="dark">
      <PHProvider>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-100 min-h-screen scroll-smooth bg-slate-950`}
        >
          <VersionChecker initialVersion={appVersion} />
          <Suspense>
            <PostHogPageview />
          </Suspense>
          <MainLayout>
            {children}
          </MainLayout>
          <Toaster />
        </body>
      </PHProvider>
    </html>
  );
}
