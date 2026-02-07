"use server"

import { prisma } from "@/lib/prisma"
import { ChampionAbilityLink, AbilityLinkType, AttackType } from "@prisma/client"
import { revalidatePath } from "next/cache"

export async function getChampions() {
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
  return champions
}

export async function getAbilities() {
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
    await prisma.champion.update({
        where: { id },
        data: {
            name: data.name,
            shortName: data.shortName,
            class: data.class as any,
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
    if (linkId) {
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
    await prisma.championAbilityLink.delete({
        where: { id: linkId }
    })
    revalidatePath('/admin/champions')
}

export async function addSynergy(linkId: number, championId: number) {
    await prisma.championAbilitySynergy.create({
        data: {
            championAbilityLinkId: linkId,
            championId
        }
    })
    revalidatePath('/admin/champions')
}

export async function removeSynergy(linkId: number, championId: number) {
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
