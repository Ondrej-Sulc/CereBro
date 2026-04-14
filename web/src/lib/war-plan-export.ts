import { War } from "@prisma/client";
import { FightWithNode, PlayerWithRoster } from "@cerebro/core/data/war-planning/types";
import { getPathInfo, getPathLabel } from "@cerebro/core/data/war-planning/path-logic";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function truncate(str: string, len: number): string {
  if (str.length > len) return str.slice(0, len - 1) + "…";
  return str.padEnd(len);
}

function divider(label: string, totalWidth = 46): string {
  return `═══ ${label} ${"═".repeat(Math.max(0, totalWidth - label.length - 4))}`;
}

function sectionDivider(label: string, totalWidth = 46): string {
  return `── ${label} ${"─".repeat(Math.max(0, totalWidth - label.length - 3))}`;
}

function mdCell(str: string): string {
  return str.replace(/\|/g, "\\|");
}

// ─── Full Battlegroup Text Export ─────────────────────────────────────────────

export function exportBattlegroupText(
  fights: FightWithNode[],
  war: War,
  battlegroup: number,
): string {
  const sorted = [...fights].sort((a, b) => a.node.nodeNumber - b.node.nodeNumber);

  const section1 = sorted.filter(f => f.node.nodeNumber >= 1 && f.node.nodeNumber <= 18);
  const section2 = sorted.filter(f => f.node.nodeNumber >= 19 && f.node.nodeNumber <= 36);
  const bossZone = sorted.filter(f => f.node.nodeNumber >= 37);

  function fightRow(fight: FightWithNode, label?: string): string {
    const node = String(fight.node.nodeNumber).padStart(2, "0");
    const player = fight.player?.ingameName ?? "—";
    const attacker = fight.attacker?.name ?? "—";
    const defender = fight.defender?.name ?? "—";

    const extras: string[] = [];
    if (label) extras.push(`[${label}]`);
    const prefights = fight.prefightChampions?.map(pf => pf.name) ?? [];
    if (prefights.length > 0) extras.push(`🔮 Pf: ${prefights.join(", ")}`);
    if (fight.notes) extras.push(`📝 "${fight.notes}"`);

    const tail = extras.length > 0 ? `  ${extras.join("  ")}` : "";
    return `  ${node} · ${player} · ${attacker} → ${defender}${tail}`;
  }

  function sectionBlock(sectionFights: FightWithNode[]): string[] {
    const byPath = new Map<number, FightWithNode[]>();
    for (const fight of sectionFights) {
      const key = getPathInfo(fight.node.nodeNumber)?.path ?? 0;
      if (!byPath.has(key)) byPath.set(key, []);
      byPath.get(key)!.push(fight);
    }
    const lines: string[] = [];
    for (const [path, pFights] of [...byPath.entries()].sort((a, b) => a[0] - b[0])) {
      const nodeNums = [...pFights]
        .sort((a, b) => a.node.nodeNumber - b.node.nodeNumber)
        .map(f => f.node.nodeNumber).join(", ");
      lines.push(`🛤️  PATH ${path}  (Nodes ${nodeNums})`);
      for (const fight of [...pFights].sort((a, b) => a.node.nodeNumber - b.node.nodeNumber)) {
        lines.push(fightRow(fight));
      }
      lines.push("");
    }
    return lines;
  }

  const opponent = war.name || war.enemyAlliance || "Unknown";
  const warRef = war.warNumber ? `War ${war.warNumber} • ` : "";

  const lines: string[] = [
    `⚔️  BG${battlegroup} Attack Plan — vs ${opponent}`,
    `📅  Season ${war.season} • ${warRef}Tier ${war.warTier}`,
    "",
  ];

  if (section1.length > 0) {
    lines.push(divider("🗺️  SECTION 1"), "");
    lines.push(...sectionBlock(section1));
  }

  if (section2.length > 0) {
    lines.push(divider("🗺️  SECTION 2"), "");
    lines.push(...sectionBlock(section2));
  }

  if (bossZone.length > 0) {
    lines.push(divider("💀  BOSS ZONE"), "");
    for (const fight of bossZone) {
      lines.push(fightRow(fight, getPathLabel(fight.node.nodeNumber)));
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Full Battlegroup Markdown Export ─────────────────────────────────────────

export function exportBattlegroupMarkdown(
  fights: FightWithNode[],
  war: War,
  battlegroup: number,
): string {
  const sorted = [...fights].sort((a, b) => a.node.nodeNumber - b.node.nodeNumber);

  const section1 = sorted.filter(f => f.node.nodeNumber >= 1 && f.node.nodeNumber <= 18);
  const section2 = sorted.filter(f => f.node.nodeNumber >= 19 && f.node.nodeNumber <= 36);
  const bossZone = sorted.filter(f => f.node.nodeNumber >= 37);

  function sectionMdBlock(sectionFights: FightWithNode[]): string[] {
    const byPath = new Map<number, FightWithNode[]>();
    for (const fight of sectionFights) {
      const key = getPathInfo(fight.node.nodeNumber)?.path ?? 0;
      if (!byPath.has(key)) byPath.set(key, []);
      byPath.get(key)!.push(fight);
    }
    const lines: string[] = [
      "| Node | Path | Player | Matchup | Notes |",
      "|------|------|--------|---------|-------|",
    ];
    for (const [path, pFights] of [...byPath.entries()].sort((a, b) => a[0] - b[0])) {
      for (const fight of [...pFights].sort((a, b) => a.node.nodeNumber - b.node.nodeNumber)) {
        const node = `\`${String(fight.node.nodeNumber).padStart(2, "0")}\``;
        const player = mdCell(fight.player?.ingameName ?? "—");
        const matchup = `${mdCell(fight.attacker?.name ?? "—")} → ${mdCell(fight.defender?.name ?? "—")}`;
        const extras: string[] = [];
        const prefights = fight.prefightChampions?.map(pf => pf.name) ?? [];
        if (prefights.length > 0) extras.push(`🔮 Pf: ${prefights.map(mdCell).join(", ")}`);
        if (fight.notes) extras.push(`📝 *${mdCell(fight.notes)}*`);
        lines.push(`| ${node} | ${path} | ${player} | ${matchup} | ${extras.join(" · ")} |`);
      }
    }
    lines.push("");
    return lines;
  }

  const opponent = war.name || war.enemyAlliance || "Unknown";
  const warRef = war.warNumber ? `War ${war.warNumber} · ` : "";

  const lines: string[] = [
    `# ⚔️ BG${battlegroup} Attack Plan — vs ${opponent}`,
    `📅 Season ${war.season} · ${warRef}Tier ${war.warTier}`,
    "",
  ];

  if (section1.length > 0) {
    lines.push("## 🗺️ Section 1", "");
    lines.push(...sectionMdBlock(section1));
  }

  if (section2.length > 0) {
    lines.push("## 🗺️ Section 2", "");
    lines.push(...sectionMdBlock(section2));
  }

  if (bossZone.length > 0) {
    lines.push("## 💀 Boss Zone", "");
    lines.push("| Node | Position | Player | Matchup | Notes |");
    lines.push("|------|----------|--------|---------|-------|");
    for (const fight of bossZone) {
      const label = getPathLabel(fight.node.nodeNumber);
      const node = `\`${String(fight.node.nodeNumber).padStart(2, "0")}\``;
      const player = mdCell(fight.player?.ingameName ?? "—");
      const matchup = `${mdCell(fight.attacker?.name ?? "—")} → ${mdCell(fight.defender?.name ?? "—")}`;
      const extras: string[] = [];
      const prefights = fight.prefightChampions?.map(pf => pf.name) ?? [];
      if (prefights.length > 0) extras.push(`🔮 Pf: ${prefights.map(mdCell).join(", ")}`);
      if (fight.notes) extras.push(`📝 *${mdCell(fight.notes)}*`);
      lines.push(`| ${node} | ${label} | ${player} | ${matchup} | ${extras.join(" · ")} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Player Briefing Text Export ─────────────────────────────────────────────

export function exportPlayerText(
  player: PlayerWithRoster,
  playerFights: FightWithNode[],
  prefightTasks: FightWithNode[],
  assignedChampions: Array<{ id: number; name: string; roles: Set<string> }>,
  war: War,
): string {
  const opponent = war.name || war.enemyAlliance || "Unknown";
  const warRef = war.warNumber ? `War ${war.warNumber} • ` : "";

  const titleLabel = `📋  BRIEFING: ${player.ingameName} (BG${player.battlegroup})`;
  const lines: string[] = [
    divider(titleLabel),
    `⚔️  War vs ${opponent} • Season ${war.season} • ${warRef}Tier ${war.warTier}`,
    "",
  ];

  const COL_NAME = 18;
  const COL_RANK = 14;

  // YOUR TEAM
  if (assignedChampions.length > 0) {
    lines.push(sectionDivider("⭐  YOUR TEAM"));
    lines.push(`  ${"CHAMPION".padEnd(COL_NAME)}${"RANK".padEnd(COL_RANK)}ROLE`);
    lines.push(`  ${"─".repeat(COL_NAME)}${"─".repeat(COL_RANK)}──────`);
    for (const champ of assignedChampions) {
      const roster = [...(player.roster ?? [])]
        .filter(r => r.championId === champ.id)
        .sort((a, b) => {
          if (a.stars !== b.stars) return b.stars - a.stars;
          if (a.rank !== b.rank) return b.rank - a.rank;
          return b.sigLevel - a.sigLevel;
        })[0];

      const rInfo = roster
        ? `${roster.stars}★R${roster.rank}${roster.isAwakened && roster.sigLevel > 0 ? ` S${roster.sigLevel}` : ""}${roster.isAscended && roster.ascensionLevel > 0 ? ` A${roster.ascensionLevel}` : roster.isAscended ? " ASC" : ""}`
        : "—";

      const roles = Array.from(champ.roles)
        .map(r => r.charAt(0).toUpperCase() + r.slice(1))
        .join(", ");

      lines.push(`  ${truncate(champ.name, COL_NAME)}${truncate(rInfo, COL_RANK)}${roles}`);
    }
    lines.push("");
  }

  // ATTACK ASSIGNMENTS
  if (playerFights.length > 0) {
    lines.push(sectionDivider("⚔️  ATTACK ASSIGNMENTS"));
    for (const fight of playerFights) {
      const label = getPathLabel(fight.node.nodeNumber);
      const nodeNum = String(fight.node.nodeNumber).padStart(2, "0");
      lines.push("");
      lines.push(`  📍 NODE ${nodeNum}  [${label}]`);
      lines.push(`  ${fight.attacker?.name ?? "?"} → ${fight.defender?.name ?? "?"}`);

      if (fight.prefightChampions && fight.prefightChampions.length > 0) {
        const pfStrs = fight.prefightChampions.map(pf => {
          const placedByMe = pf.player?.id === player.id;
          const placer = placedByMe ? "self" : (pf.player?.ingameName ?? "?");
          return `${pf.name} (${placer})`;
        });
        lines.push(`  🔮 Prefight:  ${pfStrs.join(", ")}`);
      }

      if (fight.notes) lines.push(`  📝 Notes:     ${fight.notes}`);
    }
    lines.push("");
  }

  // PREFIGHTS TO PLACE (for other players' fights only — own-fight prefights shown above)
  const externalPrefights: { nodeNum: string; label: string; pfName: string; forPlayer: string }[] = [];
  for (const fight of prefightTasks) {
    if (fight.player?.id === player.id) continue;
    const myPfs = fight.prefightChampions?.filter(pf => pf.player?.id === player.id) ?? [];
    for (const pf of myPfs) {
      externalPrefights.push({
        nodeNum: String(fight.node.nodeNumber).padStart(2, "0"),
        label: getPathLabel(fight.node.nodeNumber),
        pfName: pf.name,
        forPlayer: fight.player?.ingameName ?? "?",
      });
    }
  }

  if (externalPrefights.length > 0) {
    lines.push(sectionDivider("🔮  PREFIGHTS TO PLACE"));
    for (const { nodeNum, label, pfName, forPlayer } of externalPrefights) {
      lines.push(`  📍 NODE ${nodeNum}  [${label}]  ${pfName}  →  for ${forPlayer}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Player Briefing Markdown Export ─────────────────────────────────────────

export function exportPlayerMarkdown(
  player: PlayerWithRoster,
  playerFights: FightWithNode[],
  prefightTasks: FightWithNode[],
  assignedChampions: Array<{ id: number; name: string; roles: Set<string> }>,
  war: War,
): string {
  const opponent = war.name || war.enemyAlliance || "Unknown";
  const warRef = war.warNumber ? `War ${war.warNumber} · ` : "";

  const lines: string[] = [
    `# 📋 War Briefing: ${player.ingameName} (BG${player.battlegroup})`,
    `> ⚔️ War vs ${opponent} · Season ${war.season} · ${warRef}Tier ${war.warTier}`,
    "",
  ];

  // YOUR TEAM
  if (assignedChampions.length > 0) {
    lines.push("## ⭐ Your Team", "");
    lines.push("| Champion | Rank | Roles |");
    lines.push("|----------|------|-------|");
    for (const champ of assignedChampions) {
      const roster = [...(player.roster ?? [])]
        .filter(r => r.championId === champ.id)
        .sort((a, b) => {
          if (a.stars !== b.stars) return b.stars - a.stars;
          if (a.rank !== b.rank) return b.rank - a.rank;
          return b.sigLevel - a.sigLevel;
        })[0];

      const rInfo = roster
        ? `${roster.stars}★R${roster.rank}${roster.isAwakened && roster.sigLevel > 0 ? ` S${roster.sigLevel}` : ""}${roster.isAscended && roster.ascensionLevel > 0 ? ` A${roster.ascensionLevel}` : roster.isAscended ? " ASC" : ""}`
        : "—";

      const roles = Array.from(champ.roles)
        .map(r => r.charAt(0).toUpperCase() + r.slice(1))
        .join(", ");

      lines.push(`| ${mdCell(champ.name)} | ${rInfo} | ${roles} |`);
    }
    lines.push("");
  }

  // ATTACK ASSIGNMENTS
  if (playerFights.length > 0) {
    lines.push("## ⚔️ Attack Assignments", "");
    for (const fight of playerFights) {
      const label = getPathLabel(fight.node.nodeNumber);
      const nodeNum = String(fight.node.nodeNumber).padStart(2, "0");
      lines.push(`### 📍 Node ${nodeNum} · ${label}`);
      lines.push(`**${mdCell(fight.attacker?.name ?? "?")} → ${mdCell(fight.defender?.name ?? "?")}**`);

      if (fight.prefightChampions && fight.prefightChampions.length > 0) {
        const pfStrs = fight.prefightChampions.map(pf => {
          const placedByMe = pf.player?.id === player.id;
          const placer = placedByMe ? "self" : (pf.player?.ingameName ?? "?");
          return `${mdCell(pf.name)} *(${placer})*`;
        });
        lines.push(`🔮 Prefight: ${pfStrs.join(", ")}`);
      }

      if (fight.notes) lines.push(`📝 Notes: *${mdCell(fight.notes)}*`);
      lines.push("");
    }
  }

  // PREFIGHTS TO PLACE (for other players' fights only)
  const externalPrefights: { nodeNum: string; label: string; pfName: string; forPlayer: string }[] = [];
  for (const fight of prefightTasks) {
    if (fight.player?.id === player.id) continue;
    const myPfs = fight.prefightChampions?.filter(pf => pf.player?.id === player.id) ?? [];
    for (const pf of myPfs) {
      externalPrefights.push({
        nodeNum: String(fight.node.nodeNumber).padStart(2, "0"),
        label: getPathLabel(fight.node.nodeNumber),
        pfName: pf.name,
        forPlayer: fight.player?.ingameName ?? "?",
      });
    }
  }

  if (externalPrefights.length > 0) {
    lines.push("## 🔮 Prefights to Place", "");
    lines.push("| Node | Position | Champion | For |");
    lines.push("|------|----------|----------|-----|");
    for (const { nodeNum, label, pfName, forPlayer } of externalPrefights) {
      lines.push(`| \`${nodeNum}\` | ${label} | ${mdCell(pfName)} | ${mdCell(forPlayer)} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
