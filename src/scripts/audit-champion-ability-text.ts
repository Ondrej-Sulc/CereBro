import "dotenv/config";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type AuditArgs = {
  rarity: number;
  rank: number;
  sig: number;
  maxSig: number;
  outDir: string;
  limit?: number;
};

type AuditIssue = {
  severity: "error" | "warning" | "info";
  rule: string;
  champion: string;
  gameId: string | null;
  sourceId: string;
  group: string;
  title: string | null;
  text: string;
  detail: string;
  values: ValueTrace[];
};

type ValueTrace = {
  placeholderIndex: number;
  displayValue: string | null;
  status: string;
  componentId?: string;
  field?: string;
  paramName?: string;
  buffType?: string;
  rawValue?: number;
  chance?: number;
  baseVal?: number;
  duration?: number;
  atkFrac?: number;
  f24?: number;
  scaleVar?: string;
  curveId?: string;
};

function parseArgs(): AuditArgs {
  const args = process.argv.slice(2);
  const readNumberArg = (name: string, fallback: number) => {
    const arg = args.find(value => value.startsWith(`--${name}=`));
    if (!arg) return fallback;
    const value = Number(arg.slice(name.length + 3));
    if (!Number.isFinite(value)) throw new Error(`--${name} must be a number`);
    return value;
  };
  const outDirArg = args.find(value => value.startsWith("--out-dir="));
  const limitArg = args.find(value => value.startsWith("--limit="));

  return {
    rarity: readNumberArg("rarity", 7),
    rank: readNumberArg("rank", 6),
    sig: readNumberArg("sig", 200),
    maxSig: readNumberArg("max-sig", 200),
    outDir: path.resolve(outDirArg ? outDirArg.slice("--out-dir=".length) : "scratch"),
    limit: limitArg ? readNumberArg("limit", 0) : undefined,
  };
}

async function loadAbilityTextModule() {
  const modulePath = path.resolve("web/src/lib/champion-ability-text.ts");
  const mod = await import(pathToFileURL(modulePath).href);
  return (mod.default ?? mod) as any;
}

function renderPrepared(prepared: any) {
  const values: ValueTrace[] = [];
  if (prepared.status !== "ready") {
    return { text: `[${prepared.error?.code ?? "error"}]`, values };
  }

  const renderNode = (node: any): string => {
    if (node.type === "text") return node.value;
    if (node.type === "glossary") return node.label;
    if (node.type === "color") return node.children.map(renderNode).join("");
    if (node.type === "value") {
      const resolution = node.resolution;
      const source = resolution.curve?.params?.source?.ability ?? node.resolution?.source ?? null;
      const templateSource = node.source;
      values.push({
        placeholderIndex: node.placeholderIndex,
        displayValue: resolution.status === "resolved" ? resolution.displayValue : null,
        status: resolution.status,
        componentId: templateSource?.componentId ?? resolution.curve?.params?.source?.componentId,
        field: templateSource?.field,
        paramName: templateSource?.paramName,
        buffType: templateSource?.buffType ?? source?.buffType,
        rawValue: templateSource?.rawValue,
        chance: templateSource?.chance,
        baseVal: templateSource?.baseVal,
        duration: templateSource?.duration,
        atkFrac: templateSource?.atkFrac,
        f24: templateSource?.f24,
        scaleVar: templateSource?.scaleVar,
        curveId: templateSource?.curveId,
      });
      return resolution.status === "resolved" ? resolution.displayValue : `[${resolution.error.code}]`;
    }
    return "";
  };

  return {
    text: prepared.blocks.map((block: any) => block.children.map(renderNode).join("")).join("\n"),
    values,
  };
}

function collectIssues(record: any, champion: { name: string; gameId: string | null }, rendered: { text: string; values: ValueTrace[] }): AuditIssue[] {
  const base = {
    champion: champion.name,
    gameId: champion.gameId,
    sourceId: String(record.sourceId),
    group: String(record.group),
    title: record.displayTitle ?? record.title ?? null,
    text: rendered.text,
    values: rendered.values,
  };
  const issues: AuditIssue[] = [];
  const add = (severity: AuditIssue["severity"], rule: string, detail: string) => {
    issues.push({ ...base, severity, rule, detail });
  };

  if (/\[(?:UNRESOLVED_PLACEHOLDER|\/?b|k=|\/k|[0-9a-fA-F]{6,8}|\-)\]/.test(rendered.text) || /\{\d+\}/.test(rendered.text)) {
    add("error", "RAW_MARKUP", "Rendered text still contains markup or placeholder syntax.");
  }

  if (rendered.values.some(value => value.status !== "resolved")) {
    add("error", "UNRESOLVED_VALUE", "One or more placeholders did not resolve.");
  }

  for (const match of rendered.text.matchAll(/([\d,]+(?:\.\d+)?)%/g)) {
    const value = Number(match[1].replace(/,/g, ""));
    if (value > 500) add("error", "HUGE_PERCENT", `Percent value ${match[0]} is probably using the wrong field or scale.`);
    if (value > 0 && value < 0.1) add("warning", "TINY_PERCENT", `Percent value ${match[0]} may be under-scaled.`);
  }

  for (const match of rendered.text.matchAll(/\b(?:for|over|cooldown:)\s+([\d,]+(?:\.\d+)?)\s+seconds?\b/gi)) {
    const value = Number(match[1].replace(/,/g, ""));
    if (value > 180) add("error", "HUGE_DURATION", `Duration ${match[1]} seconds is suspicious.`);
  }

  for (const match of rendered.text.matchAll(/\b([\d,]+(?:\.\d+)?)\s+(?:direct |energy |physical )?damage\b/gi)) {
    const value = Number(match[1].replace(/,/g, ""));
    if (value > 0 && value < 1) add("warning", "TINY_DAMAGE", `Damage value ${match[1]} is probably unscaled.`);
  }

  const componentValues = new Map<string, Set<string>>();
  for (const value of rendered.values) {
    if (!value.componentId || !value.displayValue) continue;
    const key = `${value.componentId}:${value.buffType ?? ""}`;
    componentValues.set(key, componentValues.get(key) ?? new Set());
    componentValues.get(key)!.add(value.displayValue);
  }
  for (const [component, values] of componentValues) {
    const count = rendered.values.filter(value => `${value.componentId}:${value.buffType ?? ""}` === component).length;
    if (count >= 3 && values.size === 1) {
      add("warning", "REPEATED_COMPONENT_VALUE", `Component ${component} resolved ${count} placeholders to the same value.`);
    }
  }

  return issues;
}

