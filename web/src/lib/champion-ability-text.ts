import type {
  ChampionAbilityTextTemplate,
  ChampionAbilityTextTemplateNode,
  ChampionAbilityTextTemplateValueSource,
} from "@cerebro/core/domain/champion-ability-text/types";

export type TemplateNode = ChampionAbilityTextTemplateNode;
export type TemplateValueSource = ChampionAbilityTextTemplateValueSource;
export type TextTemplate = ChampionAbilityTextTemplate;

export type ChampionAbilityCurve = {
  id: number;
  curveId: string;
  kind: string;
  formula: string;
  params: unknown;
  minSig: number | null;
  maxSig: number | null;
};

export type ChampionAbilityStat = {
  challengeRating: number;
  attack: number | null;
  health?: number | null;
  sigAbilityIds: string[];
};

export type ResolvedAbilityTextValue =
  | {
    status: "resolved";
    value: number;
    displayValue: string;
    curve: ChampionAbilityCurve | null;
    detail: string;
  }
  | {
    status: "error";
    error: ChampionAbilityTextError;
    curve: ChampionAbilityCurve | null;
    detail: string;
  };

export type ChampionAbilityTextError = {
  code: "UNRESOLVED_PLACEHOLDER" | "EXPLICIT_CURVE_NOT_FOUND" | "MALFORMED_TEMPLATE";
  message: string;
  placeholderIndex?: number;
};

export type PreparedChampionAbilityTextNode =
  | { type: "text"; value: string }
  | { type: "value"; key: string; placeholderIndex: number; source?: TemplateValueSource; resolution: ResolvedAbilityTextValue }
  | { type: "glossary"; id: string; label: string }
  | { type: "color"; color: string; children: PreparedChampionAbilityTextNode[] };

export type PreparedChampionAbilityTextBlock = {
  type: "paragraph";
  children: PreparedChampionAbilityTextNode[];
};

export type PreparedChampionAbilityText =
  | { status: "ready"; blocks: PreparedChampionAbilityTextBlock[] }
  | { status: "error"; error: ChampionAbilityTextError };

export type PreparedChampionAbilityCurveSeries = {
  id: number;
  dataKey: string;
  label: string;
  curve: ChampionAbilityCurve;
};

export type PreparedChampionAbilityCurveView = {
  data: Array<Record<string, number>>;
  domain: [number, number];
  series: PreparedChampionAbilityCurveSeries[];
};

export type ChampionAbilityTextRecord = {
  id: number | string;
  group: string;
  title: string | null;
  sortOrder?: number;
  template: unknown;
};

export type PreparedChampionAbilityTextRecord<
  TRecord extends ChampionAbilityTextRecord = ChampionAbilityTextRecord,
> = TRecord & {
  displayTitle: string | null;
  prepared: PreparedChampionAbilityText;
};

export type PreparedChampionAbilityTextRecordGroup<
  TRecord extends ChampionAbilityTextRecord = ChampionAbilityTextRecord,
> = {
  id: string;
  title: string;
  records: Array<PreparedChampionAbilityTextRecord<TRecord>>;
};

export type PreparedChampionAbilityTextPanel<
  TRecord extends ChampionAbilityTextRecord = ChampionAbilityTextRecord,
> = {
  group: string;
  title: string;
  records: Array<PreparedChampionAbilityTextRecord<TRecord>>;
  recordGroups: Array<PreparedChampionAbilityTextRecordGroup<TRecord>>;
  introRecord?: PreparedChampionAbilityTextRecord<TRecord>;
  emptyText: string;
};

export type PreparedChampionAbilityTextView<
  TRecord extends ChampionAbilityTextRecord = ChampionAbilityTextRecord,
> = {
  glossaryIds: string[];
  selectedCurves: ChampionAbilityCurve[];
  curveView: PreparedChampionAbilityCurveView;
  bioRecords: Array<PreparedChampionAbilityTextRecord<TRecord>>;
  signaturePanel: PreparedChampionAbilityTextPanel<TRecord>;
  descriptionPanels: Array<PreparedChampionAbilityTextPanel<TRecord>>;
};

export function validateChampionAbilityTextTemplate(template: unknown): TextTemplate {
  if (!isRecord(template)) {
    throw new Error("Champion Ability Text template must be an object.");
  }

  if (typeof template.raw !== "string") {
    throw new Error("Champion Ability Text template.raw must be a string.");
  }

  if (template.blocks === undefined) {
    return { raw: template.raw };
  }

  if (!Array.isArray(template.blocks)) {
    throw new Error("Champion Ability Text template.blocks must be an array.");
  }

  return {
    raw: template.raw,
    blocks: template.blocks.map((block, blockIndex) => {
      if (!isRecord(block) || block.type !== "paragraph" || !Array.isArray(block.children)) {
        throw new Error(`Champion Ability Text block ${blockIndex} must be a paragraph with children.`);
      }
      return {
        type: "paragraph" as const,
        children: block.children.map((node, nodeIndex) => validateTemplateNode(node, `blocks[${blockIndex}].children[${nodeIndex}]`)),
      };
    }),
  };
}

export function normalizeChampionAbilityTextTemplate(template: TextTemplate) {
  const blocks = template.blocks?.length
    ? template.blocks
    : [{ type: "paragraph" as const, children: [{ type: "text" as const, value: template.raw }] }];
  return blocks.map(block => ({ ...block, children: addValueHints(block.children) }));
}

export function groupAbilityTexts<T extends { group: string }>(records: T[]) {
  return records.reduce<Record<string, T[]>>((groups, record) => {
    groups[record.group] ??= [];
    groups[record.group].push(record);
    return groups;
  }, {});
}

export function collectChampionAbilityTextGlossaryIds(records: Array<{ template: unknown }>): string[] {
  const ids = new Set<string>();
  for (const record of records) {
    collectGlossaryIdsFromTemplate(record.template, ids);
  }
  return Array.from(ids).sort();
}

export function prepareChampionAbilityTextView<
  TRecord extends ChampionAbilityTextRecord,
