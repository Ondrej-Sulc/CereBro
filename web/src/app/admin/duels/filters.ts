import { DuelSource, DuelStatus, Prisma } from "@prisma/client";

export const DUEL_PAGE_SIZE = 50;

export const duelStatusOptions = ["SUGGESTED", "OUTDATED", "ACTIVE", "ARCHIVED", "all"] as const;
export const duelSourceOptions = ["USER_SUGGESTION", "GUIA_MTC", "COCPIT", "MCOCHUB", "all"] as const;

export type DuelStatusFilter = (typeof duelStatusOptions)[number];
export type DuelSourceFilter = (typeof duelSourceOptions)[number];

export interface DuelFilterInput {
  status?: DuelStatusFilter;
  source?: DuelSourceFilter;
  q?: string;
}

export function getDuelStatusFilter(value: string | undefined): DuelStatusFilter {
  return duelStatusOptions.includes(value as DuelStatusFilter) ? (value as DuelStatusFilter) : "SUGGESTED";
}

export function getDuelSourceFilter(value: string | undefined): DuelSourceFilter {
  return duelSourceOptions.includes(value as DuelSourceFilter) ? (value as DuelSourceFilter) : "all";
}

export function getDuelPage(value: string | undefined) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function normalizeDuelFilter(filter: DuelFilterInput): Required<DuelFilterInput> {
  return {
    status: getDuelStatusFilter(filter.status),
    source: getDuelSourceFilter(filter.source),
    q: filter.q?.trim() || "",
  };
}

export function buildDuelWhere(filter: DuelFilterInput, statusOverride?: DuelStatus): Prisma.DuelWhereInput {
  const normalized = normalizeDuelFilter(filter);
  const where: Prisma.DuelWhereInput = {};

  if (statusOverride) {
    where.status = statusOverride;
  } else if (normalized.status !== "all") {
    where.status = normalized.status as DuelStatus;
  }

  if (normalized.source !== "all") {
    where.source = normalized.source as DuelSource;
  }

  if (normalized.q) {
    where.OR = [
      { playerName: { contains: normalized.q, mode: "insensitive" } },
      { rank: { contains: normalized.q, mode: "insensitive" } },
      { submittedByDiscordId: { contains: normalized.q, mode: "insensitive" } },
      { champion: { name: { contains: normalized.q, mode: "insensitive" } } },
      { champion: { shortName: { contains: normalized.q, mode: "insensitive" } } },
    ];
  }

  return where;
}

export function formatDuelFilterSummary(filter: DuelFilterInput, fromStatus?: DuelStatus) {
  const normalized = normalizeDuelFilter(filter);
  const parts = [
    `status ${fromStatus ?? normalized.status}`,
    `source ${normalized.source}`,
  ];
  if (normalized.q) parts.push(`search "${normalized.q}"`);
  return parts.join(", ");
}
