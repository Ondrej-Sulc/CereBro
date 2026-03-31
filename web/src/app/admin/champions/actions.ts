"use server"

import { prisma } from "@/lib/prisma"
import { ChampionAbilityLink, AbilityLinkType, AttackType, ChampionClass, Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { ensureAdmin } from "../actions"

import { AdminChampionData } from "./champion-card"
import { ChampionImages } from "@/types/champion"
import { withActionContext } from "@/lib/with-request-context"

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
