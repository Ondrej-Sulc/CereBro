import { Prisma, PrismaClient } from '@prisma/client';
import {
  ChampionRecord,
  MatchResult,
  matchGameChampionIdentity,
} from './mcocGameStatsImportService';
import type {
  ChampionAbilityTextTemplate,
  ChampionAbilityTextTemplateNode,
  ChampionAbilityTextTemplateValueSource,
} from '../domain/champion-ability-text/types';

export type GameDescriptionChampion = {
  base_id?: string;
  full_name?: string;
  short_name?: string;
  bio?: string;
  base_abilities?: Array<{ description?: string; buff_name?: string; group?: string; source?: GameDescriptionTextSource }>;
  sig_ability?: { title?: string; description?: string; source?: GameDescriptionTextSource } | null;
  sig_abilities?: Array<{ title?: string; description?: string; buff_name?: string; source?: GameDescriptionTextSource }>;
  special_attacks?: Array<{ name?: string; description?: string }>;
};

export type GameDescriptionsFile = Record<string, GameDescriptionChampion>;

export type GameGlossaryEntry = {
  name?: string;
  description?: string;
  category?: string;
  category_name?: string;
  hud_label?: string;
  [key: string]: unknown;
};

export type GameGlossaryFile = Record<string, GameGlossaryEntry>;

export type GameDescriptionTemplateNode = ChampionAbilityTextTemplateNode;
export type GameDescriptionValueSource = ChampionAbilityTextTemplateValueSource;

export type GameDescriptionTextSource = {
  panel_id?: string;
  component_id?: string;
  hud_id?: string;
  placeholder_sources?: Record<string, GameDescriptionValueSource>;
};

export type GameDescriptionTemplate = ChampionAbilityTextTemplate;

export type McocGameDescriptionsImportReport = {
  championCount: number;
  matched: number;
  unmatched: string[];
  ambiguous: string[];
  conflicts: string[];
  textRecords: number;
  glossaryTerms: number;
  canWrite: boolean;
  written?: {
    textRecordsDeleted: number;
    textRecordsCreated: number;
    glossaryTermsUpserted: number;
  };
};

type PreparedTextRecord = {
  sourceId: string;
  group: string;
  title: string | null;
  sortOrder: number;
  template: GameDescriptionTemplate;
};

type SignatureAbilityRecord = { title?: string; description?: string; buff_name?: string; source?: GameDescriptionTextSource };

export function parseMcocGameDescriptionsJson(text: string): GameDescriptionsFile {
  const data = JSON.parse(text) as GameDescriptionsFile;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid champions description file: expected object keyed by game ID');
  }
  return data;
}

export function parseMcocGameGlossaryJson(text: string): GameGlossaryFile {
  const data = JSON.parse(text) as GameGlossaryFile;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid glossary file: expected object keyed by glossary ID');
  }
  return data;
}

function pushText(nodes: GameDescriptionTemplateNode[], value: string) {
  if (!value) return;
  const last = nodes[nodes.length - 1];
  if (last?.type === 'text') {
    last.value += value;
    return;
  }
  nodes.push({ type: 'text', value });
}

function cleanDisplayTitle(value?: string | null) {
  return value?.replace(/\[[0-9a-fA-F]{6,8}\]|\[-\]/g, '').trim() || null;
}

function parseInline(text: string, placeholderSources: Record<string, GameDescriptionValueSource> = {}): GameDescriptionTemplateNode[] {
  const nodes: GameDescriptionTemplateNode[] = [];
  const tokenPattern = /\[k=glossary\/([^\]]+)\]([\s\S]*?)\[\/k\]|\[([0-9a-fA-F]{6,8})\]([\s\S]*?)\[-\]|\{(\d+)\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    pushText(nodes, text.slice(cursor, match.index));

    if (match[1] !== undefined) {
      nodes.push({
        type: 'glossary',
        id: match[1],
        label: match[2] ?? '',
      });
    } else if (match[3] !== undefined) {
      nodes.push({
        type: 'color',
        color: match[3],
        children: parseInline(match[4] ?? '', placeholderSources),
      });
    } else if (match[5] !== undefined) {
      const placeholderIndex = Number(match[5]);
      nodes.push({
        type: 'value',
        key: `placeholder_${placeholderIndex}`,
        placeholderIndex,
        source: placeholderSources[String(placeholderIndex)] ?? { kind: 'placeholder' },
      });
    }

    cursor = match.index + match[0].length;
  }

  pushText(nodes, text.slice(cursor));
  return nodes;
}

export function buildDescriptionTemplate(text: string, source?: GameDescriptionTextSource): GameDescriptionTemplate {
  const paragraphs = text.split(/\r?\n+/).filter(paragraph => paragraph.trim().length > 0);
  const placeholderSources = source?.placeholder_sources ?? {};
  return {
    raw: text,
    blocks: (paragraphs.length ? paragraphs : ['']).map(paragraph => ({
      type: 'paragraph',
      children: parseInline(paragraph, placeholderSources),
    })),
  };
}

