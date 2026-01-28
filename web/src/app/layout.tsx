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
  title: "CereBro — MCOC Alliance Operating System",
  description: "CereBro is a comprehensive management platform for MCOC Alliances, offering advanced roster tracking via image processing, strategic war planning, automated AQ management, and deep champion insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appVersion = process.env.APP_VERSION || 'dev';

  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased text-slate-100 min-h-screen scroll-smooth bg-slate-950`}
      >
        <PHProvider>
          <VersionChecker initialVersion={appVersion} />
          <Suspense>
            <PostHogPageview />
          </Suspense>
          <MainLayout>
            {children}
          </MainLayout>
          <Toaster />
        </PHProvider>
      </body>
    </html>
  );
}
