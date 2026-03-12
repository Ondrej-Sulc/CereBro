"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ensureAdmin } from "../actions"

export async function getAbilityCategories() {
    await ensureAdmin("MANAGE_CHAMPIONS")
    return await prisma.abilityCategory.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { abilities: true } } }
    })
}

export async function createAbilityCategory(name: string, description: string) {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.abilityCategory.create({
        data: { name, description }
    })
    revalidatePath("/admin/abilities")
}

export async function updateAbilityCategory(id: number, name: string, description: string) {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.abilityCategory.update({
        where: { id },
        data: { name, description }
    })
    revalidatePath("/admin/abilities")
}

export async function deleteAbilityCategory(id: number) {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.abilityCategory.delete({
        where: { id }
    })
    revalidatePath("/admin/abilities")
}

export async function getAbilities() {
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
}

export async function createAbility(name: string, description: string | null, emoji: string | null, categoryIds: number[]) {
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
}

export async function updateAbility(id: number, name: string, description: string | null, emoji: string | null, categoryIds: number[]) {
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
}

export async function deleteAbility(id: number) {
    await ensureAdmin("MANAGE_CHAMPIONS")
    await prisma.ability.delete({
        where: { id }
    })
    revalidatePath("/admin/abilities")
}
