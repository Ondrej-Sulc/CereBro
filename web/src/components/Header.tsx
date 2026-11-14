"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  Diamond,
  Gem,
  Heart,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  Map,
  Menu,
  Search,
  Shield,
  Swords,
  Tags,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CollectionNavLink } from "@/components/collections/collection-navigation";
import { HeaderOverlayContext, type HeaderOverlay } from "./header-overlay";
import { DISCORD_INVITE } from "@/lib/links";
import styles from "./header.module.css";

type Destination = {
  label: string;
  href: string;
  icon: LucideIcon;
  section?: "champions" | "relics";
};
const champions: Destination = {
  label: "Champions",
  href: "/champions",
  section: "champions",
  icon: LayoutGrid,
};
const relics: Destination = {
  label: "Relics", href: "/relics", section: "relics", icon: Gem,
};
const explore: Destination[] = [
  { label: "Crystals", href: "/crystals", icon: Diamond },
  { label: "Quest Planner", href: "/planning/quests", icon: Map },
  { label: "Quest explorer", href: "/quests", icon: Map },
  { label: "Effect glossary", href: "/glossary", icon: BookOpen },
  { label: "Node modifiers", href: "/nodes", icon: Tags },
  { label: "Game assets", href: "/assets", icon: ImageIcon },
];
const alliance: Destination[] = [
  { label: "Attack Planning", href: "/planning", icon: Swords },
  { label: "Defense Strategy", href: "/planning/defense", icon: Shield },
  { label: "Roster Overview", href: "/alliance/roster", icon: LayoutGrid },
  { label: "Alliance Overview", href: "/alliance", icon: Users },
  { label: "Season Stats", href: "/analysis/season-overview", icon: Trophy },
];
const onboarding: Destination = {
  label: "Join / Create Alliance",
  href: "/alliance/onboarding",
  icon: Users,
};
const community: Destination[] = [
  { label: "War Archive", href: "/war-videos", icon: BookOpen },
  { label: "Community Discord", href: DISCORD_INVITE, icon: Users },
  { label: "Support CereBro", href: "/support", icon: Heart },
  { label: "About", href: "/about", icon: Info },
];
const search: Destination = {
  label: "Search players & alliances",
  href: "/search",
  icon: Search,
};

function isCurrent(pathname: string, item: Destination) {
  // These roots must not also highlight their sibling destinations.
  if (item.href === "/alliance") return pathname === item.href;
  if (item.href === "/planning")
    return (
      pathname === "/planning" ||
      (pathname.startsWith("/planning/") &&
        !["quests", "defense"].some(
          (segment) =>
            pathname === `/planning/${segment}` ||
            pathname.startsWith(`/planning/${segment}/`),
        ))
    );
  const matches = (path: string) =>
    pathname === path || pathname.startsWith(`${path}/`);
  return (
    matches(item.href) ||
    (item.section === "champions" && matches("/profile/roster")) ||
    (item.section === "relics" && matches("/profile/relics"))
  );
}

