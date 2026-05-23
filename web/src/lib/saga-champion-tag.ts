export function isSagaChampionTag(tag: { name: string; category?: string | null }) {
  return normalizeTagText(tag.name) === "saga champions" || normalizeTagText(tag.category) === "saga";
}

function normalizeTagText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^#/, "").toLowerCase();
}