function summarize(issues: AuditIssue[]) {
  const byRule = new Map<string, number>();
  const bySeverity = new Map<string, number>();
  for (const issue of issues) {
    byRule.set(issue.rule, (byRule.get(issue.rule) ?? 0) + 1);
    bySeverity.set(issue.severity, (bySeverity.get(issue.severity) ?? 0) + 1);
  }
  return {
    total: issues.length,
    bySeverity: Object.fromEntries([...bySeverity.entries()].sort()),
    byRule: Object.fromEntries([...byRule.entries()].sort((a, b) => b[1] - a[1])),
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(args: AuditArgs, issues: AuditIssue[]) {
  const summary = summarize(issues);
  const rows = issues.map(issue => `
    <tr class="${issue.severity}">
      <td>${escapeHtml(issue.severity)}</td>
      <td>${escapeHtml(issue.rule)}</td>
      <td>${escapeHtml(issue.champion)}</td>
      <td>${escapeHtml(issue.sourceId)}</td>
      <td>${escapeHtml(issue.title ?? "")}</td>
      <td>${escapeHtml(issue.detail)}</td>
      <td><pre>${escapeHtml(issue.text)}</pre></td>
      <td><pre>${escapeHtml(JSON.stringify(issue.values, null, 2))}</pre></td>
    </tr>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Champion Ability Text Audit</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; background: #0f172a; color: #e2e8f0; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-top: 1px solid #334155; padding: 8px; vertical-align: top; }
    th { position: sticky; top: 0; background: #111827; text-align: left; }
    pre { white-space: pre-wrap; margin: 0; max-width: 560px; }
    .error { background: rgba(127, 29, 29, 0.35); }
    .warning { background: rgba(113, 63, 18, 0.28); }
    .info { background: rgba(30, 64, 175, 0.2); }
    code { color: #93c5fd; }
  </style>
</head>
<body>
  <h1>Champion Ability Text Audit</h1>
  <p>Snapshot: <code>${args.rarity}★ r${args.rank} sig${args.sig}</code></p>
  <pre>${escapeHtml(JSON.stringify(summary, null, 2))}</pre>
  <table>
    <thead>
      <tr>
        <th>Severity</th><th>Rule</th><th>Champion</th><th>Source</th><th>Title</th><th>Detail</th><th>Rendered Text</th><th>Values</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

async function main() {
  const args = parseArgs();
  const abilityText = await loadAbilityTextModule();
  const champions = await prisma.champion.findMany({
    where: {
      abilityTexts: { some: {} },
      stats: { some: { rarity: args.rarity, rank: args.rank } },
    },
    orderBy: { name: "asc" },
    take: args.limit && args.limit > 0 ? args.limit : undefined,
    include: {
      abilityTexts: { orderBy: { sortOrder: "asc" } },
      abilityCurves: true,
      stats: {
        where: { rarity: args.rarity, rank: args.rank },
        orderBy: { level: "desc" },
        take: 1,
      },
    },
  });

  const issues: AuditIssue[] = [];
  let renderedRecords = 0;

  for (const champion of champions) {
    const stat = champion.stats[0];
    if (!stat) continue;
    const view = abilityText.prepareChampionAbilityTextView({
      records: champion.abilityTexts,
      curves: champion.abilityCurves,
      maxSig: args.maxSig,
      sigLevel: args.sig,
      stat: {
        attack: stat.attack,
        health: stat.health,
        challengeRating: stat.challengeRating,
        sigAbilityIds: stat.sigAbilityIds,
      },
    });

    for (const panel of [view.signaturePanel, ...view.descriptionPanels]) {
      for (const record of panel.records) {
        renderedRecords++;
        const rendered = renderPrepared(record.prepared);
        issues.push(...collectIssues(record, champion, rendered));
      }
    }
  }

  fs.mkdirSync(args.outDir, { recursive: true });
  const jsonPath = path.join(args.outDir, "ability-text-audit.json");
  const htmlPath = path.join(args.outDir, "ability-text-audit.html");
  const payload = {
    generatedAt: new Date().toISOString(),
    args,
    championCount: champions.length,
    renderedRecords,
    summary: summarize(issues),
    issues,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(htmlPath, renderHtml(args, issues));

  console.log(`Champions audited: ${champions.length}`);
  console.log(`Rendered records: ${renderedRecords}`);
  console.log(`Issues: ${issues.length}`);
  console.log(`By rule: ${JSON.stringify(payload.summary.byRule)}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`HTML: ${htmlPath}`);
}

main()
  .catch(error => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
