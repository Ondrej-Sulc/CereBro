/** Catalog sections show each source option once, independent of how many
 * sockets accept it. This is a reference view, not an equipped loadout.
 */
export function relicRuneSections<T extends { id: string }>(
  relic: {
    type: "battlecast" | "statcast";
    slots: readonly { type: string; socketItemIds: readonly string[] }[];
  },
  items: Readonly<Record<string, T>>,
): { abilities: T[]; attributes: T[] } {
  const groups: { abilities: T[]; attributes: T[] } = {
    abilities: [],
    attributes: [],
  };
  const seen = new Set<string>();
  for (const slot of relic.slots) {
    const group =
      relic.type === "statcast" || slot.type === "attribute"
        ? groups.attributes
        : groups.abilities;
    for (const id of slot.socketItemIds) {
      if (seen.has(id)) continue;
      const item = items[id];
      if (!item) throw new Error(`Missing relic rune ${id}`);
      seen.add(id);
      group.push(item);
    }
  }
  return groups;
}
