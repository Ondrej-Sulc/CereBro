"use server"

import { prisma } from "@/lib/prisma"
import { ChampionAbilityLink, AbilityLinkType, AttackType, ChampionClass } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { ensureAdmin } from "../actions"

import { AdminChampionData } from "./champion-card"
import { ChampionImages } from "@/types/champion"

export async function getChampions(): Promise<AdminChampionData[]> {
  await ensureAdmin()
  const champions = await prisma.champion.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
      class: true,
      images: true,
      releaseDate: true,
      obtainable: true,
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
}

export async function getAbilities() {
  await ensureAdmin()
  return await prisma.ability.findMany({
    orderBy: { name: 'asc' }
  })
}

export async function updateChampionDetails(
    id: number,
    data: {
        name: string
        shortName: string
        class: string
        releaseDate: Date
        obtainable: string[]
    }
) {
    await ensureAdmin()

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
}

export async function updateChampionAbility(
    linkId: number | undefined, 
    championId: number, 
    abilityId: number, 
    type: AbilityLinkType, 
    source?: string
) {
    await ensureAdmin()
    if (linkId !== undefined) {
        await prisma.championAbilityLink.update({
            where: { id: linkId },
            data: {
                type,
                source
            }
        })
    } else {
        await prisma.championAbilityLink.create({
            data: {
                championId,
                abilityId,
                type,
                source
            }
        })
    }
    revalidatePath('/admin/champions')
}

export async function removeChampionAbility(linkId: number) {
    await ensureAdmin()
    await prisma.championAbilityLink.delete({
        where: { id: linkId }
    })
    revalidatePath('/admin/champions')
}

export async function addSynergy(linkId: number, championId: number) {
    await ensureAdmin()
    await prisma.championAbilitySynergy.create({
        data: {
            championAbilityLinkId: linkId,
            championId
        }
    })
    revalidatePath('/admin/champions')
}

export async function removeSynergy(linkId: number, championId: number) {
    await ensureAdmin()
    await prisma.championAbilitySynergy.deleteMany({
        where: {
            championAbilityLinkId: linkId,
            championId
        }
    })
    revalidatePath('/admin/champions')
}

export async function saveChampionAttacks(
    championId: number, 
    attackType: AttackType, 
    hits: { properties: string[] }[]
) {
    await ensureAdmin()

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
}
