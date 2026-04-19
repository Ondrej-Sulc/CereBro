"use server"

import { prisma } from "@/lib/prisma"
import { ChampionAbilityLink, AbilityLinkType, AttackType, ChampionClass, Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { ensureAdmin } from "../actions"

import { AdminChampionData } from "./champion-card"
import { ChampionImages } from "@/types/champion"
import { withActionContext } from "@/lib/with-request-context"
import { OpenRouterService } from "@cerebro/core/services/openRouterService"
import { abilityDraftPrompt } from "@cerebro/core/prompts/abilityDraft"

type AbilityDraftItem = { name: string; source: string }
export type AbilityDraft = { abilities?: AbilityDraftItem[]; immunities?: AbilityDraftItem[] }

export type ModelOption = { id: string; name: string }

const DRAFT_MODEL_PROVIDERS = ['google/', 'anthropic/', 'openai/', 'meta-llama/', 'x-ai/', 'mistralai/']

// Module-level cache: valid for 10 minutes in long-running server process
let _modelCache: { data: ModelOption[]; expiresAt: number } | null = null

/**
 * Full abilities JSON payload.
 * Expected shape: { signature?: { name: string, ... }, abilities_breakdown?: { title?: string, description?: string }[], ... }
 * Runtime validation in updateChampionFullAbilities enforces the structure.
 */
type FullAbilitiesInput = Record<string, unknown>;

export const getChampions = withActionContext('getChampions', async (): Promise<AdminChampionData[]> => {
  await ensureAdmin("MANAGE_CHAMPIONS")
  const champions = await prisma.champion.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
      class: true,
      images: true,
      releaseDate: true,
      obtainable: true,
      fullAbilities: true,
      attacks: {
        include: {
            hits: true
        }
      },
      _count: {
        select: { abilities: true }
      },
      abilities: {
        include: {
            ability: true,
            synergyChampions: {
                include: {
                    champion: {
                        select: {
                            id: true,
                            name: true,
                            images: true
                        }
                    }
                }
            }
        }
    }
    },
    orderBy: {
      name: 'asc'
    }
  })
  
  return champions.map(c => ({
      ...c,
      images: c.images as unknown as ChampionImages,
      abilities: c.abilities.map(a => ({
          ...a,
          synergyChampions: a.synergyChampions.map(s => ({
              ...s,
              champion: {
                  ...s.champion,
                  images: s.champion.images as unknown as ChampionImages
              }
          }))
      }))
  }))
});

export const getAbilities = withActionContext('getAbilities', async () => {
  await ensureAdmin("MANAGE_CHAMPIONS")
  return await prisma.ability.findMany({
    orderBy: { name: 'asc' }
  })
});

export const updateChampionDetails = withActionContext('updateChampionDetails', async (
    id: number,
    data: {
        name: string
        shortName: string
        class: string
        releaseDate: Date
        obtainable: string[]
    }
) => {
    await ensureAdmin("MANAGE_CHAMPIONS")

    if (!Object.values(ChampionClass).includes(data.class as ChampionClass)) {
        throw new Error(`Invalid champion class: ${data.class}`)
    }
    const championClassValue = data.class as ChampionClass

    await prisma.champion.update({
        where: { id },
        data: {
            name: data.name,
            shortName: data.shortName,
            class: championClassValue,
            releaseDate: data.releaseDate,
            obtainable: data.obtainable
        }
    })
    revalidatePath('/admin/champions')
});

