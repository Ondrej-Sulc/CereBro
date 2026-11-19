import type { Metadata } from "next";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { BookOpen, ChevronRight, CircleHelp, Heart, LayoutDashboard, LogIn, Shield, Users, Video } from "lucide-react";
import { auth } from "@/auth";
import { signInAction } from "@/app/actions/auth";
import { Faq } from "@/components/Faq";
import { HomeDiscovery } from "@/components/home/HomeDiscovery";
import { HomeGameTools } from "@/components/home/HomeGameTools";
import { HomeOnboarding, HomeOperations, HomeWarVisual } from "@/components/home/HomeOperations";
import styles from "@/components/home/home-discovery.module.css";
import PageBackground from "@/components/PageBackground";
import { DISCORD_INVITE } from "@/lib/links";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getHomeFeaturedChampions } from "@/lib/data/home-featured-champions";
import { getHomeFeaturedRelics } from "@/lib/data/home-featured-relics";

export const metadata: Metadata = {
  title: "Alliance War Planning, Discord Bot & MCOC Reference Tools - CereBro",
  description: "Plan Alliance Wars and share assignments in Discord. Scout MCOC quest maps, look up effects and rewards, and explore champions, crystals and relics.",
};

const getHomeHeroStats = unstable_cache(
  async () => {
    const [players, alliances, rosters, warVideos] = await Promise.all([
      prisma.player.count(), prisma.alliance.count(), prisma.roster.count(), prisma.warVideo.count(),
    ]);
    return { players, alliances, rosters, warVideos };
  },
  ["home-hero-live-stats"],
  { revalidate: 900, tags: ["home", "hero-stats"] },
);

function formatCommunityStat(value: number) {
  if (value >= 1_000_000) return `${Math.floor(value / 1_000_000)}M+`;
  if (value >= 10_000) return `${Math.floor(value / 1_000)}K+`;
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function Home() {
  const [{ players, alliances, rosters, warVideos }, session, player, featuredChampions, featuredRelics] = await Promise.all([
    getHomeHeroStats(), auth(), getUserPlayerWithAlliance(), getHomeFeaturedChampions(), getHomeFeaturedRelics(),
  ]);
  const isSignedIn = !!session?.user;
  const canOpenWarPlanner = isSignedIn && !!player && (!!player.allianceId || player.isBotAdmin);
  const communityStats = [
    { label: "Players", value: players, icon: Users },
    { label: "Alliances", value: alliances, icon: Shield },
    { label: "Champions tracked", value: rosters, icon: LayoutDashboard },
    { label: "War videos", value: warVideos, icon: Video },
  ];

  return (
    <div className={`min-h-screen relative page-container ${styles.home}`}>
      <PageBackground />
        <section aria-labelledby="home-title" className={styles.hero}>
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroCopy}>
              <p className={styles.sectionBadge}><Shield aria-hidden="true" /> Alliance War &amp; Discord</p>
              <h1 id="home-title">Alliance War planning<br /><span className="gradient-text">&amp; MCOC game tools</span></h1>
              <p className={styles.heroDescription}>Plan Alliance Wars and share maps and player assignments in Discord. Scout quest maps, find champion counters and look up where to earn rewards.</p>
              <div className={styles.heroActions}>
                <Link href={canOpenWarPlanner ? "/planning" : "#setup"} prefetch={false} className={styles.primaryLink}>{canOpenWarPlanner ? "Open War Planner" : "Set up your alliance"} <ChevronRight aria-hidden="true" /></Link>
                <Link href="#game-tools" className={styles.secondaryLink}><BookOpen aria-hidden="true" /> Explore game tools</Link>
              </div>
              <p className={styles.heroReassurance}>Free to use</p>
              <div className={styles.heroAccount}>
                {!isSignedIn ? <form action={signInAction}><button type="submit"><LogIn aria-hidden="true" /> Sign in with Discord</button></form> : <Link href="/profile/roster">Open your roster <ChevronRight aria-hidden="true" /></Link>}
              </div>
              <nav aria-label="On this page" className={styles.heroNavigation}>
                <Link href="#web-platform">Alliance tools</Link><Link href="#explore">Champion &amp; item catalogs</Link><Link href="#setup">Get started</Link>
              </nav>
            </div>
            <HomeWarVisual />
          </div>
        </section>

        <section aria-labelledby="community-stats-title" className={styles.liveStats}>
          <div className={styles.container}>
            <h2 id="community-stats-title" className={styles.sectionBadge}><Users aria-hidden="true" /> Live community stats</h2>
            <dl className={styles.communityStats}>{communityStats.map(({ label, value, icon: Icon }) => <div key={label} className={styles.statTile}><dt><Icon aria-hidden="true" />{label}</dt><dd title={new Intl.NumberFormat("en-US").format(value)} aria-label={new Intl.NumberFormat("en-US").format(value)}><span aria-hidden="true">{formatCommunityStat(value)}</span></dd></div>)}</dl>
          </div>
        </section>

        <HomeGameTools />
        <HomeOperations />
        <HomeDiscovery featuredChampions={featuredChampions} featuredRelics={featuredRelics} />
        <HomeOnboarding />

        <section aria-label="CereBro community" className={styles.community}>
          <div className={styles.container}>
            <div className={styles.supportGrid}>
              <article className={styles.supportCard}><div className={styles.sectionBadge}><Users aria-hidden="true" /> Community</div><h2>Setup help &amp; updates</h2><p>Join the CereBro Discord for setup help, updates and a conversation with other players.</p><Link href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className={styles.textLink}>Join Community Discord <ChevronRight aria-hidden="true" /></Link></article>
              <article className={styles.supportCard}><div className={styles.sectionBadge}><Heart aria-hidden="true" /> Support</div><h2>Support CereBro</h2><p>Help cover development and hosting if CereBro is useful to you or your alliance.</p><Link href="/support" className={styles.textLink}>Support CereBro <ChevronRight aria-hidden="true" /></Link></article>
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-title" className={styles.faqSection}>
          <div className={styles.container}>
            <div className={styles.sectionHeading}><div><p className={styles.sectionBadge}><CircleHelp aria-hidden="true" /> Help</p><h2 id="faq-title">Frequently asked questions</h2></div></div>
            <Faq />
          </div>
        </section>
    </div>
  );
}