>({
  records,
  curves = [],
  maxSig = 200,
  sigLevel = 200,
  stat,
}: {
  records: TRecord[];
  curves?: ChampionAbilityCurve[];
  maxSig?: number;
  sigLevel?: number;
  stat?: ChampionAbilityStat;
}): PreparedChampionAbilityTextView<TRecord> {
  const selectedCurves = curves.filter(curve => (curve.maxSig ?? 200) === maxSig);
  const preparedRecords = records.map(record => ({
    ...record,
    displayTitle: record.title ? formatGameText(record.title) : null,
    prepared: prepareChampionAbilityText({
      template: record.template,
      curves: selectedCurves,
      sigLevel,
      stat,
    }),
  }));

  const textGroups = groupAbilityTexts(preparedRecords);
  const bioRecords = textGroups.bio ?? [];
  const signatureRecords = textGroups.signature ?? [];
  const specialAttackTextByNumber = new Map<string, PreparedChampionAbilityTextRecord<TRecord>>();

  for (const [index, record] of (textGroups.special ?? []).entries()) {
    specialAttackTextByNumber.set(String(index + 1), record);
  }

  const descriptionPanels = Object.entries(textGroups)
    .filter(([group]) => group !== "signature" && group !== "bio" && group !== "special")
    .map(([group, groupRecords]) => {
      const specialMatch = group.match(/^special([123])$/);
      const introRecord = specialMatch ? specialAttackTextByNumber.get(specialMatch[1]) : undefined;
      const title = introRecord?.displayTitle
        ? `${abilityTextGroupTitle(group)} - ${introRecord.displayTitle}`
        : abilityTextGroupTitle(group);

      return createAbilityTextPanel({
        group,
        title,
        records: groupRecords,
        introRecord,
      });
    });

  return {
    glossaryIds: collectChampionAbilityTextGlossaryIds(records),
    selectedCurves,
    curveView: prepareChampionAbilityCurveView({ curves: selectedCurves, stat, sigLevel }),
    bioRecords,
    signaturePanel: createAbilityTextPanel({
      group: "signature",
      title: "Signature Ability",
      records: signatureRecords,
      emptyText: "No signature ability text imported.",
    }),
    descriptionPanels,
  };
}

export function abilityTextGroupTitle(group: string) {
  if (group === "base") return "Base Abilities";
  if (group === "special") return "Special Attacks";
  const specialMatch = group.match(/^special([123])$/);
  if (specialMatch) return `Special Attack ${specialMatch[1]}`;
  return group
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatGameText(value: string) {
  let formatted = value;
  let previous: string;
  do {
    previous = formatted;
    formatted = formatted
      .replace(/\[\/?b\]/gi, "")
      .replace(/\[k=glossary\/([^\]]*)\]([\s\S]*?)\[\/k\]/g, "$2")
      .replace(/\[[0-9a-fA-F]{6,8}\]([\s\S]*?)\[-\]/g, "$1");
  } while (formatted !== previous);
  return formatted
    .replace(/\[k=glossary\/[^\]]*\]/g, "")
    .replace(/\[\/k\]/g, "")
    .replace(/\[[0-9a-fA-F]{6,8}\]/g, "")
    .replace(/\[-\]/g, "");
}

export function prepareChampionAbilityText({
  template,
  curves = [],
  sigLevel = 200,
  stat,
}: {
  template: unknown;
  curves?: ChampionAbilityCurve[];
  sigLevel?: number;
  stat?: ChampionAbilityStat;
}): PreparedChampionAbilityText {
  let blocks: ReturnType<typeof normalizeChampionAbilityTextTemplate>;

  try {
    blocks = normalizeChampionAbilityTextTemplate(validateChampionAbilityTextTemplate(template));
  } catch (error) {
    return {
      status: "error",
      error: {
        code: "MALFORMED_TEMPLATE",
        message: error instanceof Error ? error.message : "Champion Ability Text template is malformed.",
      },
    };
  }

  return {
    status: "ready",
    blocks: blocks.map(block => ({
      type: block.type,
      children: block.children.map(node => prepareChampionAbilityTextNode(node, curves, sigLevel, stat)),
    })),
  };
}

export function resolveChampionAbilityTextValue({
  node,
  curves,
  sigLevel,
  stat,
}: {
  node: Extract<TemplateNode, { type: "value" }>;
  curves: ChampionAbilityCurve[];
  sigLevel: number;
  stat?: ChampionAbilityStat;
}): ResolvedAbilityTextValue {
  const curve = findCurveForValueNode(node, curves, stat);
  const value = resolveTemplateValue(node, curve, sigLevel, stat);

  if (value != null) {
    return {
      status: "resolved",
      value,
      displayValue: formatAbilityTextValue(value, curve, node),
      curve,
      detail: curve ? `Resolved at Sig ${sigLevel}.` : "Resolved from game component data.",
    };
  }

  const explicitCurveId = node.source?.kind === "abilityParam" && node.source.curveId && node.source.curveId !== "none"
    ? node.source.curveId
    : null;

  return {
    status: "error",
    curve,
    detail: explicitCurveId
      ? `Explicit curve ${explicitCurveId} could not be matched.`
      : "Runtime placeholder was not resolved.",
    error: {
      code: explicitCurveId ? "EXPLICIT_CURVE_NOT_FOUND" : "UNRESOLVED_PLACEHOLDER",
      message: explicitCurveId
        ? `Explicit curve ${explicitCurveId} could not be matched.`
        : `Placeholder ${node.placeholderIndex} could not be resolved.`,
      placeholderIndex: node.placeholderIndex,
    },
  };
}

export function buildMultiCurveData(curves: ChampionAbilityCurve[], stat?: ChampionAbilityStat, sigLevel?: number) {
  if (!curves.length) return [];
  const minSig = Math.max(1, Math.min(...curves.map(curve => curve.minSig ?? 1)));
  const maxSig = Math.max(...curves.map(curve => curve.maxSig ?? 200));
  const step = Math.max(1, Math.ceil((maxSig - minSig) / 80));
  const data: Array<Record<string, number>> = [];

  for (let sig = minSig; sig <= maxSig; sig += step) {
    data.push(buildMultiCurvePoint(curves, sig, stat));
  }

  if (sigLevel !== undefined && sigLevel >= minSig && sigLevel <= maxSig) {
    if (!data.some(point => point.sig === sigLevel)) {
      data.push(buildMultiCurvePoint(curves, sigLevel, stat));
      data.sort((a, b) => a.sig - b.sig);
    }
  }

  if (data[data.length - 1]?.sig !== maxSig) {
    data.push(buildMultiCurvePoint(curves, maxSig, stat));
    data.sort((a, b) => a.sig - b.sig);
  }
  return data;
}