export const updateChampionFullAbilities = withActionContext('updateChampionFullAbilities', async (id: number, fullAbilities: FullAbilitiesInput | undefined) => {
    await ensureAdmin("MANAGE_CHAMPIONS")

    if (fullAbilities) {
        const jsonString = JSON.stringify(fullAbilities);
        const MAX_JSON_SIZE = 50 * 1024; // 50KB max length
        if (jsonString.length > MAX_JSON_SIZE) {
            throw new Error(`JSON payload too large. Max allowed is ${MAX_JSON_SIZE / 1024}KB.`);
        }

        if (typeof fullAbilities !== 'object' || Array.isArray(fullAbilities)) {
            throw new Error("Root of fullAbilities must be an object.");
        }
        if (fullAbilities.signature && (typeof fullAbilities.signature !== 'object' || Array.isArray(fullAbilities.signature) || typeof (fullAbilities.signature as Record<string, unknown>).name !== 'string')) {
            throw new Error("Invalid signature format: must be an object with a 'name' string.");
        }
        if (fullAbilities.abilities_breakdown) {
            if (!Array.isArray(fullAbilities.abilities_breakdown)) {
                throw new Error("abilities_breakdown must be an array.");
            }
            
            for (let i = 0; i < fullAbilities.abilities_breakdown.length; i++) {
                const item = fullAbilities.abilities_breakdown[i];
                if (typeof item !== 'object' || Array.isArray(item) || item === null) {
                    throw new Error(`abilities_breakdown item at index ${i} must be an object.`);
                }
                if (item.title !== undefined && typeof item.title !== 'string') {
                    throw new Error(`abilities_breakdown item at index ${i} must have a string 'title' if provided.`);
                }
                if (item.description !== undefined && typeof item.description !== 'string') {
                    throw new Error(`abilities_breakdown item at index ${i} must have a string 'description' if provided.`);
                }
            }
        }
    }

    await prisma.champion.update({
        where: { id },
        data: { fullAbilities: fullAbilities as Prisma.InputJsonValue }
    })
    revalidatePath('/admin/champions')
});

export const updateChampionAbility = withActionContext('updateChampionAbility', async (
    linkId: number | undefined,
    championId: number,
    abilityId: number,
    type: AbilityLinkType,
    source?: string
) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    if (linkId !== undefined) {
        await prisma.championAbilityLink.update({
            where: { id: linkId },
            data: {
                type,
                source
            }
        })
    } else {
        // Check if a link already exists with these unique fields to avoid constraint error
        const existing = await prisma.championAbilityLink.findFirst({
            where: {
                championId,
                abilityId,
                type,
                source: source || null
            }
        })

        if (!existing) {
            await prisma.championAbilityLink.create({
                data: {
                    championId,
                    abilityId,
                    type,
                    source
                }
            })
        }
    }
    revalidatePath('/admin/champions')
});

export const removeChampionAbility = withActionContext('removeChampionAbility', async (linkId: number) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.championAbilityLink.delete({
        where: { id: linkId }
    })
    revalidatePath('/admin/champions')
});

export const addSynergy = withActionContext('addSynergy', async (linkId: number, championId: number) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    
    // Use upsert to avoid unique constraint error if it already exists
    await prisma.championAbilitySynergy.upsert({
        where: {
            championAbilityLinkId_championId: {
                championAbilityLinkId: linkId,
                championId
            }
        },
        create: {
            championAbilityLinkId: linkId,
            championId
        },
        update: {} // Do nothing if already exists
    })
    revalidatePath('/admin/champions')
});

export const removeSynergy = withActionContext('removeSynergy', async (linkId: number, championId: number) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.championAbilitySynergy.deleteMany({
        where: {
            championAbilityLinkId: linkId,
            championId
        }
    })
    revalidatePath('/admin/champions')
});

