export type QuestGateTagGroups = { label: string; negated: boolean }[][];

export const QUEST_TAG_GATE_WIDTH = 164;
export const QUEST_TAG_GATE_RADIUS = 112;
export const QUEST_TAG_GATE_PADDING = 96;

/** Display layout only; the source projection owns AND/OR and negation. */
export function questTagGateLayout(groups: QuestGateTagGroups) {
  const rows: { text: string; excluded: boolean; group: number; connector: boolean }[] = [];
  const bracketGroups = groups.length > 1 && groups.some(group => group.length > 1);
  for (const [groupIndex, group] of groups.entries()) {
    if (bracketGroups && groupIndex > 0) rows.push({ text: "or", excluded: false, group: -1, connector: true });
    for (const [termIndex, term] of group.entries()) {
      const prefix = termIndex > 0 ? "and " : groupIndex > 0 && !bracketGroups ? "or " : "";
      const text = `${prefix}${term.negated ? "not " : ""}#${term.label}`;
      const lines: string[] = [];
      for (const word of text.split(/\s+/)) {
        if (!lines.length || lines.at(-1)!.length + word.length + 1 > 23) lines.push(word);
        else lines[lines.length - 1] += ` ${word}`;
      }
      rows.push(...lines.map(text => ({ text, excluded: term.negated, group: groupIndex, connector: false })));
    }
  }
  return { width: QUEST_TAG_GATE_WIDTH, height: Math.max(58, 39 + rows.length * 16), rows, bracketGroups };
}
