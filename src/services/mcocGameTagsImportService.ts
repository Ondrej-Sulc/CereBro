import { PrismaClient } from '@prisma/client';
import {
  ChampionRecord,
  matchGameChampionIdentity,
} from './mcocGameStatsImportService';

export type GameTagEntry = {
  name: string;
  category_name: string;
};

export type GameChampionTagEntry = {
  id?: string;
  full_name: string;
  short_name?: string;
  champion_tags: string[];
};

export type GameHeroTierEntry = {
  id?: string;
  size?: string;
  tags?: string[];
};

export type GameTagsFile = { tags: Record<string, GameTagEntry> };
export type GameChampionTagsFile = Record<string, GameChampionTagEntry>;
export type GameHeroTiersFile = Record<string, GameHeroTierEntry>;

export type McocGameTagsImportReport = {
  sourceChampions: number;
  dedupedChampions: number;
  sourceTags: number;
  sourceGenderTiers: number;
  genderTagged: number;
  genderMissing: number;
  updated: number;
  skipped: string[];
  blocked: string[];
  deletedTags: number;
};

const HERO_TIER_SUFFIXES = ['_mls', '_cm', '_un', '_rar', '_ep', '_leg', '_t6', '_t7']
  .sort((a, b) => b.length - a.length);
const GENDER_CATEGORY = 'Gender';

function parseObject<T>(text: string, label: string): T {
  const data = JSON.parse(text) as T;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`Invalid ${label}: expected a JSON object`);
  }
  return data;
}

export function parseMcocGameTagsJson(text: string): GameTagsFile {
  const data = parseObject<GameTagsFile>(text, 'tags file');
  if (!data.tags || typeof data.tags !== 'object' || Array.isArray(data.tags)) {
    throw new Error('Invalid tags file: expected a tags object');
  }
  return data;
}

export function parseMcocChampionTagsJson(text: string): GameChampionTagsFile {
  return parseObject<GameChampionTagsFile>(text, 'champion display file');
}

export function parseMcocHeroTiersJson(text: string): GameHeroTiersFile {
  return parseObject<GameHeroTiersFile>(text, 'hero tiers file');
}

function splitHeroTierId(tierId: string) {
  for (const suffix of HERO_TIER_SUFFIXES) {
    if (tierId.endsWith(suffix)) return tierId.slice(0, -suffix.length);
  }
  return tierId;
}

function inferGenderFromTier(entry: GameHeroTierEntry): 'Male' | 'Female' | null {
  const tags = new Set(entry.tags ?? []);
  if (entry.size === 'female' || tags.has('female') || tags.has('fem')) return 'Female';
  if (tags.has('male')) return 'Male';
  return null;
}

export function buildGenderMapFromHeroTiers(heroTiersData: GameHeroTiersFile) {
  const countsByGameId = new Map<string, Map<'Male' | 'Female', number>>();

  for (const [tierId, tier] of Object.entries(heroTiersData)) {
    const gender = inferGenderFromTier(tier);
    if (!gender) continue;
    const gameId = splitHeroTierId(tier.id || tierId);
    const counts = countsByGameId.get(gameId) ?? new Map<'Male' | 'Female', number>();
    counts.set(gender, (counts.get(gender) ?? 0) + 1);
    countsByGameId.set(gameId, counts);
  }

  const genderByGameId = new Map<string, 'Male' | 'Female'>();
  for (const [gameId, counts] of countsByGameId) {
    const male = counts.get('Male') ?? 0;
    const female = counts.get('Female') ?? 0;
    if (female > male) genderByGameId.set(gameId, 'Female');
    else if (male > female) genderByGameId.set(gameId, 'Male');
    else if (female > 0) genderByGameId.set(gameId, 'Female');
  }

  return { genderByGameId, sourceGenderTiers: Object.keys(heroTiersData).length };
}