export const saveChampionAttacks = withActionContext('saveChampionAttacks', async (
    championId: number,
    attackType: AttackType,
    hits: { properties: string[] }[]
) => {
    await ensureAdmin("MANAGE_CHAMPIONS")

    // Input Validation Limits
    const MAX_HITS = 100;
    const MAX_PROPS_PER_HIT = 20;
    const MAX_PROP_LENGTH = 50;

    if (!Array.isArray(hits)) {
        throw new Error("Invalid input: hits must be an array");
    }

    if (hits.length > MAX_HITS) {
        throw new Error(`Too many hits. Max allowed is ${MAX_HITS}.`);
    }

    for (const hit of hits) {
        if (!Array.isArray(hit.properties)) {
            throw new Error("Invalid input: hit properties must be an array");
        }
        if (hit.properties.length > MAX_PROPS_PER_HIT) {
            throw new Error(`Too many properties on a single hit. Max allowed is ${MAX_PROPS_PER_HIT}.`);
        }
        for (const prop of hit.properties) {
            if (typeof prop !== 'string' || prop.length > MAX_PROP_LENGTH) {
                throw new Error(`Invalid property value. Must be string under ${MAX_PROP_LENGTH} chars.`);
            }
        }
    }

    await prisma.$transaction(async (tx) => {
        // 1. Upsert the Attack record
        const attack = await tx.attack.upsert({
            where: {
                championId_type: {
                    championId,
                    type: attackType
                }
            },
            create: {
                championId,
                type: attackType
            },
            update: {}
        });

        // 2. Delete existing hits
        await tx.hit.deleteMany({
            where: { attackId: attack.id }
        });

        // 3. Create new hits
        if (hits.length > 0) {
            await tx.hit.createMany({
                data: hits.map(h => ({
                    attackId: attack.id,
                    properties: h.properties
                }))
            });
        }
    });
    
    revalidatePath('/admin/champions');
});

export const fetchDraftModels = withActionContext('fetchDraftModels', async (): Promise<ModelOption[]> => {
    await ensureAdmin("MANAGE_CHAMPIONS")

    if (_modelCache && Date.now() < _modelCache.expiresAt) {
        return _modelCache.data
    }

    const apiKey = process.env.OPEN_ROUTER_API_KEY
    if (!apiKey) throw new Error("OpenRouter API Key not configured.")

    const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 600 },
    })
    if (!res.ok) throw new Error(`Failed to fetch models from OpenRouter: ${res.status}`)

    const { data } = await res.json() as { data: Array<{ id: string; name: string }> }

    const filtered = data
        .filter(m => DRAFT_MODEL_PROVIDERS.some(p => m.id.startsWith(p)))
        .filter(m => !m.id.includes(':'))   // drop :free / :nitro / :extended variants
        .map(m => ({ id: m.id, name: m.name }))
        .sort((a, b) => a.id.localeCompare(b.id))

    _modelCache = { data: filtered, expiresAt: Date.now() + 10 * 60 * 1000 }
    return filtered
});

