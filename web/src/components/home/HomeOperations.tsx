import Link from "next/link";
import { ArrowUpRight, Bot, Compass, Map, ScanLine, Search, Users, Video } from "lucide-react";
import styles from "./home-discovery.module.css";
import { ScreenshotPreview } from "./ScreenshotPreview";

export const BOT_INVITE = "https://discord.com/oauth2/authorize?client_id=1184180809771520091";

export function HomeWarVisual() {
  return (
    <div className={styles.warVisual} aria-label="CereBro war planning on the web and in Discord">
      <figure className={styles.webPreview}>
        <figcaption><Map aria-hidden="true" /> Plan on the web</figcaption>
        <div><ScreenshotPreview src="/war-map.png" alt="CereBro war map with roster assignments and matchup history" title="Alliance War planner" width={1729} height={1078} priority sizes="(min-width: 1024px) 45vw, 90vw" /></div>
      </figure>
      <figure className={styles.discordPreview}>
        <figcaption><Bot aria-hidden="true" /> Share in Discord</figcaption>
        <div className={styles.discordScreenshot}><ScreenshotPreview src="/discord-war-1.png" alt="CereBro battlegroup war plan shared in Discord" title="Battlegroup plan in Discord" width={732} height={543} priority sizes="(min-width: 1024px) 25vw, 55vw" /></div>
      </figure>
    </div>
  );
}

const tools = [
  { title: "Roster & prestige", description: "Filter champions, plan rank-ups and signature stones, and inspect alliance rosters.", image: "/web-roster.png", width: 1761, height: 1037, icon: Users, href: "/profile/roster", label: "Open your roster", secondaryHref: "/alliance/roster", secondaryLabel: "Alliance roster" },
  { title: "Quest planning", description: "Save quest routes and choose roster counters that meet fight restrictions.", image: "/quest-planner.png", width: 1638, height: 1077, icon: Compass, href: "/planning/quests", label: "Open Quest Planner" },
  { title: "War video library", description: "Find recorded matchups or upload fights with their matchup details.", image: "/war-archive.png", width: 1280, height: 739, icon: Video, href: "/war-videos", label: "Browse war videos" },
];

export function HomeOperations() {
  return (
    <section id="web-platform" aria-labelledby="operations-title" className={styles.operations}>
      <div className={styles.container}>
        <div className={styles.sectionHeading}>
          <div><p className={styles.sectionBadge}><Map aria-hidden="true" /> Alliance tools</p><h2 id="operations-title">War planning &amp; Discord</h2></div>
        </div>
        <div className={styles.operationsGrid}>
          <article className={styles.warFeature}>
            <h3><Map aria-hidden="true" />Alliance War planning</h3>
            <ol className={styles.warSteps}>
              <li><span>01</span><div><h4>Interactive war map</h4><p>Assign defenders, attackers and prefights to nodes.</p></div></li>
              <li><span>02</span><div><h4>Rosters &amp; matchup history</h4><p>Check roster availability, past fights and linked recordings.</p></div></li>
              <li><span>03</span><div><h4>Discord distribution</h4><p>Send battlegroup overviews and each player&apos;s assignments.</p></div></li>
            </ol>
            <div className={styles.operationLinks}><Link href="/planning" prefetch={false} className={styles.primaryLink}>Open War Planner <ArrowUpRight aria-hidden="true" /></Link><Link href="#setup" className={styles.textLink}>Set up your alliance <ArrowUpRight aria-hidden="true" /></Link></div>
          </article>
          <article id="discord-bot" className={styles.botFeature}>
            <h3><Bot aria-hidden="true" />Discord bot</h3>
            <ul className={styles.botTools}>
              <li><Search aria-hidden="true" /><div><h4>Champion intel, in chat</h4><p>Look up abilities, immunities and duel targets, or search your roster for a counter.</p></div></li>
              <li><ScanLine aria-hidden="true" /><div><h4>Roster screenshot import</h4><p>Upload your in-game roster screenshots to add champions to your CereBro profile.</p></div></li>
              <li><Bot aria-hidden="true" /><div><h4>AQ check-ins &amp; reminders</h4><p>Check in your Alliance Quest progress and get timed reminders when your battlegroup still has moves to make.</p></div></li>
            </ul>
            <div className={styles.operationLinks}><Link href={BOT_INVITE} target="_blank" rel="noopener noreferrer" className={styles.primaryLink}>Add to Your Server <ArrowUpRight aria-hidden="true" /></Link><Link href="/commands" className={styles.textLink}>Browse commands <ArrowUpRight aria-hidden="true" /></Link></div>
          </article>
        </div>
        <div className={styles.utilityGrid}>
          {tools.map(({ title, description, image, width, height, icon: Icon, href, label, secondaryHref, secondaryLabel }) => (
            <article key={title} className={styles.utilityCard}>
              <div className={styles.utilityPreview}><ScreenshotPreview src={image} alt={`CereBro ${title.toLowerCase()} interface`} title={title} width={width} height={height} sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 88px" /></div>
              <div className={styles.utilityCopy}><h3><Icon aria-hidden="true" /> {title}</h3><p>{description}</p><div className={styles.utilityLinks}><Link href={href} prefetch={false} className={styles.textLink}>{label} <ArrowUpRight aria-hidden="true" /></Link>{secondaryHref && <Link href={secondaryHref} prefetch={false} className={styles.sampleLink}>{secondaryLabel} <ArrowUpRight aria-hidden="true" /></Link>}</div></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeOnboarding() {
  return (
    <section id="setup" aria-labelledby="setup-title" className={styles.onboarding}>
      <div className={styles.container}>
        <div className={styles.sectionHeading}><div><p className={styles.sectionBadge}><Users aria-hidden="true" /> Get started</p><h2 id="setup-title">Alliance setup</h2></div><p>Browse public catalogs without signing in. Sign in with Discord for your own roster and alliance tools.</p></div>
        <div className={styles.onboardingGrid}>
          <article className={styles.onboardingCard}><h3><Bot aria-hidden="true" />For officers</h3><p>Add CereBro to your Discord server to create an alliance automatically, then configure roles and channels. You can also create an alliance on the website.</p><div className={styles.onboardingLinks}><Link href={BOT_INVITE} target="_blank" rel="noopener noreferrer" className={styles.textLink}>Add to Your Server <ArrowUpRight aria-hidden="true" /></Link><Link href="/alliance/onboarding" className={styles.textLink}>Create an alliance on the web <ArrowUpRight aria-hidden="true" /></Link></div></article>
          <article className={styles.onboardingCard}><h3><Users aria-hidden="true" />For members</h3><p>Joining an existing alliance? Follow your officers&apos; Discord role setup to join through role sync, or request to join on the website. Officers approve join requests.</p><Link href="/alliance/onboarding" className={styles.textLink}>Request to join an alliance <ArrowUpRight aria-hidden="true" /></Link></article>
        </div>
        <p className={styles.onboardingNote}>Officers who created an alliance on the website can link its Discord server: generate a code in <Link href="/alliance">Alliance settings</Link> and run <code>/alliance link</code> in Discord.</p>
      </div>
    </section>
  );
}
