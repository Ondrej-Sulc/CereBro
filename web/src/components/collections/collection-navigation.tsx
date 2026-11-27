"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Gem, LibraryBig, Loader2, LogIn, ShieldCheck } from "lucide-react";
import {
  collectionHref,
  collectionPreferenceCookie,
  collectionStateKey,
  createCollectionMemory,
  resolveCollectionView,
  type CollectionSection,
  type CollectionView,
} from "@/lib/collection-view";
import styles from "./collection-navigation.module.css";

const Memory = createContext<ReturnType<typeof createCollectionMemory> | null>(
  null,
);
type ScreenConfig = {
  section: CollectionSection;
  view: CollectionView;
  profileId: string;
  signedIn: boolean;
  canUsePersonal: boolean;
};
type CollectionScreenContext = ScreenConfig & { preserveScroll: () => void };
const Screen = createContext<CollectionScreenContext | null>(null);

export function useIsCollectionScreen() {
  return useContext(Screen) !== null;
}

export function CollectionMemoryProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [memory] = useState(createCollectionMemory);
  return <Memory.Provider value={memory}>{children}</Memory.Provider>;
}

export function CollectionScreen({
  children,
  ...config
}: ScreenConfig & { children: ReactNode }) {
  const memory = useContext(Memory);
  const { section, view, profileId } = config;
  const leaving = useRef(false);
  useEffect(() => {
    if (!memory) return;
    const key = collectionStateKey(section, profileId, view, "scroll");
    const freshGate = section === "champions" && new URLSearchParams(window.location.search).get("questGate") === "1";
    const position = freshGate ? 0 : memory.get(key, 0);
    leaving.current = false;
    let restoring = true;
    let frame = 0;
    // Virtualized grids establish their height after the route first renders.
    // Don't replace the saved position with an interim, clamped scroll value.
    const finish = () => {
      restoring = false;
      observer.disconnect();
      clearTimeout(deadline);
    };
    const restore = () => {
      if (!restoring) return;
      if (document.documentElement.scrollHeight < position + window.innerHeight)
        return;
      window.scrollTo({ top: position, behavior: "instant" });
      finish();
    };
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => restore());
    });
    observer.observe(document.body);
    // If changed filters make the old offset unreachable, leave the page at the
    // top. Never force a clamped offset before a slow grid has established height.
    const deadline = setTimeout(finish, 10000);
    frame = requestAnimationFrame(() => restore());
    const save = () => {
      if (!restoring && !leaving.current) memory.set(key, window.scrollY);
    };
    const interrupt = () => {
      finish();
      save();
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt);
    return () => {
      finish();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", save);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("keydown", interrupt);
    };
  }, [memory, section, view, profileId]);
  const preserveScroll = () => {
    leaving.current = true;
    memory?.set(collectionStateKey(section, profileId, view, "scroll"), window.scrollY);
  };
  return <Screen.Provider value={{ ...config, preserveScroll }}>{children}</Screen.Provider>;
}

/** Keep filters while navigating, without putting roster data in a public cache or localStorage. */
export function useCollectionState<T>(key: string, initial: T, shared = false) {
  const memory = useContext(Memory);
  const screen = useContext(Screen);
  const stateKey = screen
    ? collectionStateKey(
        screen.section,
        screen.profileId,
        screen.view,
        key,
        shared,
      )
    : null;
  const [value, setValue] = useState<T>(() =>
    stateKey && memory ? memory.get(stateKey, initial) : initial,
  );
  useEffect(() => {
    if (memory && stateKey) memory.set(stateKey, value);
  }, [memory, stateKey, value]);
  return [value, setValue] as const;
}