function dedupeChampions(champions: GameChampionTagsFile, dbGameIds: Set<string>) {
  const deduped = new Map<string, GameChampionTagEntry>();
  for (const champ of Object.values(champions)) {
    const existing = deduped.get(champ.full_name);
    const existingHasKnownGameId = !!existing?.id && dbGameIds.has(existing.id);
    const currentHasKnownGameId = !!champ.id && dbGameIds.has(champ.id);
    if (
      !existing ||
      (!existingHasKnownGameId && currentHasKnownGameId) ||
      (existingHasKnownGameId === currentHasKnownGameId && champ.champion_tags.length > existing.champion_tags.length)
    ) {
      deduped.set(champ.full_name, champ);
    }
  }
  return deduped;
}

export async function importMcocGameTags(
  prisma: PrismaClient,
  input: {
    champions: GameChampionTagsFile;
    tags: GameTagsFile;
    heroTiers: GameHeroTiersFile;
  },
  options: { write?: boolean; pruneUnusedTags?: boolean } = {}
): Promise<McocGameTagsImportReport> {
  const tagMap = new Map(Object.entries(input.tags.tags));
  const { genderByGameId, sourceGenderTiers } = buildGenderMapFromHeroTiers(input.heroTiers);
  const dbChampions = await prisma.champion.findMany({
    select: { id: true, name: true, shortName: true, gameId: true },
  });
  const dbGameIds = new Set(dbChampions.map(champion => champion.gameId).filter((id): id is string => !!id));
  const dedupedChampions = dedupeChampions(input.champions, dbGameIds);

  let updated = 0;
  let genderTagged = 0;
  let genderMissing = 0;
  let deletedTags = 0;
  const skipped: string[] = [];
  const blocked: string[] = [];

  for (const champ of dedupedChampions.values()) {
    const match = matchGameChampionIdentity(
      {
        gameId: champ.id || '',
        gameFullName: champ.full_name,
        gameShortName: '',
      },
      dbChampions as ChampionRecord[]
    );
    if (match.status === 'unmatched') {
      skipped.push(`${champ.id || champ.full_name}: ${champ.full_name}`);
      continue;
    }
    if (match.status !== 'matched') {
      blocked.push(`${champ.id || champ.full_name}: ${champ.full_name} (${match.reason})`);
      continue;
    }

    const gender = genderByGameId.get(champ.id || match.champion.gameId || '');
    if (gender) genderTagged++;
    else genderMissing++;

    if (options.write) {
      await prisma.$transaction(async tx => {
        const tagConnections: { id: number }[] = [];
        for (const tagId of champ.champion_tags) {
          const entry = tagMap.get(tagId);
          if (!entry) continue;
          const name = entry.name.replace(/\[[^\]]*\]/g, '').trim();
          const tag = await tx.tag.upsert({
            where: { name_category: { name, category: entry.category_name } },
            update: {},
            create: { name, category: entry.category_name },
          });
          tagConnections.push({ id: tag.id });
        }

        if (gender) {
          const genderTag = await tx.tag.upsert({
            where: { name_category: { name: gender, category: GENDER_CATEGORY } },
            update: {},
            create: { name: gender, category: GENDER_CATEGORY },
          });
          tagConnections.push({ id: genderTag.id });
        }

        const dedupedConnections = [...new Map(tagConnections.map(tag => [tag.id, tag])).values()];
        await tx.champion.update({
          where: { id: match.champion.id },
          data: { tags: { set: dedupedConnections } },
        });
      });
    }

    updated++;
  }

  if (options.write && options.pruneUnusedTags) {
    const result = await prisma.tag.deleteMany({
      where: {
        champions: { none: {} },
        highlightedInPlans: { none: {} },
        attackTactics: { none: {} },
        defenseTactics: { none: {} },
        questRequiredInEncounters: { none: {} },
        questObjectiveRequiredIn: { none: {} },
        questRequiredInPlans: { none: {} },
      },
    });
    deletedTags = result.count;
  }

  return {
    sourceChampions: Object.keys(input.champions).length,
    dedupedChampions: dedupedChampions.size,
    sourceTags: tagMap.size,
    sourceGenderTiers,
    genderTagged,
    genderMissing,
    updated,
    skipped,
    blocked,
    deletedTags,
  };
}
