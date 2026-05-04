import { PrismaClient } from '@prisma/client';
import { normalizeChampionName } from '../utils/championHelper';

export type ChampionRecord = {
  id: number;
  name: string;
  shortName: string;
  gameId: string | null;
};

export type GameStatsFile = {
  metadata?: {
    schemaVersion?: number;
    generatedAt?: string;
  };
  champions: GameChampion[];
};

export type GameChampion = {
  gameId: string;
  gameFullName: string;
  gameShortName: string;
  tiers: GameTier[];
};

export type GameTier = {
  tierId: string;
  rarity?: number | null;
  rarityLabel?: string | null;
  ranks: GameRank[];
};

export type GameRank = {
  rank: number;
  level?: number | null;
  challengeRating: number;
  health?: number | null;
  attack?: number | null;
  healthRating?: number | null;
  attackRating?: number | null;
  prestige?: number | null;
  armorRating?: number | null;
  armorPenetration?: number | null;
  criticalRating?: number | null;
  criticalResistance?: number | null;
  criticalDamageRating?: number | null;
  blockProficiency?: number | null;
  blockPenetration?: number | null;
  specialDamageMultiplier?: number | null;
  energyResistance?: number | null;
  physicalResistance?: number | null;
  baseAbilityIds?: string[];
  sigAbilityIds?: string[];
};

export type MatchResult =
  | { status: 'matched'; champion: ChampionRecord; method: string }
  | { status: 'unmatched'; reason: string }
  | { status: 'ambiguous'; reason: string; candidates: ChampionRecord[] }
  | { status: 'conflict'; reason: string; champion: ChampionRecord };

export type McocGameStatsImportReport = {
  schemaVersion: number | string;
  generatedAt: string;
  championCount: number;
  tierCount: number;
  rankCount: number;
  matched: number;
  methods: Record<string, number>;
  unmatched: string[];
  ambiguous: string[];
  conflicts: string[];
  gameIdsToSet: string[];
  nameMismatches: string[];
  prestigeDeltas: Record<string, number>;
  canWrite: boolean;
  written?: {
    updatedChampions: number;
    upsertedStats: number;
    deletedStaleNullStats: number;
  };
};

const manualGameIdToChampionName: Record<string, string> = {
  aegon: 'Aegon',
  abomination: 'Abomination',
  antman: 'Ant-Man',
  blackpanther: 'Black Panther',
  blackwidow: 'Black Widow',
  captainamerica: 'Captain America',
  captainmarvel_movie: 'Captain Marvel',
  deadpool: 'Deadpool',
  groot_king: 'King Groot',
  guillotine: 'Guillotine',
  hulk: 'Hulk',
  ironfist: 'Iron Fist',
  ironman: 'Iron Man',
  magneto: 'Magneto',
  msmarvel: 'Ms. Marvel',
  scarletwitch_current: 'Scarlet Witch',
  shehulk: 'She-Hulk',
  storm: 'Storm',
  thor: 'Thor',
  ultron_prime: 'Ultron',
  vision: 'Vision',
  brothervoodoo: 'Doctor Voodoo',
};

export function parseMcocGameStatsJson(text: string): GameStatsFile {
  const data = JSON.parse(text) as GameStatsFile;
  if (!Array.isArray(data.champions)) {
    throw new Error('Invalid game stats file: expected champions array');
  }
  return data;
}

function strictNameKey(name: string): string {
  return normalizeChampionName(name);
}