function remember(section: CollectionSection, view: CollectionView) {
  document.cookie = `${collectionPreferenceCookie(section)}=${view}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function CollectionHeading() {
  const screen = useContext(Screen);
  return screen ? <CollectionPageHeader screen={screen} /> : null;
}

function CollectionPageHeader({ screen }: { screen: CollectionScreenContext }) {
  const memory = useContext(Memory);
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [prompt, setPrompt] = useState(false);
  const { section, view, profileId, canUsePersonal, signedIn } = screen;
  const champions = section === "champions";
  const gateContext = champions && params.get("questGate") === "1";
  const incomingPersonal = gateContext && params.get("view") === "personal" && !canUsePersonal;
  const gateSearch = (target: CollectionView) => {
    const query = new URLSearchParams(params.toString());
    query.set("unowned", target === "personal" && params.get("unowned") === "false" ? "false" : "true");
    return query.toString();
  };
  const personalHref = collectionHref(section, "personal", gateContext ? gateSearch("personal") : "");
  const labels = champions
    ? { catalog: "All Champions", personal: "My Roster" }
    : { catalog: "All Relics", personal: "My Relics" };
  const target = view === "catalog" ? "personal" : "catalog";
  const Icon = target === "catalog" ? LibraryBig : champions ? ShieldCheck : Gem;
  return (
    <div>
      <header>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[22px] font-bold leading-tight tracking-tight text-white min-[375px]:text-[28px] sm:text-4xl">{labels[view]}</h1>
          <nav aria-label={champions ? "Champion pages" : "Relic pages"} aria-busy={pending}>
            <Link
              className={styles.destination}
              href={collectionHref(section, target, gateContext ? gateSearch(target) : "")}
              prefetch={false}
              data-destination={target}
              data-pending={pending || undefined}
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey ||
                  event.button !== 0
                )
                  return;
                event.preventDefault();
                if (target === "personal" && !canUsePersonal) {
                  setPrompt(true);
                  return;
                }
                if (pending) return;
                screen.preserveScroll();
                memory?.set(
                  collectionStateKey(section, profileId, view, "url"),
                  window.location.search,
                );
                const search = gateContext
                  ? gateSearch(target)
                  : memory?.get(collectionStateKey(section, profileId, target, "url"), "") ?? "";
                remember(section, target);
                startTransition(() =>
                  router.push(collectionHref(section, target, search), {
                    scroll: gateContext,
                  }),
                );
              }}
            >
              <span className={styles.destinationIcon} aria-hidden="true">
                {pending ? <Loader2 className={styles.loading} /> : <Icon />}
              </span>
              <span>{labels[target]}</span>
              <ArrowRight className={styles.destinationArrow} aria-hidden="true" />
            </Link>
          </nav>
        </div>
        {view === "catalog" && (
          <p className="mt-1.5 text-sm text-slate-400">
            {champions ? "Browse by class, tags, abilities, or immunities." : "Browse Battlecasts and Statcasts by class or attribute."}
          </p>
        )}
      </header>
      {(prompt || incomingPersonal) && (
        <div className={styles.signin} role="status">
          <span>
            {signedIn
              ? "Choose a game profile to start your collection."
              : `Sign in to manage your ${section === "champions" ? "roster" : "relics"}.`}
          </span>
          <Link
            href={
              signedIn
                ? "/profile"
                : `/auth/signin?callbackUrl=${encodeURIComponent(personalHref)}`
            }
          >
            <LogIn size={15} />
            {signedIn ? "Choose profile" : "Sign in"}
          </Link>
        </div>
      )}
    </div>
  );
}

/** Menu entry: resolve at click time as client-set cookies don't invalidate Next's route cache. */
export function CollectionNavLink({
  section,
  canUsePersonal,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & {
  section: CollectionSection;
  canUsePersonal: boolean;
}) {
  const router = useRouter();
  return (
    <Link
      {...props}
      href={`/${section}`}
      prefetch={false}
      onClick={(event) => {
        props.onClick?.(event);
        if (
          event.defaultPrevented ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        const name = collectionPreferenceCookie(section);
        const remembered = document.cookie
          .split("; ")
          .find((part) => part.startsWith(`${name}=`))
          ?.slice(name.length + 1);
        router.push(
          collectionHref(
            section,
            resolveCollectionView(undefined, remembered, canUsePersonal),
          ),
        );
      }}
    >
      {children}
    </Link>
  );
}