export default function Header({
  userButton,
  isInAlliance,
  hasPlayerProfile,
}: {
  userButton: ReactNode;
  isInAlliance: boolean;
  hasPlayerProfile: boolean;
}) {
  const pathname = usePathname();
  const [overlay, setOverlay] = useState<HeaderOverlay>(null);
  const [previousPath, setPreviousPath] = useState(pathname);
  if (pathname !== previousPath) {
    setPreviousPath(pathname);
    setOverlay(null);
  }
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = () => setOverlay(null);
    media.addEventListener("change", close);
    window.addEventListener("popstate", close);
    return () => {
      media.removeEventListener("change", close);
      window.removeEventListener("popstate", close);
    };
  }, []);

  const close = () => setOverlay(null);
  const destination = (item: Destination, inDropdown = false) => {
    const Icon = item.icon;
    const external = item.href.startsWith("https://");
    const props = {
      className: styles.link,
      "aria-current": isCurrent(pathname, item) ? ("page" as const) : undefined,
      onClick: close,
    };
    const content = (
      <>
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
        {external && (
          <ArrowUpRight className={styles.external} aria-hidden="true" />
        )}
      </>
    );
    const link = item.section ? (
      <CollectionNavLink
        section={item.section}
        canUsePersonal={hasPlayerProfile}
        {...props}
      >
        {content}
      </CollectionNavLink>
    ) : (
      <Link
        href={item.href}
        {...props}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {content}
      </Link>
    );
    return inDropdown ? (
      <DropdownMenuItem key={item.href} asChild>
        {link}
      </DropdownMenuItem>
    ) : (
      <div key={item.href}>
        {link}
      </div>
    );
  };
  const allianceDestinations = isInAlliance ? alliance : [onboarding];
  const allianceActive = allianceDestinations.some((item) =>
    isCurrent(pathname, item),
  );
  const dropdown = (
    name: "alliance" | "explore" | "more",
    label: string,
    active: boolean,
    children: ReactNode,
  ) => (
    <DropdownMenu
      open={overlay === name}
      onOpenChange={(open) =>
        setOverlay((current) =>
          open ? name : current === name ? null : current,
        )
      }
      modal={false}
    >
      <DropdownMenuTrigger
        id={`site-header-${name}-trigger`}
        className={styles.groupButton}
        data-active={active || undefined}
      >
        {label}
        <ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        aria-labelledby={`site-header-${name}-trigger`}
        align="start"
        sideOffset={10}
        className={styles.dropdown}
        onCloseAutoFocus={(event) => {
          if (overlay && overlay !== name) event.preventDefault();
        }}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <HeaderOverlayContext.Provider value={{ overlay, setOverlay }}>
      <header className={styles.header}>
        <div className={styles.row}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="CereBro home"
            onClick={close}
          >
            <Image src="/CereBro_logo_256.png" alt="" width={36} height={36} />
            <span>CereBro</span>
          </Link>
          <nav className={styles.desktopNav} aria-label="Primary">
            {destination(champions)}
            {dropdown(
              "alliance",
              "Alliance",
              allianceActive,
              <>
                {allianceDestinations.map((item) =>
                  destination(item, true),
                )}
              </>,
            )}
            {destination(relics)}
            {dropdown(
              "explore",
              "Explore",
              explore.some((item) => isCurrent(pathname, item)),
              <>{explore.map((item) => destination(item, true))}</>,
            )}
            {dropdown(
              "more",
              "More",
              community.some((item) => isCurrent(pathname, item)),
              <>
                <DropdownMenuLabel className={styles.groupLabel}>Community &amp; help</DropdownMenuLabel>
                {community.map((item) => destination(item, true))}
              </>,
            )}
          </nav>
          <div className={styles.tools}>
            <Link
              href="/search"
              className={styles.search}
              aria-label="Search players and alliances"
              aria-current={isCurrent(pathname, search) ? "page" : undefined}
              onClick={close}
            >
              <Search aria-hidden="true" />
            </Link>
            {userButton}
            <Dialog.Root
              open={overlay === "navigation"}
              onOpenChange={(open) =>
                setOverlay((current) =>
                  open
                    ? "navigation"
                    : current === "navigation"
                      ? null
                      : current,
                )
              }
            >
              <Dialog.Trigger className={styles.menuButton}>
                <Menu aria-hidden="true" />
                <span>Menu</span>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className={styles.backdrop} />
                <Dialog.Content
                  className={styles.panel}
                  aria-describedby={undefined}
                >
                  <div className={styles.panelHeading}>
                    <Dialog.Title>Menu</Dialog.Title>
                    <Dialog.Close
                      className={styles.closeButton}
                      aria-label="Close menu"
                    >
                      <X aria-hidden="true" />
                    </Dialog.Close>
                  </div>
                  <nav className={styles.panelNav} aria-label="Site navigation">
                    <div className={styles.catalogs}>
                      {destination(champions)}
                    </div>
                    <section
                      className={styles.panelGroup}
                      aria-label="Alliance"
                    >
                      <h2>Alliance</h2>
                      {allianceDestinations.map((item) =>
                        destination(item),
                      )}
                    </section>
                    <div className={`${styles.catalogs} ${styles.panelGroup}`}>
                      {destination(relics)}
                    </div>
                    <section className={styles.panelGroup} aria-label="Explore">
                      <h2>Explore</h2>
                      {explore.map((item) => destination(item))}
                    </section>
                    <section
                      className={styles.panelGroup}
                      aria-label="Community and help"
                    >
                      <h2>Community & help</h2>
                      {community.map((item) => destination(item))}
                    </section>
                    <div className={styles.panelGroup}>
                      {destination(search)}
                    </div>
                  </nav>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </header>
    </HeaderOverlayContext.Provider>
  );
}
