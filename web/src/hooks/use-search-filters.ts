"use client";

import { useState, useTransition, useEffect, useRef, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import { Champion } from "@/types/champion";

interface UseSearchFiltersProps {
  champions: Champion[];
  availableSeasons: number[];
}

export function useSearchFilters({ champions, availableSeasons }: UseSearchFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // -- State Initialization --

  // Main Filters
  const [mapType, setMapType] = useState(searchParams.get("map") || "STANDARD");
  const [attackerId, setAttackerId] = useState(
    champions.find(
      (c) => c.name.toLowerCase() === (searchParams.get("attacker") || "").toLowerCase()
    )?.id.toString() || ""
  );
  const [defenderId, setDefenderId] = useState(
    champions.find(
      (c) => c.name.toLowerCase() === (searchParams.get("defender") || "").toLowerCase()
    )?.id.toString() || ""
  );
  const [node, setNode] = useState(searchParams.get("node") || "");
  const [hasVideo, setHasVideo] = useState(searchParams.get("hasVideo") === "true");

  // Secondary Filters
  const initialSeasons = searchParams
    .getAll("season")
    .map((s) => parseInt(s))
    .filter((n) => !isNaN(n));
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>(initialSeasons);
  const [war, setWar] = useState(searchParams.get("war") || "");
  const [tier, setTier] = useState(searchParams.get("tier") || "");
  const [player, setPlayer] = useState(searchParams.get("player") || "");
  const [alliance, setAlliance] = useState(searchParams.get("alliance") || "");
  const [battlegroup, setBattlegroup] = useState(searchParams.get("battlegroup") || "");

  // Debounce Text Inputs
  const debouncedNode = useDebounce(node, 500);
  const debouncedBattlegroup = useDebounce(battlegroup, 500);

  // Options
  const warOptions = useMemo(
    () => [
      { value: "0", label: "Offseason" },
      ...Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1),
        label: `War ${i + 1}`,
      })),
    ],
    []
  );

  const tierOptions = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        value: String(i + 1),
        label: `Tier ${i + 1}`,
      })),
    []
  );

  // Ref for champions to access in effect without dependency
  const championsRef = useRef(champions);
  useEffect(() => {
    championsRef.current = champions;
  }, [champions]);

  // Sync state from URL on navigation
  useEffect(() => {
    // Map
    const mapParam = searchParams.get("map") || "STANDARD";
    if (mapParam !== mapType) setMapType(mapParam);

    // Champions
    const attackerParam = searchParams.get("attacker") || "";
    const currentAttackerName =
      championsRef.current.find((c) => String(c.id) === attackerId)?.name || "";
    if (attackerParam.toLowerCase() !== currentAttackerName.toLowerCase()) {
      const found = championsRef.current.find(
        (c) => c.name.toLowerCase() === attackerParam.toLowerCase()
      );
      setAttackerId(found ? String(found.id) : "");
    }

    const defenderParam = searchParams.get("defender") || "";
    const currentDefenderName =
      championsRef.current.find((c) => String(c.id) === defenderId)?.name || "";
    if (defenderParam.toLowerCase() !== currentDefenderName.toLowerCase()) {
      const found = championsRef.current.find(
        (c) => c.name.toLowerCase() === defenderParam.toLowerCase()
      );
      setDefenderId(found ? String(found.id) : "");
    }

    // Node
    const nodeParam = searchParams.get("node") || "";
    if (nodeParam !== node) setNode(nodeParam);

    // Video
    const videoParam = searchParams.get("hasVideo") === "true";
    if (videoParam !== hasVideo) setHasVideo(videoParam);

    // Advanced - Seasons
    const seasonParams = searchParams
      .getAll("season")
      .map((s) => parseInt(s))
      .filter((n) => !isNaN(n));
    // Simple array comparison
    const sortedParams = [...seasonParams].sort();
    const sortedState = [...selectedSeasons].sort();
    const isDifferent =
      sortedParams.length !== sortedState.length ||
      sortedParams.some((val, idx) => val !== sortedState[idx]);

    if (isDifferent) setSelectedSeasons(seasonParams);

    // Advanced - Other
    const warParam = searchParams.get("war") || "";
    if (warParam !== war) setWar(warParam);

    const tierParam = searchParams.get("tier") || "";
    if (tierParam !== tier) setTier(tierParam);

    const playerParam = searchParams.get("player") || "";
    if (playerParam !== player) setPlayer(playerParam);

    const allianceParam = searchParams.get("alliance") || "";
    if (allianceParam !== alliance) setAlliance(allianceParam);

    const battlegroupParam = searchParams.get("battlegroup") || "";
    if (battlegroupParam !== battlegroup) setBattlegroup(battlegroupParam);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Effect to update URL
  useEffect(() => {
    const params = new URLSearchParams();

    // Map
    if (mapType) params.set("map", mapType);

    // Champions
    const attackerName = championsRef.current.find(
      (c) => String(c.id) === attackerId
    )?.name;
    const defenderName = championsRef.current.find(
      (c) => String(c.id) === defenderId
    )?.name;
    if (attackerName) params.set("attacker", attackerName);
    if (defenderName) params.set("defender", defenderName);

    // Node - bypass debounce if cleared
    const effectiveNode = node === "" ? "" : debouncedNode;
    if (effectiveNode) params.set("node", effectiveNode);

    // Video
    if (hasVideo) params.set("hasVideo", "true");

    // Advanced
    selectedSeasons.forEach((s) => params.append("season", s.toString()));
    if (war) params.set("war", war);
    if (tier) params.set("tier", tier);
    if (player) params.set("player", player);
    if (alliance) params.set("alliance", alliance);

    const effectiveBattlegroup = battlegroup === "" ? "" : debouncedBattlegroup;
    if (effectiveBattlegroup) params.set("battlegroup", effectiveBattlegroup);

    const newQueryString = params.toString();
    const currentQueryString = searchParams.toString();

    // Only push if changed to prevent loops
    if (newQueryString !== currentQueryString) {
      startTransition(() => {
        router.push(`${pathname}?${newQueryString}`, { scroll: false });
      });
    }
  }, [
    mapType,
    attackerId,
    defenderId,
    node,
    battlegroup,
    debouncedNode,
    hasVideo,
    selectedSeasons,
    war,
    tier,
    player,
    alliance,
    debouncedBattlegroup,
    pathname,
    router,
  ]);

  const activeAdvancedCount = [
    selectedSeasons.length > 0,
    war,
    tier,
    player,
    alliance,
    battlegroup,
  ].filter(Boolean).length;

  // Active Filter Chips
  const activeFilters = useMemo(() => {
    const filters = [];
    if (selectedSeasons.length > 0) {
      selectedSeasons.forEach((s) => {
        filters.push({
          id: `season-${s}`,
          label: `Season ${s}`,
          onRemove: () => setSelectedSeasons((prev) => prev.filter((i) => i !== s)),
        });
      });
    }
    if (war)
      filters.push({
        id: "war",
        label: `War ${war}`,
        onRemove: () => setWar(""),
      });
    if (tier)
      filters.push({
        id: "tier",
        label: `Tier ${tier}`,
        onRemove: () => setTier(""),
      });
    if (player)
      filters.push({
        id: "player",
        label: `Player: ${player}`,
        onRemove: () => setPlayer(""),
      });
    if (alliance)
      filters.push({
        id: "alliance",
        label: `Alliance: ${alliance}`,
        onRemove: () => setAlliance(""),
      });
    if (battlegroup)
      filters.push({
        id: "battlegroup",
        label: battlegroup === "0" ? "Solo" : `BG ${battlegroup}`,
        onRemove: () => setBattlegroup(""),
      });

    return filters;
  }, [selectedSeasons, war, tier, player, alliance, battlegroup]);

  const clearAll = () => {
    setAttackerId("");
    setDefenderId("");
    setNode("");
    setHasVideo(false);
    setMapType("STANDARD");
    // Reset Advanced
    setSelectedSeasons([]);
    setWar("");
    setTier("");
    setPlayer("");
    setAlliance("");
    setBattlegroup("");
  };

  return {
    state: {
      mapType,
      attackerId,
      defenderId,
      node,
      hasVideo,
      selectedSeasons,
      war,
      tier,
      player,
      alliance,
      battlegroup,
      showAdvanced,
    },
    setters: {
      setMapType,
      setAttackerId,
      setDefenderId,
      setNode,
      setHasVideo,
      setSelectedSeasons,
      setWar,
      setTier,
      setPlayer,
      setAlliance,
      setBattlegroup,
      setShowAdvanced,
      clearAll
    },
    computed: {
      isPending,
      activeAdvancedCount,
      activeFilters,
      warOptions,
      tierOptions,
    },
  };
}
