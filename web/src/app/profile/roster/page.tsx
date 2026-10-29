import { redirect } from "next/navigation";

// Existing personal links stay explicit; the menu now opens /champions.
export default async function LegacyRosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      params.append(key, item);
  }
  params.set("view", "personal");
  redirect(`/champions?${params}`);
}
