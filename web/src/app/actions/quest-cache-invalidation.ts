import { revalidatePath, revalidateTag } from "next/cache";

export function revalidateQuestCategories() {
    revalidateTag('quest-categories', 'default');
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
}

export function revalidateQuestPlanList() {
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
}

export function revalidateQuestPlanDetail(questPlanId: string) {
    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
}

export function revalidateQuestPlanDetailData() {
    revalidateTag('quest-plan-detail', 'default');
}

export function revalidateQuestFeaturedPicks(questPlanId: string) {
    revalidateTag(`quest-featured-picks-${questPlanId}`, 'default');
}
