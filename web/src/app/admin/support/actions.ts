"use server";

import { revalidatePath } from "next/cache";
import { setMonthlyTargetEur } from "@/lib/support-config";
import { ensureAdmin } from "../actions";
import { withActionContext } from "@/lib/with-request-context";

export const updateMonthlyCostAction = withActionContext('updateMonthlyCostAction', async (formData: FormData): Promise<void> => {
  await ensureAdmin("MANAGE_SYSTEM");

  const raw = formData.get("monthly_cost_eur");
  const value = Number(raw);

  if (!Number.isFinite(value) || value <= 0 || value > 10000) {
    return;
  }

  await setMonthlyTargetEur(value);
  revalidatePath("/admin/support");
  revalidatePath("/support");
});