export function prepareChampionAbilityCurveView({
  curves,
  stat,
  sigLevel,
}: {
  curves: ChampionAbilityCurve[];
  stat?: ChampionAbilityStat;
  sigLevel?: number;
}): PreparedChampionAbilityCurveView {
  const data = buildMultiCurveData(curves, stat, sigLevel);
  const series = curves.map((curve, index) => ({
    id: curve.id,
    dataKey: `curve${index}`,
    label: curveLabel(curve),
    curve,
  }));

  return {
    data,
    domain: curveValueDomain(data, series.map(item => item.dataKey)),
    series,
  };
}

export function curveLabel(curve: ChampionAbilityCurve) {
  const params = curve.params as Record<string, unknown> | null;
  const source = params && isRecord(params.source) ? params.source : null;
  const ability = source && isRecord(source.ability) ? source.ability : null;
  const buffType = typeof ability?.buffType === "string" ? ability.buffType : "";
  if (buffType) {
    return buffType
      .split("_")
      .filter(Boolean)
      .map(part => part[0]?.toUpperCase() + part.slice(1))
      .join(" ");
  }
  return curve.curveId.split(":")[1] ?? curve.curveId;
}

function curveValueDomain(data: Array<Record<string, number>>, dataKeys: string[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;

  data.forEach(point => {
    dataKeys.forEach(key => {
      const value = point[key];
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      if (value < min) min = value;
      if (value > max) max = value;
    });
  });

  if (min === Infinity || max === -Infinity) return [0, 0];

  const range = max - min;
  const pad = range === 0 ? Math.max(Math.abs(max) * 0.1, 1) : range * 0.1;
  return [min - pad, max + pad];
}

function createAbilityTextPanel<
  TRecord extends ChampionAbilityTextRecord,
>({
  group,
  title,
  records,
  introRecord,
  emptyText = "No text imported.",
}: {
  group: string;
  title: string;
  records: Array<PreparedChampionAbilityTextRecord<TRecord>>;
  introRecord?: PreparedChampionAbilityTextRecord<TRecord>;
  emptyText?: string;
}): PreparedChampionAbilityTextPanel<TRecord> {
  const recordGroups: Array<PreparedChampionAbilityTextRecordGroup<TRecord>> = [];
  let currentGroup: PreparedChampionAbilityTextRecordGroup<TRecord> | null = null;
  let pendingTitle: { id: string; title: string } | null = null;
  const visibleRecords: Array<PreparedChampionAbilityTextRecord<TRecord>> = [];

  for (const record of records) {
    if (isGlossaryDefinitionRecord(record)) {
      if (record.displayTitle) pendingTitle = { id: String(record.id), title: record.displayTitle };
      continue;
    }

    visibleRecords.push(record);
    if (record.displayTitle) {
      currentGroup = {
        id: String(record.id),
        title: record.displayTitle,
        records: [record],
      };
      recordGroups.push(currentGroup);
      pendingTitle = null;
    } else if (pendingTitle) {
      currentGroup = {
        id: pendingTitle.id,
        title: pendingTitle.title,
        records: [record],
      };
      recordGroups.push(currentGroup);
      pendingTitle = null;
    } else if (currentGroup) {
      currentGroup.records.push(record);
    } else {
      currentGroup = {
        id: String(record.id),
        title: title === "Special Attacks" ? "Attack Details" : "Always Active",
        records: [record],
      };
      recordGroups.push(currentGroup);
    }
  }

  return {
    group,
    title,
    records: visibleRecords,
    recordGroups,
    introRecord,
    emptyText,
  };
}

function isGlossaryDefinitionRecord(record: ChampionAbilityTextRecord) {
  if (!record.title) return false;
  if (templateHasValueNode(record.template)) return false;

  let template: TextTemplate;
  try {
    template = validateChampionAbilityTextTemplate(record.template);
  } catch {
    return false;
  }
  const raw = formatGameText(template.raw).trim().toLowerCase();
  return [
    /^each .+ represents .+\.$/,
    /^this champion is immune to all .+ effects\.$/,
    /^incoming attacks have a .+ chance to miss\.$/,
    /^.+ is on cooldown and cannot be activated\.$/,
    /^inflicts energy damage over time, decreases block proficiency by half, and prevents perfect blocks\.$/,
    /^energy damage dealt instantly to the opponent\.$/,
    /^increases the ability power rate and combat power rate\.?$/,
  ].some(pattern => pattern.test(raw));
}

function templateHasValueNode(template: unknown): boolean {
  if (!template || typeof template !== "object") return false;
  if (Array.isArray(template)) return template.some(templateHasValueNode);
  const record = template as Record<string, unknown>;
  if (record.type === "value") return true;
  return Object.values(record).some(templateHasValueNode);
}

function collectGlossaryIdsFromTemplate(value: unknown, ids: Set<string>) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) collectGlossaryIdsFromTemplate(item, ids);
    return;
  }

  const record = value as Record<string, unknown>;
  if (record.type === "glossary" && typeof record.id === "string") {
    ids.add(record.id);
  }

  for (const item of Object.values(record)) {
    collectGlossaryIdsFromTemplate(item, ids);
  }
}

function prepareChampionAbilityTextNode(
  node: TemplateNode,
  curves: ChampionAbilityCurve[],
  sigLevel: number,
  stat?: ChampionAbilityStat
): PreparedChampionAbilityTextNode {
  if (node.type === "text") return { type: "text", value: formatGameText(node.value) };
  if (node.type === "glossary") return { type: "glossary", id: node.id, label: formatGameText(node.label) };
  if (node.type === "color") {
    return {
      type: "color",
      color: node.color,
      children: node.children.map(child => prepareChampionAbilityTextNode(child, curves, sigLevel, stat)),
    };
  }
  return {
    type: "value",
    key: node.key,
    placeholderIndex: node.placeholderIndex,
    source: node.source,
    resolution: resolveChampionAbilityTextValue({ node, curves, sigLevel, stat }),
  };
}

