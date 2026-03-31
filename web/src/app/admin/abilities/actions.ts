"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAdmin } from "../actions"
import { withActionContext } from "@/lib/with-request-context"

export const getAbilityCategories = withActionContext('getAbilityCategories', async () => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    return await prisma.abilityCategory.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { abilities: true } } }
    })
});

export const createAbilityCategory = withActionContext('createAbilityCategory', async (name: string, description: string) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.abilityCategory.create({
        data: { name, description }
    })
    revalidatePath("/admin/abilities")
});

export const updateAbilityCategory = withActionContext('updateAbilityCategory', async (id: number, name: string, description: string) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.abilityCategory.update({
        where: { id },
        data: { name, description }
    })
    revalidatePath("/admin/abilities")
});

export const deleteAbilityCategory = withActionContext('deleteAbilityCategory', async (id: number) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.abilityCategory.delete({
        where: { id }
    })
    revalidatePath("/admin/abilities")
});

export const getAbilities = withActionContext('getAbilities', async () => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    return await prisma.ability.findMany({
        orderBy: { name: 'asc' },
        include: {
            categories: {
                select: { id: true, name: true }
            },
            _count: { select: { champions: true } }
        }
    })
});

export const createAbility = withActionContext('createAbility', async (name: string, description: string | null, emoji: string | null, categoryIds: number[]) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.ability.create({
        data: {
            name,
            description,
            emoji,
            categories: {
                connect: categoryIds.map(id => ({ id }))
            }
        }
    })
    revalidatePath("/admin/abilities")
});

export const updateAbility = withActionContext('updateAbility', async (id: number, name: string, description: string | null, emoji: string | null, categoryIds: number[]) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.ability.update({
        where: { id },
        data: {
            name,
            description,
            emoji,
            categories: {
                set: categoryIds.map(categoryId => ({ id: categoryId }))
            }
        }
    })
    revalidatePath("/admin/abilities")
});

export const deleteAbility = withActionContext('deleteAbility', async (id: number) => {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.ability.delete({
        where: { id }
    })
    revalidatePath("/admin/abilities")
});
