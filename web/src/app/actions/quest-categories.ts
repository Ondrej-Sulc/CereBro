'use server'

import { requireBotAdmin } from "@/lib/auth-helpers";
import { deleteFromGcs, uploadToGcs } from "@/lib/gcs";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withActionContext } from "@/lib/with-request-context";
import { revalidatePath, revalidateTag } from "next/cache";

export { getQuestCategories } from "./quest-catalog";

function revalidateQuestCategories() {
    revalidateTag('quest-categories', 'default');
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
}

export const createQuestCategory = withActionContext('createQuestCategory', async (name: string, order: number = 0, parentId?: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    await prisma.questCategory.create({
        data: {
            name,
            order,
            parentId
        }
    });

    revalidateQuestCategories();
    return { success: true };
});

export const updateQuestCategory = withActionContext('updateQuestCategory', async (
    id: string,
    data: { name?: string; order?: number; thumbnailUrl?: string | null; parentId?: string | null }
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    if (data.parentId != null) {
        if (data.parentId === id) {
            throw new Error("A category cannot be its own parent.");
        }
        let currentParentId: string | null = data.parentId;
        while (currentParentId !== null) {
            const ancestor: { parentId: string | null } | null = await prisma.questCategory.findUnique({
                where: { id: currentParentId },
                select: { parentId: true }
            });
            if (!ancestor) break;
            if (ancestor.parentId === id) {
                throw new Error("Setting this parent would create a circular reference.");
            }
            currentParentId = ancestor.parentId;
        }
    }

    await prisma.questCategory.update({
        where: { id },
        data: {
            name: data.name,
            order: data.order,
            thumbnailUrl: data.thumbnailUrl,
            parentId: data.parentId,
        }
    });

    revalidateQuestCategories();
    return { success: true };
});

export const uploadQuestCategoryThumbnail = withActionContext('uploadQuestCategoryThumbnail', async (categoryId: string, formData: FormData) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const category = await prisma.questCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
        throw new Error("Category not found.");
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
        throw new Error("Invalid or missing file upload");
    }

    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Only PNG, JPEG, and WebP are allowed.");
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error("File is too large. Maximum size is 5MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const sanitizedName = file.name
        .normalize('NFC')
        .replace(/[^\w\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 80) || 'thumbnail';
    const fileName = `quest-category-thumbnails/${categoryId}-${Date.now()}-${sanitizedName}`;
    const publicUrl = await uploadToGcs(buffer, fileName, file.type);

    try {
        await prisma.questCategory.update({
            where: { id: categoryId },
            data: { thumbnailUrl: publicUrl }
        });
    } catch (error) {
        logger.error({ err: error, categoryId, fileName }, "Failed to update quest category thumbnail URL, deleting GCS object");
        try {
            await deleteFromGcs(fileName);
        } catch (delErr) {
            logger.error({ err: delErr, fileName }, "Failed to delete GCS object during quest category thumbnail cleanup");
        }
        throw error;
    }

    if (category.thumbnailUrl && category.thumbnailUrl !== publicUrl) {
        try {
            const gcsBase = 'https://storage.googleapis.com/';
            const withoutBase = category.thumbnailUrl.slice(gcsBase.length);
            const slashIdx = withoutBase.indexOf('/');
            if (slashIdx !== -1) {
                const oldPath = withoutBase.slice(slashIdx + 1).split('/').map(decodeURIComponent).join('/');
                await deleteFromGcs(oldPath);
            }
        } catch (delErr) {
            logger.error({ err: delErr, categoryId, thumbnailUrl: category.thumbnailUrl }, "Failed to delete old quest category thumbnail from GCS");
        }
    }

    revalidateQuestCategories();
    return { success: true, url: publicUrl };
});