function validateTemplateNode(node: unknown, path: string): TemplateNode {
  if (!isRecord(node) || typeof node.type !== "string") {
    throw new Error(`Champion Ability Text ${path} must be a node.`);
  }

  if (node.type === "text") {
    if (typeof node.value !== "string") throw new Error(`Champion Ability Text ${path}.value must be a string.`);
    return { type: "text", value: node.value };
  }

  if (node.type === "value") {
    if (typeof node.key !== "string") throw new Error(`Champion Ability Text ${path}.key must be a string.`);
    if (typeof node.placeholderIndex !== "number") throw new Error(`Champion Ability Text ${path}.placeholderIndex must be a number.`);
    return {
      type: "value",
      key: node.key,
      placeholderIndex: node.placeholderIndex,
      source: validateTemplateValueSource(node.source, `${path}.source`),
    };
  }

  if (node.type === "glossary") {
    if (typeof node.id !== "string") throw new Error(`Champion Ability Text ${path}.id must be a string.`);
    if (typeof node.label !== "string") throw new Error(`Champion Ability Text ${path}.label must be a string.`);
    return { type: "glossary", id: node.id, label: node.label };
  }

  if (node.type === "color") {
    if (typeof node.color !== "string") throw new Error(`Champion Ability Text ${path}.color must be a string.`);
    if (!Array.isArray(node.children)) throw new Error(`Champion Ability Text ${path}.children must be an array.`);
    return {
      type: "color",
      color: node.color,
      children: node.children.map((child, index) => validateTemplateNode(child, `${path}.children[${index}]`)),
    };
  }

  throw new Error(`Champion Ability Text ${path}.type is not supported.`);
}

function addValueHints(nodes: TemplateNode[], inheritedHint = ""): TemplateNode[] {
  const siblingSources = nodes
    .filter((node): node is Extract<TemplateNode, { type: "value" }> => node.type === "value" && node.source?.kind === "abilityParam")
    .map(node => node.source as Extract<TemplateValueSource, { kind: "abilityParam" }>);

  return nodes.map((node, index) => {
    if (node.type === "value") {
      const localHint = surroundingText(nodes, index);
      return {
        ...node,
        hint: `${inheritedHint} ${localHint}`.replace(/\s+/g, " ").trim().toLowerCase(),
        source: inferMissingValueSource(node, siblingSources),
      };
    }
    if (node.type === "color") {
      const colorHint = surroundingText(nodes, index);
      const combinedHint = `${inheritedHint} ${colorHint}`.replace(/\s+/g, " ").trim().toLowerCase();
      return { ...node, children: addValueHints(node.children, combinedHint) };
    }
    return node;
  });
}

function surroundingText(nodes: TemplateNode[], index: number) {
  const before = collectAdjacentText(nodes, index - 1, -1);
  const after = collectAdjacentText(nodes, index + 1, 1);
  return `${before} ${after}`.replace(/\s+/g, " ").trim().toLowerCase();
}

function collectAdjacentText(nodes: TemplateNode[], start: number, direction: 1 | -1) {
  const parts: string[] = [];
  for (let index = start; index >= 0 && index < nodes.length; index += direction) {
    const text = nodeText(nodes[index]);
    if (!text) break;
    if (direction === -1) parts.unshift(text);
    else parts.push(text);
  }
  return parts.join(" ");
}

function nodeText(node: TemplateNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value;
  if (node.type === "color") return node.children.map(nodeText).join("");
  return "";
}

function inferMissingValueSource(
  node: Extract<TemplateNode, { type: "value" }>,
  siblingSources: Array<Extract<TemplateValueSource, { kind: "abilityParam" }>>
) {
  if (node.source?.kind !== "placeholder") return node.source;
  const inferredField = fieldForPlaceholderIndex(node.placeholderIndex);
  if (!inferredField) return node.source;
  const source = siblingSources.find(candidate => readSourceNumber(candidate, inferredField) != null);
  if (!source) return node.source;
  const rawValue = readSourceNumber(source, inferredField);
  return {
    ...source,
    field: inferredField,
    paramName: inferredField === "f24" ? "maxStacks" : source.paramName,
    rawValue: rawValue ?? undefined,
    curveId: "none",
    secondaryCurveId: "none",
    display: inferredField === "f24"
      ? { precision: 0, multiplier: 1 }
      : source.display,
  };
}

function fieldForPlaceholderIndex(index: number) {
  if (index === 0) return "chance";
  if (index === 1) return "baseVal";
  if (index === 2) return "duration";
  if (index === 3) return "f24";
  return null;
}

function validateTemplateValueSource(source: unknown, path: string): TemplateValueSource | undefined {
  if (source === undefined) return undefined;
  if (!isRecord(source)) throw new Error(`Champion Ability Text ${path} must be an object.`);
  if (source.kind === "placeholder") return { kind: "placeholder" };
  if (source.kind !== "abilityParam") throw new Error(`Champion Ability Text ${path}.kind is not supported.`);

  return {
    kind: "abilityParam",
    componentId: optionalString(source.componentId, `${path}.componentId`),
    buffType: optionalString(source.buffType, `${path}.buffType`),
    paramName: optionalString(source.paramName, `${path}.paramName`),
    field: optionalString(source.field, `${path}.field`),
    rawValue: optionalNumber(source.rawValue, `${path}.rawValue`),
    curveId: optionalString(source.curveId, `${path}.curveId`),
    secondaryCurveId: optionalString(source.secondaryCurveId, `${path}.secondaryCurveId`),
    scaleVar: optionalString(source.scaleVar, `${path}.scaleVar`),
    baseVal: optionalNumber(source.baseVal, `${path}.baseVal`),
    chance: optionalNumber(source.chance, `${path}.chance`),
    duration: optionalNumber(source.duration, `${path}.duration`),
    atkFrac: optionalNumber(source.atkFrac, `${path}.atkFrac`),
    f22: optionalNumber(source.f22, `${path}.f22`),
    f23: optionalNumber(source.f23, `${path}.f23`),
    f24: optionalNumber(source.f24, `${path}.f24`),
    f27: optionalNumber(source.f27, `${path}.f27`),
    display: source.display === undefined ? undefined : validateDisplay(source.display, `${path}.display`),
  };
}