function buildTextRecords(champion: GameDescriptionChampion): PreparedTextRecord[] {
  const records: PreparedTextRecord[] = [];
  let sortOrder = 0;

  if (champion.bio?.trim()) {
    records.push({
      sourceId: 'bio',
      group: 'bio',
      title: null,
      sortOrder: sortOrder++,
      template: buildDescriptionTemplate(champion.bio),
    });
  }

  for (const [index, ability] of (champion.base_abilities ?? []).entries()) {
    const description = ability.description?.trim();
    if (!description) continue;
    const group = normalizeTextGroup(ability.group);
    records.push({
      sourceId: `${group}:${index + 1}`,
      group,
      title: cleanDisplayTitle(ability.buff_name),
      sortOrder: sortOrder++,
      template: buildDescriptionTemplate(description, ability.source),
    });
  }

  const signatureAbilities: SignatureAbilityRecord[] = champion.sig_abilities?.length
    ? champion.sig_abilities
    : champion.sig_ability
      ? [champion.sig_ability]
      : [];

  for (const [index, ability] of signatureAbilities.entries()) {
    const description = ability.description?.trim();
    if (!description) continue;
    records.push({
      sourceId: index === 0 ? 'signature' : `signature:${index + 1}`,
      group: 'signature',
      title: cleanDisplayTitle(ability.title) || cleanDisplayTitle(ability.buff_name),
      sortOrder: sortOrder++,
      template: buildDescriptionTemplate(description, ability.source),
    });
  }

  for (const [index, attack] of (champion.special_attacks ?? []).entries()) {
    const description = attack.description?.trim();
    if (!description) continue;
    records.push({
      sourceId: `special:${index + 1}`,
      group: 'special',
      title: cleanDisplayTitle(attack.name),
      sortOrder: sortOrder++,
      template: buildDescriptionTemplate(description),
    });
  }

  return records;
}

function normalizeTextGroup(value?: string | null) {
  return value && /^[a-z][a-z0-9_-]*$/i.test(value) ? value : 'base';
}

function formatMatchIssue(gameId: string, champion: GameDescriptionChampion, reason: string) {
  return `${gameId}: ${champion.full_name || champion.short_name || champion.base_id || gameId} (${reason})`;
}

function summarizeMatches(
  descriptions: GameDescriptionsFile,
  matches: Map<string, MatchResult>
): Omit<McocGameDescriptionsImportReport, 'written'> {
  let matched = 0;
  let textRecords = 0;
  const unmatched: string[] = [];
  const ambiguous: string[] = [];
  const conflicts: string[] = [];

  for (const [gameId, champion] of Object.entries(descriptions)) {
    const match = matches.get(gameId);
    if (!match) continue;

    if (match.status === 'matched') {
      matched++;
      textRecords += buildTextRecords(champion).length;
      continue;
    }

    if (match.status === 'unmatched') {
      unmatched.push(formatMatchIssue(gameId, champion, match.reason));
    } else if (match.status === 'ambiguous') {
      ambiguous.push(formatMatchIssue(gameId, champion, match.reason));
    } else {
      conflicts.push(formatMatchIssue(gameId, champion, match.reason));
    }
  }

  return {
    championCount: Object.keys(descriptions).length,
    matched,
    unmatched,
    ambiguous,
    conflicts,
    textRecords,
    glossaryTerms: 0,
    canWrite: true,
  };
}

export async function importMcocGameDescriptions(
  prisma: PrismaClient,
  descriptions: GameDescriptionsFile,
  glossary: GameGlossaryFile,
  options: { write?: boolean } = {}
): Promise<McocGameDescriptionsImportReport> {
  const dbChampions = await prisma.champion.findMany({
    select: { id: true, name: true, shortName: true, gameId: true },
  });
  const matches = new Map<string, MatchResult>();

  for (const [gameId, champion] of Object.entries(descriptions)) {
    matches.set(
      gameId,
      matchGameChampionIdentity(
        {
          gameId: champion.base_id || gameId,
          gameFullName: champion.full_name || gameId,
          gameShortName: champion.short_name || '',
        },
        dbChampions as ChampionRecord[]
      )
    );
  }

  const summary = summarizeMatches(descriptions, matches);
  const report: McocGameDescriptionsImportReport = {
    ...summary,
    glossaryTerms: Object.keys(glossary).length,
  };

  if (!options.write) return report;

  let textRecordsDeleted = 0;
  let textRecordsCreated = 0;
  let glossaryTermsUpserted = 0;

  for (const [id, entry] of Object.entries(glossary)) {
    await prisma.gameGlossaryTerm.upsert({
      where: { id },
      update: {
        name: entry.name ?? '',
        description: entry.description || null,
        category: entry.category ?? entry.category_name ?? null,
        raw: entry as Prisma.InputJsonValue,
      },
      create: {
        id,
        name: entry.name ?? '',
        description: entry.description || null,
        category: entry.category ?? entry.category_name ?? null,
        raw: entry as Prisma.InputJsonValue,
      },
    });
    glossaryTermsUpserted++;
  }

  for (const [gameId, champion] of Object.entries(descriptions)) {
    const match = matches.get(gameId);
    if (match?.status !== 'matched') continue;

    const records = buildTextRecords(champion);
    await prisma.$transaction(async tx => {
      const deleted = await tx.championAbilityText.deleteMany({
        where: {
          championId: match.champion.id,
        },
      });
      textRecordsDeleted += deleted.count;

      if (!records.length) return;
      await tx.championAbilityText.createMany({
        data: records.map(record => ({
          championId: match.champion.id,
          sourceId: record.sourceId,
          group: record.group,
          title: record.title,
          sortOrder: record.sortOrder,
          template: record.template as unknown as Prisma.InputJsonValue,
        })),
      });
      textRecordsCreated += records.length;
    });
  }

  return {
    ...report,
    written: {
      textRecordsDeleted,
      textRecordsCreated,
      glossaryTermsUpserted,
    },
  };
}
