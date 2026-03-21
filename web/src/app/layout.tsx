import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PHProvider, PostHogPageview } from "@/components/PostHogProvider";
import { MainLayout } from "@/components/layout/main-layout";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { VersionChecker } from "@/components/version-checker";
import { QueryErrorToast } from "@/components/QueryErrorToast";

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
  applicationName: "CereBro",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/CereBro_logo_512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/icon-192.png"],
  },
  appleWebApp: {
    capable: true,
    title: "CereBro",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appVersion = process.env.APP_VERSION || 'dev';

  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var isStaleError = function(msg, name) {
                  return msg && (
                    msg.indexOf("Failed to find Server Action") !== -1 ||
                    msg.indexOf("failed-to-find-server-action") !== -1 ||
                    msg.indexOf("was not found on the server") !== -1 ||
                    msg.indexOf("older or newer deployment") !== -1 || 
                    msg.indexOf("c[e] is undefined") !== -1 || 
                    msg.indexOf("property 'call' of undefined") !== -1 ||
                    msg.indexOf("ChunkLoadError") !== -1 ||
                    msg.indexOf("loading chunk") !== -1 ||
                    name === "ChunkLoadError"
                  );
                };

                var safeReload = function() {
                  try {
                    var lastReload = sessionStorage.getItem('last-deployment-reload');
                    var now = Date.now();
                    if (!lastReload || (now - parseInt(lastReload)) > 10000) {
                      sessionStorage.setItem('last-deployment-reload', now.toString());
                      window.location.reload();
                    }
                  } catch (e) {
                    window.location.reload();
                  }
                };

                window.onerror = function(msg, url, line, col, error) {
                  if (isStaleError(msg, error && error.name)) {
                    console.warn("Critical deployment mismatch detected (window.onerror), reloading...");
                    safeReload();
                    return true;
                  }
                };

                window.onunhandledrejection = function(event) {
                  var msg = (event.reason && event.reason.message) || String(event.reason || "");
                  if (isStaleError(msg, event.reason && event.reason.name)) {
                    console.warn("Critical deployment mismatch detected (unhandledrejection), reloading...");
                    safeReload();
                  }
                };
              })();
            `,
          }}
        />
      </head>
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
          <QueryErrorToast />
          <Toaster />
        </PHProvider>
      </body>
    </html>
  );
}