function looseNameKey(name: string): string {
  return normalizeChampionName(
    name
      .normalize('NFKD')
      .replace(/[Ææ]/g, 'ae')
      .replace(/[’`]/g, "'")
  );
}

function addIndex(
  index: Map<string, ChampionRecord[]>,
  key: string,
  champion: ChampionRecord
) {
  if (!key) return;
  const existing = index.get(key) ?? [];
  if (existing.some(candidate => candidate.id === champion.id)) return;
  existing.push(champion);
  index.set(key, existing);
}

function pickIndexed(
  index: Map<string, ChampionRecord[]>,
  key: string,
  method: string
): MatchResult | null {
  const candidates = index.get(key);
  if (!candidates?.length) return null;
  if (candidates.length > 1) {
    return {
      status: 'ambiguous',
      reason: `${method} matched ${candidates.length} champions`,
      candidates,
    };
  }
  return { status: 'matched', champion: candidates[0], method };
}

function buildIndexes(champions: ChampionRecord[]) {
  const byGameId = new Map<string, ChampionRecord>();
  const byCanonicalName = new Map<string, ChampionRecord[]>();
  const byStrictName = new Map<string, ChampionRecord[]>();
  const byLooseName = new Map<string, ChampionRecord[]>();

  for (const champion of champions) {
    if (champion.gameId) byGameId.set(champion.gameId, champion);
    addIndex(byCanonicalName, strictNameKey(champion.name), champion);
    addIndex(byStrictName, strictNameKey(champion.name), champion);
    addIndex(byStrictName, strictNameKey(champion.shortName), champion);
    addIndex(byLooseName, looseNameKey(champion.name), champion);
    addIndex(byLooseName, looseNameKey(champion.shortName), champion);
  }

  return { byGameId, byCanonicalName, byStrictName, byLooseName };
}

function matchChampion(
  gameChampion: GameChampion,
  indexes: ReturnType<typeof buildIndexes>
): MatchResult {
  const existingGameId = indexes.byGameId.get(gameChampion.gameId);
  if (existingGameId) {
    return { status: 'matched', champion: existingGameId, method: 'gameId' };
  }

  const manualName = manualGameIdToChampionName[gameChampion.gameId];
  if (manualName) {
    const manualMatch = pickIndexed(indexes.byCanonicalName, strictNameKey(manualName), 'manual');
    if (manualMatch) return manualMatch;
  }

  const candidateKeys = [
    strictNameKey(gameChampion.gameFullName),
    strictNameKey(gameChampion.gameShortName),
    looseNameKey(gameChampion.gameFullName),
    looseNameKey(gameChampion.gameShortName),
  ];

  for (const key of candidateKeys) {
    const match =
      pickIndexed(indexes.byStrictName, key, 'name') ??
      pickIndexed(indexes.byLooseName, key, 'looseName');
    if (match?.status === 'matched' && match.champion.gameId && match.champion.gameId !== gameChampion.gameId) {
      return {
        status: 'conflict',
        reason: `matched champion already has gameId ${match.champion.gameId}`,
        champion: match.champion,
      };
    }
    if (match) return match;
  }

  return { status: 'unmatched', reason: 'no gameId/name/shortName match' };
}

export function matchGameChampionIdentity(
  gameChampion: { gameId: string; gameFullName: string; gameShortName?: string },
  champions: ChampionRecord[]
): MatchResult {
  const indexes = buildIndexes(champions);
  return matchChampion(
    {
      gameId: gameChampion.gameId,
      gameFullName: gameChampion.gameFullName,
      gameShortName: gameChampion.gameShortName ?? '',
      tiers: [],
    },
    indexes
  );
}

function countRows(data: GameStatsFile) {
  let tierCount = 0;
  let rankCount = 0;
  for (const champion of data.champions) {
    tierCount += champion.tiers.length;
    for (const tier of champion.tiers) {
      rankCount += tier.ranks.length;
    }
  }
  return { championCount: data.champions.length, tierCount, rankCount };
}

function summarizeReport(
  data: GameStatsFile,
  matches: Map<string, MatchResult>
): McocGameStatsImportReport {
  const counts = countRows(data);
  const methodCounts = new Map<string, number>();
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  const conflicts: string[] = [];
  const gameIdsToSet: string[] = [];
  const nameMismatches: string[] = [];
  const prestigeDeltas = new Map<number, number>();

  for (const champion of data.champions) {
    const match = matches.get(champion.gameId);
    if (!match) continue;

    if (match.status === 'matched') {
      methodCounts.set(match.method, (methodCounts.get(match.method) ?? 0) + 1);
      if (!match.champion.gameId) {
        gameIdsToSet.push(`${champion.gameId} -> ${match.champion.name}`);
      }

      const gameNameKey = looseNameKey(champion.gameFullName || champion.gameShortName);
      const dbNameKey = looseNameKey(match.champion.name);
      const dbShortKey = looseNameKey(match.champion.shortName);
      if (gameNameKey && gameNameKey !== dbNameKey && gameNameKey !== dbShortKey) {
        nameMismatches.push(
          `${champion.gameId}: game="${champion.gameFullName}" db="${match.champion.name}" (${match.champion.shortName})`
        );
      }
    } else if (match.status === 'unmatched') {
      unmatched.push(`${champion.gameId}: ${champion.gameFullName} (${match.reason})`);
    } else if (match.status === 'ambiguous') {
      ambiguous.push(
        `${champion.gameId}: ${champion.gameFullName} -> ${match.candidates.map(c => c.name).join(', ')}`
      );
    } else {
      conflicts.push(
        `${champion.gameId}: ${champion.gameFullName} -> ${match.champion.name} (${match.reason})`
      );
    }

    for (const tier of champion.tiers) {
      for (const rank of tier.ranks) {
        if (
          typeof rank.healthRating === 'number' &&
          typeof rank.attackRating === 'number' &&
          typeof rank.prestige === 'number'
        ) {
          const delta = rank.healthRating + rank.attackRating - rank.prestige;
          prestigeDeltas.set(delta, (prestigeDeltas.get(delta) ?? 0) + 1);
        }
      }
    }
  }

  return {
    ...counts,
    schemaVersion: data.metadata?.schemaVersion ?? 'unknown',
    generatedAt: data.metadata?.generatedAt ?? 'unknown',
    methods: Object.fromEntries([...methodCounts.entries()].sort()),
    matched: [...matches.values()].filter(match => match.status === 'matched').length,
    unmatched,
    ambiguous,
    conflicts,
    gameIdsToSet,
    nameMismatches,
    prestigeDeltas: Object.fromEntries([...prestigeDeltas.entries()].sort((a, b) => a[0] - b[0])),
    canWrite: ambiguous.length === 0 && conflicts.length === 0,
  };
}

async function writeImport(
  prisma: PrismaClient,
  data: GameStatsFile,
  matches: Map<string, MatchResult>
) {
  let updatedChampions = 0;
  let upsertedStats = 0;
  let deletedStaleNullStats = 0;
  const importedKeys = new Set<string>();

  for (const gameChampion of data.champions) {
    const match = matches.get(gameChampion.gameId);
    if (match?.status !== 'matched') continue;

    if (match.champion.gameId !== gameChampion.gameId) {
      await prisma.champion.update({
        where: { id: match.champion.id },
        data: { gameId: gameChampion.gameId },
      });
      updatedChampions++;
    }

    for (const tier of gameChampion.tiers) {
      for (const rank of tier.ranks) {
        importedKeys.add(`${tier.tierId}:${rank.rank}`);
        await prisma.championStats.upsert({
          where: {
            tierId_rank: {
              tierId: tier.tierId,
              rank: rank.rank,
            },
          },
          update: {
            championId: match.champion.id,
            rarity: tier.rarity ?? null,
            rarityLabel: tier.rarityLabel ?? null,
            level: rank.level ?? null,
            challengeRating: rank.challengeRating,
            health: rank.health ?? undefined,
            attack: rank.attack ?? undefined,
            healthRating: rank.healthRating ?? undefined,
            attackRating: rank.attackRating ?? undefined,
            prestige: rank.prestige ?? undefined,
            armorRating: rank.armorRating ?? null,
            armorPenetration: rank.armorPenetration ?? null,
            criticalRating: rank.criticalRating ?? null,
            criticalResistance: rank.criticalResistance ?? null,
            criticalDamageRating: rank.criticalDamageRating ?? null,
            blockProficiency: rank.blockProficiency ?? null,
            blockPenetration: rank.blockPenetration ?? null,
            specialDamageMultiplier: rank.specialDamageMultiplier ?? null,
            energyResistance: rank.energyResistance ?? null,
            physicalResistance: rank.physicalResistance ?? null,
            baseAbilityIds: rank.baseAbilityIds ?? [],
            sigAbilityIds: rank.sigAbilityIds ?? [],
          },
          create: {
            championId: match.champion.id,
            tierId: tier.tierId,
            rarity: tier.rarity ?? null,
            rarityLabel: tier.rarityLabel ?? null,
            rank: rank.rank,
            level: rank.level ?? null,
            challengeRating: rank.challengeRating,
            health: rank.health ?? null,
            attack: rank.attack ?? null,
            healthRating: rank.healthRating ?? null,
            attackRating: rank.attackRating ?? null,
            prestige: rank.prestige ?? null,
            armorRating: rank.armorRating ?? null,
            armorPenetration: rank.armorPenetration ?? null,
            criticalRating: rank.criticalRating ?? null,
            criticalResistance: rank.criticalResistance ?? null,
            criticalDamageRating: rank.criticalDamageRating ?? null,
            blockProficiency: rank.blockProficiency ?? null,
            blockPenetration: rank.blockPenetration ?? null,
            specialDamageMultiplier: rank.specialDamageMultiplier ?? null,
            energyResistance: rank.energyResistance ?? null,
            physicalResistance: rank.physicalResistance ?? null,
            baseAbilityIds: rank.baseAbilityIds ?? [],
            sigAbilityIds: rank.sigAbilityIds ?? [],
          },
        });
        upsertedStats++;
      }
    }
  }

  const staleNullRows = await prisma.championStats.findMany({
    where: {
      health: null,
      attack: null,
      healthRating: null,
      attackRating: null,
      prestige: null,
    },
    select: { id: true, tierId: true, rank: true },
  });
  const staleIds = staleNullRows
    .filter(row => !importedKeys.has(`${row.tierId}:${row.rank}`))
    .map(row => row.id);

  for (let index = 0; index < staleIds.length; index += 1000) {
    const ids = staleIds.slice(index, index + 1000);
    const result = await prisma.championStats.deleteMany({
      where: { id: { in: ids } },
    });
    deletedStaleNullStats += result.count;
  }

  return { updatedChampions, upsertedStats, deletedStaleNullStats };
}

export async function importMcocGameStats(
  prisma: PrismaClient,
  data: GameStatsFile,
  options: { write?: boolean } = {}
): Promise<McocGameStatsImportReport> {
  const champions = await prisma.champion.findMany({
    select: { id: true, name: true, shortName: true, gameId: true },
  });
  const indexes = buildIndexes(champions);
  const matches = new Map<string, MatchResult>();

  for (const champion of data.champions) {
    matches.set(champion.gameId, matchChampion(champion, indexes));
  }

  const report = summarizeReport(data, matches);

  if (!options.write) return report;

  if (!report.canWrite) {
    throw new Error('Refusing to write while ambiguous or conflicting champions remain.');
  }

  report.written = await writeImport(prisma, data, matches);
  return report;
}