function validateDisplay(value: unknown, path: string) {
  if (!isRecord(value)) throw new Error(`Champion Ability Text ${path} must be an object.`);
  return {
    multiplier: optionalNumber(value.multiplier, `${path}.multiplier`),
    precision: optionalNumber(value.precision, `${path}.precision`),
  };
}

function optionalString(value: unknown, path: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`Champion Ability Text ${path} must be a string.`);
  return value;
}

function optionalNumber(value: unknown, path: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Champion Ability Text ${path} must be a finite number.`);
  return value;
}

function findCurveForValueNode(
  node: Extract<TemplateNode, { type: "value" }>,
  curves: ChampionAbilityCurve[],
  stat?: ChampionAbilityStat
) {
  const source = node.source;
  if (!source || source.kind !== "abilityParam") return null;
  const explicitCurveId = source.curveId && source.curveId !== "none" ? source.curveId : null;
  const selectedPanelIds = new Set(stat?.sigAbilityIds ?? []);

  const byComponentAndCurve = curves.find(curve => {
    const params = curve.params as Record<string, unknown> | null;
    const curveSource = params && isRecord(params.source) ? params.source : null;
    return (
      curveSource?.componentId === source.componentId &&
      (!explicitCurveId || params?.sourceCurveId === explicitCurveId) &&
      curveAppliesToValueSource(curve, source)
    );
  });
  if (byComponentAndCurve) return byComponentAndCurve;

  const bySelectedPanel = curves.find(curve => {
    const params = curve.params as Record<string, unknown> | null;
    const curveSource = params && isRecord(params.source) ? params.source : null;
    return (
      typeof curveSource?.panelId === "string" &&
      selectedPanelIds.has(curveSource.panelId) &&
      (explicitCurveId != null || curveSource?.componentId === source.componentId) &&
      curveSourceMatchesValueSource(curve, source) &&
      curveAppliesToValueSource(curve, source)
    );
  });
  if (bySelectedPanel) return bySelectedPanel;

  if (explicitCurveId) return null;

  return curves.find(curve => {
    const params = curve.params as Record<string, unknown> | null;
    const curveSource = params && isRecord(params.source) ? params.source : null;
    return curveSource?.componentId === source.componentId && curveAppliesToValueSource(curve, source);
  }) ?? null;
}

function curveSourceMatchesValueSource(
  curve: ChampionAbilityCurve,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>
) {
  const params = curve.params as Record<string, unknown> | null;
  const curveSource = params && isRecord(params.source) ? params.source : null;
  const ability = curveSource && isRecord(curveSource.ability) ? curveSource.ability : null;
  const abilityBuffType = typeof ability?.buffType === "string" ? ability.buffType : null;

  if (source.buffType && abilityBuffType && source.buffType !== abilityBuffType) return false;
  return true;
}

function curveAppliesToValueSource(
  curve: ChampionAbilityCurve,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>
) {
  const params = curve.params as Record<string, unknown> | null;
  const curveSource = params && isRecord(params.source) ? params.source : null;
  const ability = curveSource && isRecord(curveSource.ability) ? curveSource.ability : null;
  const display = params && isRecord(params.display) ? params.display : null;
  const abilityParamName = typeof ability?.paramName === "string" ? ability.paramName : null;
  const displayBaseField = typeof display?.baseField === "string" ? display.baseField : null;

  if (source.paramName && abilityParamName && source.paramName !== abilityParamName) return false;
  if (source.field && displayBaseField && !sourceFieldsEquivalent(source.field, displayBaseField)) {
    if (canonicalSourceField(source.field) === "atkFrac" && curveSource && "secondaryCurve" in curveSource) return false;
    if (!curveAbilityHasField(ability, source.field)) return false;
  }
  return true;
}

function curveAbilityHasField(ability: Record<string, unknown> | null, field: string) {
  if (!ability) return false;
  if (field === "base_val") return readNumber(ability, ["baseVal", "base_val"]) != null;
  if (field === "atk_frac") return readNumber(ability, ["atkFrac", "atk_frac"]) != null;
  return readNumber(ability, [field]) != null;
}

function sourceFieldsEquivalent(left: string, right: string) {
  return canonicalSourceField(left) === canonicalSourceField(right);
}

function canonicalSourceField(field: string) {
  if (field === "base_val") return "baseVal";
  if (field === "atk_frac") return "atkFrac";
  return field;
}

function resolveTemplateValue(
  node: Extract<TemplateNode, { type: "value" }>,
  curve: ChampionAbilityCurve | null,
  sigLevel: number,
  stat?: ChampionAbilityStat
) {
  const source = node.source;
  if (!source || source.kind !== "abilityParam") {
    return curve ? evaluateCurveDisplay(curve, sigLevel) : null;
  }

  const buffType = source.buffType ?? "";
  const timeValue = resolveTimeValue(node, source, curve, sigLevel);
  if (timeValue != null) return timeValue;

  if (buffType === "fury" && source.paramName === "attackPercent" && stat?.attack && typeof source.rawValue === "number") {
    return stat.attack * resolveAttackPercentSourceValue(source);
  }

  if (node.hint?.includes("%") && !isDamageAmountPlaceholder(node, source)) {
    const indexedPercentValue = resolveIndexedPercentValue(node, source);
    if (indexedPercentValue != null) return indexedPercentValue;
    if (curve && source.field !== "duration") {
      return normalizeCurveValueForSource(evaluateCurveDisplayForSource(curve, source, sigLevel), source, node);
    }
    const sourceValue = resolveSourceValue(node, source);
    if (sourceValue != null) return sourceValue;
  }

  const healthScaledValue = resolveHealthScaledValue(node, source, curve, sigLevel, stat);
  if (healthScaledValue != null) return healthScaledValue;

  if (curve && stat?.attack && source.scaleVar?.includes("self.attack") && (isDamageText(node) || isDamageEffectSource(source))) {
    return (evaluateCurveDisplay(curve, sigLevel) / 100) * stat.attack;
  }

  if (buffType === "fury" && stat?.attack && curve) {
    return (evaluateCurveDisplay(curve, sigLevel) / 100) * stat.attack;
  }

  const attackScaledValue = resolveAttackScaledValue(node, source, stat);
  if (attackScaledValue != null) return attackScaledValue;

  if (["armor_up", "resist_physical", "resist_magic", "crit_resist"].includes(buffType) && stat?.challengeRating && curve) {
    const percent = evaluateCurveDisplay(curve, sigLevel) / 100;
    return percentToRating(percent, stat.challengeRating);
  }
  const staticRatingPercent = resolveStaticRatingPercent(node, source);
  if (staticRatingPercent != null && stat?.challengeRating) {
    return percentToRating(staticRatingPercent, stat.challengeRating);
  }
  if ((isRatingBuffType(buffType) || source.paramName === "ratingPercent") && stat?.challengeRating && typeof source.rawValue === "number") {
    return percentToRating(Math.abs(source.rawValue), stat.challengeRating);
  }

  if (isPercentPlaceholder(node, source)) {
    if (curve && source.field !== "duration") {
      return normalizeCurveValueForSource(evaluateCurveDisplayForSource(curve, source, sigLevel), source, node);
    }
    const sourceValue = resolveSourceValue(node, source);
    if (sourceValue != null) return sourceValue;
  }

  if (curve) return normalizeCurveValueForSource(evaluateCurveDisplayForSource(curve, source, sigLevel), source, node);
  const sourceValue = resolveSourceValue(node, source);
  if (sourceValue != null) return sourceValue;
  if (source.scaleVar === "self.attack" && source.display?.multiplier !== 100 && stat?.attack && typeof source.rawValue === "number") {
    if (!["duration", "maxStacks", "chance", "count", "time"].includes(source.paramName ?? "")) {
      return stat.attack * source.rawValue;
    }
  }
  return evaluateStaticValueSource(source);
}

function resolveAttackScaledValue(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>,
  stat?: ChampionAbilityStat
) {
  if (!stat?.attack) return null;
  const isAttackScaled = source.scaleVar === "self.attack" || source.scaleVar === "attack" || (isDamageText(node) && source.display?.multiplier !== 100);
  if (!isAttackScaled) return null;
  const fraction = source.rawValue ?? source.chance ?? source.atkFrac ?? null;
  if (fraction != null && Math.abs(fraction) > 5) return null;
  if (fraction == null) return null;
  return stat.attack * fraction;
}

function resolveHealthScaledValue(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>,
  curve: ChampionAbilityCurve | null,
  sigLevel: number,
  stat?: ChampionAbilityStat
) {
  if (!stat?.health) return null;
  const scaleVar = source.scaleVar ?? "";
  if (!/\b(adrenaline|health)\b/i.test(node.hint ?? "")) return null;
  if (node.hint?.includes("%")) return null;
  const isStaticHealthFraction = source.buffType === "regen" && typeof source.chance === "number" && source.chance > 0 && source.chance < 1;
  if (!scaleVar.includes("self.hp.max") && !curve && !isStaticHealthFraction) return null;

  const fraction = curve
    ? evaluateCurveDisplay(curve, sigLevel) / 100
    : source.chance && source.chance > 0 && source.chance < 1
      ? source.chance
      : source.rawValue && source.rawValue > 0 && source.rawValue < 1
        ? source.rawValue
        : null;
  return fraction == null ? null : stat.health * fraction;
}

function resolveAttackPercentSourceValue(source: Extract<TemplateValueSource, { kind: "abilityParam" }>) {
  const candidates = [source.chance, source.rawValue, source.baseVal].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  return candidates.find(value => value > 1) ?? candidates[0] ?? 0;
}

function isDamageText(node: Extract<TemplateNode, { type: "value" }>) {
  const hint = node.hint ?? "";
  if (/\bcritical damage rating\b/i.test(hint)) return false;
  return /\b(damage|direct damage|energy damage)\b/i.test(hint);
}

function isDamageAmountPlaceholder(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>
) {
  if (!isDamageText(node)) return false;
  if (source.paramName === "chance" || source.paramName === "duration") return false;
  if (source.display?.multiplier === 100) return false;
  return true;
}

function isDamageEffectSource(source: Extract<TemplateValueSource, { kind: "abilityParam" }>) {
  return ["bleed", "poison", "incinerate", "acid_burn", "shock", "rupture", "degen", "damage"].includes(source.buffType ?? "");
}

function resolveTimeValue(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>,
  curve: ChampionAbilityCurve | null,
  sigLevel: number
) {
  if (!isTimeText(node)) return null;
  if (source.paramName === "duration" && node.placeholderIndex === 3 && source.duration === 0 && typeof source.f24 === "number" && source.f24 > 0) {
    return source.f24;
  }
  if (isDamageText(node) && source.field !== "duration" && source.paramName !== "duration") return null;
  if (isPercentPlaceholder(node, source) && source.field !== "duration" && !/\bseconds?\b/i.test(node.hint ?? "")) return null;
  if (curve) return normalizeCurveValueForSource(evaluateCurveDisplayForSource(curve, source, sigLevel), source, node);
  const fieldValue = source.field ? readSourceNumber(source, source.field) : null;
  if (fieldValue == null) return null;
  if (source.display?.multiplier === 100 && Math.abs(fieldValue) > 0 && Math.abs(fieldValue) < 1) {
    return normalizePercentValue(fieldValue);
  }
  return fieldValue;
}

function isTimeText(node: Extract<TemplateNode, { type: "value" }>) {
  const hint = node.hint ?? "";
  if (/\bper second\b/i.test(hint)) return false;
  return /\b(second|seconds|second\(s\)|duration|cooldown)\b/i.test(hint);
}

function resolveStaticRatingPercent(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>
) {
  if (["chance", "count", "duration", "maxStacks", "time"].includes(source.paramName ?? "")) return null;
  if (!isRatingBuffType(source.buffType ?? "") && !isRatingText(node)) return null;
  const candidates = [source.chance, source.rawValue, source.baseVal].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  return candidates
    .map(value => Math.abs(value))
    .find(value => value > 0 && value < 1) ?? null;
}

function isPotencyText(node: Extract<TemplateNode, { type: "value" }>) {
  return /\bpotency\b/i.test(node.hint ?? "");
}

function isRatingText(node: Extract<TemplateNode, { type: "value" }>) {
  return /\b(critical damage rating|critical rating|resistance up|physical vulnerability|energy vulnerability|vulnerability|pierce)\b/i.test(node.hint ?? "");
}

function resolveSourceValue(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>
) {
  const fieldValue = source.field ? readSourceNumber(source, source.field) : null;
  const isPercentContext = isPercentPlaceholder(node, source);

  if (!isPercentContext) return fieldValue;

  const indexedPercentValue = resolveIndexedPercentValue(node, source);
  if (indexedPercentValue != null) return indexedPercentValue;

  if (source.field === "duration" && typeof source.baseVal === "number" && source.baseVal !== 1) {
    return normalizePercentValue(source.baseVal);
  }

  if (source.buffType === "duration_percent" && typeof source.chance === "number") {
    return normalizePercentValue(source.chance);
  }

  if (source.paramName === "chance" && source.field !== "chance" && typeof source.chance === "number") {
    return normalizePercentValue(source.chance);
  }

  if (
    source.field === "base_val" &&
    typeof source.chance === "number" &&
    source.chance !== 1 &&
    (Math.abs(fieldValue ?? 0) === 1 || Math.abs(source.chance) > 1)
  ) {
    return normalizePercentValue(source.chance);
  }

  if (source.field === "chance" && typeof source.baseVal === "number" && source.baseVal !== 1) {
    return normalizePercentFraction(source.baseVal);
  }

  if (fieldValue != null) return normalizePercentValue(fieldValue);
  return null;
}

function resolveIndexedPercentValue(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>
) {
  const componentId = source.componentId ?? "";

  if (componentId === "nico_hemo_info") {
    if (node.placeholderIndex === 1) return normalizePercentValue(source.chance ?? 0);
    if (node.placeholderIndex === 2) return normalizePercentValue(source.duration ?? 0);
  }

  if (componentId === "nico_hemo_pv_gain") {
    if (node.placeholderIndex === 1) return normalizePercentValue(source.chance ?? 0);
    if (node.placeholderIndex === 0) return normalizePercentFraction(source.baseVal ?? 0);
  }

  if (componentId === "nico_hex_pwr_gn_b" && node.placeholderIndex === 3) {
    return source.f24 ?? null;
  }

  if (componentId === "nico_hex_imm_seq" && node.placeholderIndex === 3) {
    return source.f24 ?? null;
  }

  if (componentId === "nico_sp1_info") {
    if (node.placeholderIndex === 0) return normalizePercentValue(source.baseVal ?? 0);
    if (node.placeholderIndex === 2) return normalizePercentValue(source.duration ?? 0);
    if (node.placeholderIndex === 3) return source.f24 ?? null;
  }

  return null;
}

function isPercentPlaceholder(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>
) {
  return node.hint?.includes("%") || source.display?.multiplier === 100;
}

function normalizePercentValue(value: number) {
  const normalized = Math.abs(value) <= 1 ? Math.abs(value) * 100 : Math.abs(value);
  return Number(normalized.toFixed(4));
}

function normalizePercentFraction(value: number) {
  return Number((Math.abs(value) * 100).toFixed(4));
}

function readSourceNumber(source: Extract<TemplateValueSource, { kind: "abilityParam" }>, field: string) {
  if (field === "base_val") return source.baseVal ?? source.rawValue ?? null;
  if (field === "baseVal") return source.baseVal ?? null;
  if (field === "chance") return source.chance ?? null;
  if (field === "duration") return source.duration ?? source.rawValue ?? null;
  if (field === "atkFrac") return source.atkFrac ?? null;
  if (field === "atk_frac") return source.atkFrac ?? source.rawValue ?? null;
  if (field === "f22") return source.f22 ?? null;
  if (field === "f23") return source.f23 ?? null;
  if (field === "f24") return source.f24 ?? null;
  if (field === "f27") return source.f27 ?? null;
  return null;
}

function evaluateStaticValueSource(source?: TemplateValueSource) {
  if (!source || source.kind !== "abilityParam" || typeof source.rawValue !== "number") return null;
  const multiplier = source.display?.multiplier ?? 1;
  return source.rawValue * multiplier;
}

function percentToRating(percent: number, challengeRating: number) {
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 1) return 0;
  const challengeScalar = 1500 + challengeRating * 5;
  return (percent * challengeScalar) / (1 - percent);
}

function isRatingBuffType(buffType: string) {
  return [
    "armor_up",
    "armor_pen",
    "block_penetration",
    "crit_damage",
    "crit_rating",
    "crit_resist",
    "resist_up",
    "resist_physical",
    "resist_magic",
    "vuln_physical",
    "vuln_energy",
  ].includes(buffType);
}

function buildMultiCurvePoint(curves: ChampionAbilityCurve[], sig: number, stat?: ChampionAbilityStat) {
  const point: Record<string, number> = { sig };
  curves.forEach((curve, index) => {
    point[`curve${index}`] = Number(evaluateCurveOutput(curve, sig, stat).toFixed(4));
  });
  return point;
}

function evaluateCurveDisplay(curve: ChampionAbilityCurve, sig: number) {
  const params = curve.params as Record<string, unknown> | null;
  if (!params) return 0;

  const f2 = readNumber(params, ["f2", "base", "coefficient"]) ?? 0;
  const f3 = readNumber(params, ["f3", "linear"]) ?? 0;
  const f4 = readNumber(params, ["f4", "offset"]) ?? 0;
  const f5 = readNumber(params, ["f5", "exponent"]) ?? 1;
  const f6 = readNumber(params, ["f6", "cap"]);
  const formulaType = typeof params.formulaType === "string" ? params.formulaType : null;
  const source = isRecord(params.source) ? params.source : null;
  const ability = source && isRecord(source.ability) ? source.ability : null;
  const display = isRecord(params.display) ? params.display : null;
  const baseField = typeof display?.baseField === "string" ? display.baseField : null;
  const multiplier = readNumber(display ?? {}, ["multiplier"]) ?? 1;
  const base = baseField && ability ? readNumber(ability, [baseField]) ?? 0 : 0;

  let curveValue = 0;
  if (sig > 0) {
    curveValue = formulaType === "legacyLogBaseMultiplier"
      ? f2 * Math.log(sig) + f3 * sig + f4
      : f2 * Math.pow(sig, f5) + f3 * sig + f4;
  }
  if (f6 != null && Math.abs(f6) < 99999) {
    curveValue = curveValue >= 0 ? Math.min(curveValue, f6) : Math.max(curveValue, f6);
  }
  return (base + curveValue) * multiplier;
}

function evaluateCurveDisplayForSource(
  curve: ChampionAbilityCurve,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>,
  sig: number
) {
  const params = curve.params as Record<string, unknown> | null;
  if (!params) return 0;

  const curveValue = evaluateCurveDelta(params, sig);
  const curveSource = isRecord(params.source) ? params.source : null;
  const ability = curveSource && isRecord(curveSource.ability) ? curveSource.ability : null;
  const base = source.field && ability
    ? readNumber(ability, [source.field]) ?? source.rawValue ?? 0
    : source.rawValue ?? 0;
  const multiplier = source.display?.multiplier ?? 1;
  return (base + curveValue) * multiplier;
}

function normalizeCurveValueForSource(
  value: number,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>,
  node: Extract<TemplateNode, { type: "value" }>
) {
  if (
    isPercentPlaceholder(node, source) &&
    source.display?.multiplier === 100 &&
    typeof source.rawValue === "number" &&
    Math.abs(source.rawValue) > 1
  ) {
    return value / 100;
  }
  return value;
}

function evaluateCurveDelta(params: Record<string, unknown>, sig: number) {
  const f2 = readNumber(params, ["f2", "base", "coefficient"]) ?? 0;
  const f3 = readNumber(params, ["f3", "linear"]) ?? 0;
  const f4 = readNumber(params, ["f4", "offset"]) ?? 0;
  const f5 = readNumber(params, ["f5", "exponent"]) ?? 1;
  const f6 = readNumber(params, ["f6", "cap"]);
  const formulaType = typeof params.formulaType === "string" ? params.formulaType : null;

  let curveValue = 0;
  if (sig > 0) {
    curveValue = formulaType === "legacyLogBaseMultiplier"
      ? f2 * Math.log(sig) + f3 * sig + f4
      : f2 * Math.pow(sig, f5) + f3 * sig + f4;
  }
  if (f6 != null && Math.abs(f6) < 99999) {
    curveValue = curveValue >= 0 ? Math.min(curveValue, f6) : Math.max(curveValue, f6);
  }
  return curveValue;
}

function evaluateCurveOutput(curve: ChampionAbilityCurve, sig: number, stat?: ChampionAbilityStat) {
  const params = curve.params as Record<string, unknown> | null;
  const source = params && isRecord(params.source) ? params.source : null;
  const ability = source && isRecord(source.ability) ? source.ability : null;
  const buffType = typeof ability?.buffType === "string" ? ability.buffType : "";

  if (buffType === "fury" && stat?.attack) {
    return (evaluateCurveDisplay(curve, sig) / 100) * stat.attack;
  }

  if (["armor_up", "resist_physical", "resist_magic", "crit_resist"].includes(buffType) && stat?.challengeRating) {
    return percentToRating(evaluateCurveDisplay(curve, sig) / 100, stat.challengeRating);
  }

  const display = params && isRecord(params.display) ? params.display : null;
  const baseField = typeof display?.baseField === "string" ? display.baseField : null;
  const multiplier = readNumber(display ?? {}, ["multiplier"]) ?? 1;
  const base = baseField && ability ? readNumber(ability, [baseField]) : null;
  const value = evaluateCurveDisplay(curve, sig);
  if (multiplier === 100 && typeof base === "number" && Math.abs(base) > 1) return value / 100;
  return value;
}

function formatAbilityTextValue(value: number, curve: ChampionAbilityCurve | null, node: Extract<TemplateNode, { type: "value" }>) {
  const source = node.source;
  const params = curve?.params as Record<string, unknown> | null | undefined;
  const display = params && isRecord(params.display) ? params.display : null;
  const outputPrecision = source?.kind === "abilityParam" && ["fury", "resist_physical", "resist_magic", "crit_resist", "armor_up"].includes(source.buffType ?? "")
    ? 2
    : null;
  const ratingPrecision = source?.kind === "abilityParam" && isRatingBuffType(source.buffType ?? "") ? 0 : null;
  const damagePrecision = isDamageText(node) || (source?.kind === "abilityParam" && isDamageEffectSource(source)) ? 2 : null;
  const durationPrecision = source?.kind === "abilityParam" && source.field === "duration" && !!curve ? 2 : null;
  const healthScaledPrecision = source?.kind === "abilityParam" &&
    (source.scaleVar?.includes("self.hp.max") || (!!curve && /\b(adrenaline|health)\b/i.test(node.hint ?? ""))) &&
    !node.hint?.includes("%")
    ? 2
    : null;
  const wholeNumberCurvePercentPrecision = source?.kind === "abilityParam" &&
    !!curve &&
    isPercentPlaceholder(node, source) &&
    source.display?.multiplier === 100 &&
    typeof source.rawValue === "number" &&
    Math.abs(source.rawValue) > 1
    ? 2
    : null;
  const precision = damagePrecision ?? durationPrecision ?? healthScaledPrecision ?? ratingPrecision ?? outputPrecision ?? wholeNumberCurvePercentPrecision ?? readNumber(display ?? {}, ["precision"]) ?? (source?.kind === "abilityParam" ? source.display?.precision ?? 1 : 1);
  const displayNumber = Math.abs(value - Math.round(value)) < 0.05 ? Math.round(value) : value;
  return displayNumber.toLocaleString("en-US", {
    maximumFractionDigits: precision,
    minimumFractionDigits: displayNumber % 1 === 0 ? 0 : Math.min(precision, 1),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readNumber(params: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = params[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}
