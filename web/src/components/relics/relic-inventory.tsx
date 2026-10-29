"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  type CSSProperties,
  type ReactNode,
  type FormEvent,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import type { ChampionClass } from "@prisma/client";
import { getChampionClassColors } from "@/lib/championClassHelper";
import type { RelicAttributeIcon } from "@/lib/relic-attribute-icons";
import { buildRelicFamilies } from "@cerebro/core/domain/relic-catalog";
import { RelicAttributeGlyph, RelicPicker } from "./relic-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { RelicSummary } from "@/lib/data/relics";
import type {
  OwnedRelic,
  RelicBuildOption,
  RelicInventorySnapshot,
} from "@cerebro/core/domain/player-relics";
import { relicPrestigeAtBuild } from "@cerebro/core/domain/relic-prestige";
import styles from "./relic-inventory.module.css";

type Selection = {
  relicId?: string;
  relicIds?: string[];
  stars?: number;
  rank?: number;
  sigLevel?: number;
  entry?: OwnedRelic;
};
type InventoryContext = RelicInventorySnapshot & {
  openEditor: (selection?: Selection) => void;
  updateSnapshot: (snapshot: RelicInventorySnapshot) => void;
};
const Context = createContext<InventoryContext | null>(null);
export function useRelicInventory() {
  const value = useContext(Context);
  if (!value) throw new Error("Relic inventory provider missing");
  return value;
}
export function RelicInventoryProvider({
  initial,
  choices,
  attributeIcons,
  children,
}: {
  initial: RelicInventorySnapshot;
  choices: RelicSummary[];
  attributeIcons: Record<string, RelicAttributeIcon>;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const storedEntries = snapshot.entries;
  const updateSnapshot = (next: RelicInventorySnapshot) => {
    if (next.profile?.id === initial.profile?.id) setSnapshot(next);
  };
  useEffect(() => { setSnapshot(initial); }, [initial]);
  const entries = useMemo(() => {
    const names = new Map(
      choices.map((choice) => [choice.id, choice.shortName]),
    );
    return storedEntries.map((entry) => ({
      ...entry,
      shortName: names.get(entry.relicId) ?? entry.shortName,
    }));
  }, [storedEntries, choices]);
  const [editor, setEditor] = useState<{
    selection: Selection;
    key: number;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const openerRef = useRef<HTMLElement | null>(null);
  const openEditor = (selection: Selection = {}) => {
    if (!editor) {
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    setEditor({ selection, key: Date.now() });
  };
  return (
    <Context.Provider value={{ ...snapshot, entries, openEditor, updateSnapshot }}>
      {children}
      <div className={styles.notice} role="status" aria-live="polite">
        {notice}
      </div>
      {editor && initial.profile && (
        <RelicEditor
          key={editor.key}
          selection={editor.selection}
          profile={initial.profile}
          choices={
            editor.selection.relicIds
              ? choices.filter((choice) =>
                  editor.selection.relicIds!.includes(choice.id),
                )
              : choices
          }
          entries={entries}
          attributeIcons={attributeIcons}
          onClose={() => setEditor(null)}
          onRestoreFocus={() => openerRef.current?.focus()}
          onAnother={() => openEditor()}
          onSaved={(entry, inventory) => {
            updateSnapshot(inventory);
            setNotice(
              `${choices.find((choice) => choice.id === entry.relicId)?.shortName ?? entry.shortName} saved to ${initial.profile!.name}'s relics.`,
            );
          }}
          onRemoved={(inventory) => {
            updateSnapshot(inventory);
            setNotice("Relic removed from your collection.");
          }}
        />
      )}
    </Context.Provider>
  );
}

export function RelicOwnershipButton({
  relicIds,
  selection,
  compact = false,
}: {
  relicIds: string[];
  selection?: Selection;
  compact?: boolean;
}) {
  const { profile, entries, openEditor } = useRelicInventory();
  if (!profile)
    return (
      <Link
        className={styles.action}
        href="/auth/signin?callbackUrl=%2Fprofile%2Frelics"
      >
        <Plus size={15} /> Track in My Relics
      </Link>
    );
  const owned = entries.filter(
    (entry) =>
      relicIds.includes(entry.relicId) &&
      (!selection?.stars || entry.stars === selection.stars),
  );
  return (
    <button
      className={styles.action}
      type="button"
      onClick={() =>
        openEditor(
          selection && owned.length === 1
            ? { entry: owned[0] }
            : (selection ?? {
                relicIds,
                relicId: owned[0]?.relicId ?? relicIds[0],
                stars: owned[0]?.stars,
              }),
        )
      }
    >
      {owned.length ? <Check size={15} /> : <Plus size={15} />}
      {owned.length
        ? `${owned.length} owned${compact ? " · Manage" : " · Edit collection"}`
        : "Add to My Relics"}
    </button>
  );
}

function RelicEditor({
  selection,
  profile,
  choices,
  entries,
  attributeIcons,
  onClose,
  onRestoreFocus,
  onAnother,
  onSaved,
  onRemoved,
}: {
  selection: Selection;
  profile: NonNullable<RelicInventorySnapshot["profile"]>;
  choices: RelicSummary[];
  entries: OwnedRelic[];
  attributeIcons: Record<string, RelicAttributeIcon>;
  onClose: () => void;
  onRestoreFocus: () => void;
  onAnother: () => void;
  onSaved: (entry: OwnedRelic, inventory: RelicInventorySnapshot) => void;
  onRemoved: (inventory: RelicInventorySnapshot) => void;
}) {
  const [picking, setPicking] = useState(
    !selection.entry && !selection.relicId,
  );
  const buildFocusRef = useRef<HTMLButtonElement>(null);
  const savedFocusRef = useRef<HTMLButtonElement>(null);
  const requestedBuild = useRef(selection);
  const [relicId, setRelicId] = useState(
    selection.entry?.relicId ?? selection.relicId ?? "",
  );
  const [stars, setStars] = useState(
    selection.entry?.stars ?? selection.stars ?? 0,
  );
  const [rank, setRank] = useState(
    String(selection.entry?.rank ?? selection.rank ?? 1),
  );
  const [sig, setSig] = useState(
    String(selection.entry?.sigLevel ?? selection.sigLevel ?? 0),
  );
  const [loaded, setLoaded] = useState<{
    id: string;
    options: RelicBuildOption[];
    error?: string;
  }>({ id: "", options: [] });
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (saved) savedFocusRef.current?.focus();
  }, [saved]);
  const options = loaded.id === relicId ? loaded.options : [];
  const option = options.find((item) => item.stars === stars);
  const existing =
    selection.entry ??
    entries.find((entry) => entry.relicId === relicId && entry.stars === stars);
  const choice = choices.find((item) => item.id === relicId);
  const family = useMemo(
    () =>
      buildRelicFamilies(choices).find((group) =>
        group.variants.some((variant) => variant.id === relicId),
      ),
    [choices, relicId],
  );
  const identity = choice ?? selection.entry;
  const className = identity?.className ?? "";
  const color = className
    ? getChampionClassColors(className.toUpperCase() as ChampionClass).color
    : "#8dacf0";
  const secondaryAttribute =
    choice?.statcastSecondaryAttribute ?? selection.entry?.secondaryAttribute;
  const primaryAttribute =
    choice?.statcastPrimaryAttribute ?? selection.entry?.primaryAttribute;
  const chooseRelic = (id: string) => {
    requestedBuild.current = { relicId: id };
    setRelicId(id);
    setPicking(false);
    setError("");
    setConfirmRemove(false);
    requestAnimationFrame(() => buildFocusRef.current?.focus());
  };
  const chooseVariant = (id: string) => {
    requestedBuild.current = {
      relicId: id,
      stars,
      rank: Number(rank) || 1,
      sigLevel: Number(sig) || 0,
    };
    setRelicId(id);
    setError("");
    setConfirmRemove(false);
  };
  const changeSig = (value: number) =>
    setSig(String(Math.max(0, Math.min(option?.maxSignature ?? 0, value))));
  const quickSignatures = [
    ...new Set(
      [0, 0.25, 0.5, 0.75, 1].map((fraction) =>
        Math.round(fraction * (option?.maxSignature ?? 0)),
      ),
    ),
  ];
  useEffect(() => {
    if (!relicId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/profile/relics?relicId=${encodeURIComponent(relicId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok)
          throw new Error(result.error ?? "Could not load relic progression.");
        const values = result.options as RelicBuildOption[];
        if (!values.length)
          throw new Error("This relic is no longer available to edit.");
        const initialStars =
          selection.entry?.stars ??
          (requestedBuild.current.relicId === relicId
            ? requestedBuild.current.stars
            : undefined);
        const selected =
          values.find((value) => value.stars === initialStars) ??
          values.at(-1)!;
        const owned = entries.find(
          (entry) =>
            entry.relicId === relicId && entry.stars === selected.stars,
        );
        setStars(selected.stars);
        setRank(
          String(
            Math.min(
              selected.maxRank,
              owned?.rank ??
                (requestedBuild.current.relicId === relicId
                  ? requestedBuild.current.rank
                  : undefined) ??
                1,
            ),
          ),
        );
        setSig(
          String(
            Math.min(
              selected.maxSignature,
              owned?.sigLevel ??
                (requestedBuild.current.relicId === relicId
                  ? requestedBuild.current.sigLevel
                  : undefined) ??
                0,
            ),
          ),
        );
        setLoaded({ id: relicId, options: values });
      } catch (cause) {
        if (!controller.signal.aborted)
          setLoaded({
            id: relicId,
            options: [],
            error:
              cause instanceof Error
                ? cause.message
                : "Could not load relic progression.",
          });
      }
    }
    void load();
    return () => controller.abort();
    // The editor is remounted for each new selection. Saved entries must not reset an in-progress form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relicId, retry]);
  const chooseStars = (value: number) => {
    const owned = entries.find(
      (entry) => entry.relicId === relicId && entry.stars === value,
    );
    setStars(value);
    setRank(String(owned?.rank ?? 1));
    setSig(String(owned?.sigLevel ?? 0));
    setError("");
    setSaved(false);
  };
  const validBuild =
    !!option &&
    /^\d+$/.test(rank) &&
    /^\d+$/.test(sig) &&
    Number(rank) >= 1 &&
    Number(rank) <= option.maxRank &&
    Number(sig) <= option.maxSignature;
  const prestige =
    validBuild && option?.ranks
      ? relicPrestigeAtBuild(option.ranks, Number(rank), Number(sig))
      : null;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validBuild || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/profile/relics", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          rank: Number(rank),
          sigLevel: Number(sig),
          ...(existing
            ? { id: existing.id, updatedAt: existing.updatedAt }
            : { relicId, stars }),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not save this relic.");
      onSaved(result.entry, result.inventory);
      setSaved(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save this relic.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!existing || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/profile/relics", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          id: existing.id,
          updatedAt: existing.updatedAt,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not remove this relic.");
      onRemoved(result.inventory);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not remove this relic.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className={`${styles.dialog} ${picking ? styles.pickerDialog : ""}`}
        style={{ "--relic-accent": color } as CSSProperties}
        onInteractOutside={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onRestoreFocus();
        }}
      >
        <div className={styles.modalHeader}>
          <DialogHeader>
            <DialogTitle>
              {picking
                ? "Choose a relic"
                : saved
                  ? "Relic saved"
                  : existing
                    ? "Edit owned relic"
                    : "Add a relic"}
            </DialogTitle>
            <DialogDescription>{profile.name}’s collection</DialogDescription>
          </DialogHeader>
          <button
            className={styles.close}
            type="button"
            aria-label="Close relic editor"
            disabled={busy}
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {picking ? (
          <>
            <div className={styles.pickerPanel}>
              <RelicPicker
                choices={choices}
                entries={entries}
                selectedId={relicId}
                attributeIcons={attributeIcons}
                onChoose={chooseRelic}
              />
            </div>
            <div className={`${styles.buttons} ${styles.footer}`}>
              <button
                type="button"
                className={styles.secondary}
                onClick={onClose}
              >
                Cancel
              </button>
              {identity && (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => setPicking(false)}
                >
                  Back to {identity.shortName}
                </button>
              )}
            </div>
          </>
        ) : saved ? (
          <>
            <div className={styles.saved}>
              {identity && (
                <Image
                  src={identity.portraitPath}
                  alt=""
                  width={140}
                  height={140}
                  className={styles.savedPortrait}
                />
              )}
              <span className={styles.successCheck}>
                <Check size={22} />
              </span>
              <h3>{identity?.shortName ?? "Relic"} saved</h3>
              {secondaryAttribute && (
                <p>
                  {primaryAttribute} · {secondaryAttribute}
                </p>
              )}
              <p>
                {stars}★ · Rank {rank} ·{" "}
                {Number(sig) ? `Sig ${sig}` : "Unawakened"}
              </p>
            </div>
            <div className={`${styles.buttons} ${styles.footer}`}>
              <button
                className={styles.primary}
                type="button"
                onClick={onAnother}
                ref={savedFocusRef}
              >
                <Plus size={16} />
                Add another relic
              </button>
              <button
                className={styles.secondary}
                type="button"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={save} className={styles.form}>
            <div className={styles.scrollBody}>
              <div className={styles.hero}>
                {identity && (
                  <Image
                    className={styles.heroPortrait}
                    src={identity.portraitPath}
                    alt=""
                    width={240}
                    height={240}
                    sizes="240px"
                    priority
                  />
                )}
                <div className={styles.heroCopy}>
                  {!selection.entry && (
                    <button
                      ref={buildFocusRef}
                      className={styles.changeRelic}
                      type="button"
                      disabled={busy}
                      onClick={() => setPicking(true)}
                    >
                      <ArrowLeft size={13} />
                      Change relic
                    </button>
                  )}
                  <span className={styles.heroClass}>
                    {className && (
                      <Image
                        src={`/assets/icons/${className[0].toUpperCase() + className.slice(1).toLowerCase()}.png`}
                        alt=""
                        width={18}
                        height={18}
                        unoptimized
                      />
                    )}
                    {className}
                    <span>
                      {identity?.type === "statcast"
                        ? "Statcast"
                        : "Battlecast"}
                    </span>
                  </span>
                  <h3>{identity?.shortName}</h3>
                  <p>
                    {primaryAttribute ? (
                      <>
                        <RelicAttributeGlyph
                          icon={attributeIcons[primaryAttribute]}
                        />
                        {primaryAttribute}
                      </>
                    ) : (
                      "Striker & innate ability"
                    )}
                  </p>
                </div>
              </div>
              <div className={styles.controls}>
                {choice?.type === "statcast" && (
                  <fieldset className={styles.variants}>
                    <legend>Secondary attribute</legend>
                    {(selection.entry
                      ? [choice]
                      : (family?.variants ?? [choice])
                    ).map((variant) => {
                      const attribute =
                        variant.statcastSecondaryAttribute ?? "Variant";
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          aria-pressed={relicId === variant.id}
                          disabled={busy || !!selection.entry}
                          onClick={() => chooseVariant(variant.id)}
                        >
                          <RelicAttributeGlyph
                            icon={attributeIcons[attribute]}
                          />
                          <span>{attribute}</span>
                          {relicId === variant.id && <Check size={13} />}
                        </button>
                      );
                    })}
                  </fieldset>
                )}
                {selection.entry && !choice && secondaryAttribute && (
                  <p className={styles.hint}>
                    {primaryAttribute} · {secondaryAttribute}
                  </p>
                )}
                {relicId && loaded.id !== relicId && (
                  <p className={styles.hint} role="status">
                    <Loader2 className="animate-spin" size={16} />
                    Loading progression…
                  </p>
                )}
                {loaded.id === relicId && loaded.error && (
                  <div className={styles.error} role="alert">
                    {loaded.error}
                    <button
                      type="button"
                      onClick={() => setRetry((value) => value + 1)}
                    >
                      Retry
                    </button>
                  </div>
                )}
                {!!options.length && (
                  <>
                    <div className={styles.build}>
                      <fieldset className={styles.segments}>
                        <legend>Rarity</legend>
                        <div>
                          {(selection.entry
                            ? options.filter((value) => value.stars === stars)
                            : options
                          ).map((value) => (
                            <button
                              key={value.stars}
                              type="button"
                              aria-label={`${value.stars} stars`}
                              aria-pressed={stars === value.stars}
                              disabled={busy || !!selection.entry}
                              onClick={() => chooseStars(value.stars)}
                            >
                              {value.stars}★
                              {entries.some(
                                (entry) =>
                                  entry.relicId === relicId &&
                                  entry.stars === value.stars,
                              ) && <Check size={11} />}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                      <fieldset className={styles.segments}>
                        <legend>Rank</legend>
                        <div>
                          {Array.from(
                            { length: option?.maxRank ?? 0 },
                            (_, i) => i + 1,
                          ).map((value) => (
                            <button
                              key={value}
                              type="button"
                              aria-label={`Rank ${value}`}
                              aria-pressed={Number(rank) === value}
                              disabled={busy}
                              onClick={() => setRank(String(value))}
                            >
                              R{value}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                    {existing && !selection.entry && (
                      <p className={styles.ownedNote}>
                        <Check size={14} />
                        Already owned at {stars}★. You’re editing its saved
                        build.
                      </p>
                    )}
                    <fieldset className={styles.signature}>
                      <legend>Signature</legend>
                      <span
                        className={styles.awakening}
                        data-awakened={Number(sig) > 0}
                      >
                        {Number(sig) > 0 ? "Awakened" : "Unawakened"}
                      </span>
                      <div className={styles.stepper}>
                        {[-20, -1].map((delta) => (
                          <button
                            key={delta}
                            type="button"
                            disabled={busy || Number(sig) <= 0}
                            aria-label={`Decrease signature by ${-delta}`}
                            onClick={() =>
                              changeSig((Number(sig) || 0) + delta)
                            }
                          >
                            {delta}
                          </button>
                        ))}
                        <input
                          aria-label="Signature level"
                          type="number"
                          inputMode="numeric"
                          required
                          min={0}
                          max={option?.maxSignature ?? 0}
                          step={1}
                          disabled={busy}
                          value={sig}
                          onChange={(event) => setSig(event.target.value)}
                        />
                        {[1, 20].map((delta) => (
                          <button
                            key={delta}
                            type="button"
                            disabled={
                              busy || Number(sig) >= (option?.maxSignature ?? 0)
                            }
                            aria-label={`Increase signature by ${delta}`}
                            onClick={() =>
                              changeSig((Number(sig) || 0) + delta)
                            }
                          >
                            +{delta}
                          </button>
                        ))}
                      </div>
                      <input
                        className={styles.slider}
                        type="range"
                        aria-label="Signature level slider"
                        min={0}
                        max={option?.maxSignature ?? 0}
                        step={1}
                        value={Math.min(
                          option?.maxSignature ?? 0,
                          Number(sig) || 0,
                        )}
                        disabled={busy || !option?.maxSignature}
                        onChange={(event) =>
                          changeSig(Number(event.target.value))
                        }
                      />
                      <div className={styles.quickSig}>
                        {quickSignatures.map((value) => (
                          <button
                            key={value}
                            type="button"
                            aria-label={`Signature ${value}`}
                            aria-pressed={Number(sig) === value}
                            disabled={busy}
                            onClick={() => changeSig(value)}
                          >
                            {value === option?.maxSignature && value > 0
                              ? `Max · ${value}`
                              : value}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                    <div className={styles.prestige}>
                      <span>
                        <Trophy size={15} />
                        Prestige
                      </span>
                      <strong aria-live="polite">
                        {prestige?.toLocaleString("en-US") ?? "—"}
                      </strong>
                      <small>Unlocked runes assumed maxed for this rank.</small>
                    </div>
                  </>
                )}
                {error && (
                  <p className={styles.error} role="alert">
                    {error}
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                    >
                      Refresh collection
                    </button>
                  </p>
                )}
                {existing && (
                  <div className={styles.remove}>
                    {confirmRemove ? (
                      <>
                        <p>
                          Remove this relic from {profile.name}’s collection?
                        </p>
                        <button type="button" disabled={busy} onClick={remove}>
                          Yes, remove relic
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setConfirmRemove(false)}
                        >
                          Keep relic
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setConfirmRemove(true)}
                      >
                        <Trash2 size={13} />
                        Remove from collection
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className={`${styles.buttons} ${styles.footer}`}>
              <button
                className={styles.secondary}
                type="button"
                disabled={busy}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className={styles.primary}
                type="submit"
                disabled={!validBuild || busy}
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : existing ? (
                  <Check size={16} />
                ) : (
                  <Plus size={16} />
                )}{" "}
                {existing ? "Save changes" : "Add to My Relics"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