export const draftChampionAbilities = withActionContext('draftChampionAbilities', async (
    championId: number,
    model: string = "google/gemini-2.5-pro"
): Promise<{ draft: AbilityDraft; initialUserPrompt: string }> => {
    await ensureAdmin("MANAGE_CHAMPIONS")

    const champion = await prisma.champion.findUnique({ where: { id: championId } })
    if (!champion || !champion.fullAbilities) {
        throw new Error("Champion not found or has no Descriptions (fullAbilities) set.")
    }

    const apiKey = process.env.OPEN_ROUTER_API_KEY
    if (!apiKey) throw new Error("OpenRouter API Key not configured on the server.")

    const openRouter = new OpenRouterService(apiKey)
    const userPrompt = `Champion Name: ${champion.name}\n"full_abilities" JSON:\n\`\`\`json\n${JSON.stringify(champion.fullAbilities, null, 2)}\n\`\`\`\n\n**Generate ONLY the JSON object for this new champion, strictly following all rules and examples provided.**`

    const response = await openRouter.chat({
        model,
        messages: [
            { role: "system", content: abilityDraftPrompt },
            { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
    })

    const draft = JSON.parse(response.choices[0].message.content) as AbilityDraft
    return { draft, initialUserPrompt: userPrompt }
});

export const redraftChampionAbilities = withActionContext('redraftChampionAbilities', async (
    initialUserPrompt: string,
    originalDraft: AbilityDraft,
    suggestions: string,
    model: string = "google/gemini-2.5-pro"
): Promise<AbilityDraft> => {
    await ensureAdmin("MANAGE_CHAMPIONS")

    const apiKey = process.env.OPEN_ROUTER_API_KEY
    if (!apiKey) throw new Error("OpenRouter API Key not configured on the server.")

    const openRouter = new OpenRouterService(apiKey)
    const response = await openRouter.chat({
        model,
        messages: [
            { role: "system", content: abilityDraftPrompt },
            { role: "user", content: initialUserPrompt },
            { role: "assistant", content: JSON.stringify(originalDraft, null, 2) },
            { role: "user", content: `User Suggestions: "${suggestions}"\n\nPlease apply these suggestions and return the complete, updated JSON object. Remember to strictly follow all the rules. Generate ONLY the updated JSON object.` },
        ],
        response_format: { type: "json_object" },
    })

    return JSON.parse(response.choices[0].message.content) as AbilityDraft
});

export type SyncTagsResult = { updated: number; skipped: string[]; deletedTags: number }

export const syncTagsFromGameData = withActionContext('syncTagsFromGameData', async (
  formData: FormData
): Promise<SyncTagsResult> => {
  await ensureAdmin("MANAGE_CHAMPIONS")

  const championsFile = formData.get("champion_display") as File | null
  const tagsFile = formData.get("tags") as File | null

  if (!championsFile || !tagsFile) throw new Error("Both files are required")

  interface TagEntry { name: string; category_name: string }
  interface ChampionEntry { full_name: string; champion_tags: string[] }

  const tagsData: { tags: Record<string, TagEntry> } = JSON.parse(await tagsFile.text())
  const champsData: Record<string, ChampionEntry> = JSON.parse(await championsFile.text())
  const tagMap = new Map(Object.entries(tagsData.tags))

  const dbChampions = await prisma.champion.findMany({ select: { id: true, name: true } })
  const dbByUpperName = new Map(dbChampions.map((c) => [c.name.toUpperCase(), c]))

  let updated = 0
  const skipped: string[] = []

  for (const champ of Object.values(champsData)) {
    const dbChamp = dbByUpperName.get(champ.full_name.toUpperCase())
    if (!dbChamp) { skipped.push(champ.full_name); continue }

    await prisma.$transaction(async (tx) => {
      const tagConnections: { id: number }[] = []
      for (const tagId of champ.champion_tags) {
        const entry = tagMap.get(tagId)
        if (!entry) continue
        const name = entry.name.replace(/\[[^\]]*\]/g, "").trim()
        const tag = await tx.tag.upsert({
          where: { name_category: { name, category: entry.category_name } },
          update: {},
          create: { name, category: entry.category_name },
        })
        tagConnections.push({ id: tag.id })
      }
      await tx.champion.update({
        where: { id: dbChamp.id },
        data: { tags: { set: tagConnections } },
      })
    })

    updated++
  }

  const { count: deletedTags } = await prisma.tag.deleteMany({
    where: { champions: { none: {} } },
  })

  revalidatePath('/admin/champions')
  return { updated, skipped, deletedTags }
})

export const confirmAbilityDraft = withActionContext('confirmAbilityDraft', async (
    championId: number,
    draft: AbilityDraft
) => {
    await ensureAdmin("MANAGE_CHAMPIONS")

    const abilities = (draft.abilities ?? []).map(a => ({ ...a, type: 'ABILITY' as const }))
    const immunities = (draft.immunities ?? []).map(i => ({ ...i, type: 'IMMUNITY' as const }))

    for (const link of [...abilities, ...immunities]) {
        const ability = await prisma.ability.upsert({
            where: { name: link.name },
            update: { name: link.name },
            create: { name: link.name, description: "" },
        })

        const normalizedSource = link.source || null

        const existing = await prisma.championAbilityLink.findFirst({
            where: { championId, abilityId: ability.id, type: link.type, source: normalizedSource }
        })

        if (!existing) {
            await prisma.championAbilityLink.create({
                data: { championId, abilityId: ability.id, type: link.type, source: normalizedSource }
            })
        }
    }

    revalidatePath('/admin/champions')
});
