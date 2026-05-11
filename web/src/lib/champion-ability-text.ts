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
  | { type: "value"; key: string; placeholderIndex: number; resolution: ResolvedAbilityTextValue }
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
  return value.replace(/\[[0-9a-fA-F]{6,8}\]([\s\S]*?)\[-\]/g, "$1");
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

  for (const record of records) {
    if (record.displayTitle) {
      currentGroup = {
        id: String(record.id),
        title: record.displayTitle,
        records: [record],
      };
      recordGroups.push(currentGroup);
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
    records,
    recordGroups,
    introRecord,
    emptyText,
  };
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
  if (node.type === "text") return { type: "text", value: node.value };
  if (node.type === "glossary") return { type: "glossary", id: node.id, label: node.label };
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

function addValueHints(nodes: TemplateNode[]): TemplateNode[] {
  const siblingSources = nodes
    .filter((node): node is Extract<TemplateNode, { type: "value" }> => node.type === "value" && node.source?.kind === "abilityParam")
    .map(node => node.source as Extract<TemplateValueSource, { kind: "abilityParam" }>);

  return nodes.map((node, index) => {
    if (node.type === "value") {
      return {
        ...node,
        hint: surroundingText(nodes, index),
        source: inferMissingValueSource(node, siblingSources),
      };
    }
    if (node.type === "color") {
      return { ...node, children: addValueHints(node.children) };
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
  if (source.field && displayBaseField && source.field !== displayBaseField && !curveAbilityHasField(ability, source.field)) return false;
  return true;
}

function curveAbilityHasField(ability: Record<string, unknown> | null, field: string) {
  return ability ? readNumber(ability, [field]) != null : false;
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
  const attackScaledValue = resolveAttackScaledValue(node, source, stat);
  if (attackScaledValue != null) return attackScaledValue;

  if (buffType === "fury" && stat?.attack && curve) {
    return (evaluateCurveDisplay(curve, sigLevel) / 100) * stat.attack;
  }
  if (buffType === "fury" && source.paramName === "attackPercent" && stat?.attack && typeof source.rawValue === "number") {
    return stat.attack * source.rawValue;
  }

  const timeValue = resolveTimeValue(node, source, curve, sigLevel);
  if (timeValue != null) return timeValue;

  if (["armor_up", "resist_physical", "resist_magic", "crit_resist"].includes(buffType) && stat?.challengeRating && curve) {
    const percent = evaluateCurveDisplay(curve, sigLevel) / 100;
    return percentToRating(percent, stat.challengeRating);
  }
  const staticRatingPercent = resolveStaticRatingPercent(node, source);
  if (staticRatingPercent != null && stat?.challengeRating) {
    return percentToRating(staticRatingPercent, stat.challengeRating);
  }
  if (isPercentPlaceholder(node, source)) {
    const sourceValue = resolveSourceValue(node, source);
    if (sourceValue != null) return sourceValue;
  }
  if ((isRatingBuffType(buffType) || source.paramName === "ratingPercent") && stat?.challengeRating && typeof source.rawValue === "number") {
    return percentToRating(Math.abs(source.rawValue), stat.challengeRating);
  }

  if (curve) return evaluateCurveDisplayForSource(curve, source, sigLevel);
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
  const isAttackScaled = source.scaleVar === "self.attack" || (isDamageText(node) && source.display?.multiplier !== 100);
  if (!isAttackScaled) return null;
  const fraction = source.rawValue ?? source.chance ?? source.atkFrac ?? null;
  if (fraction == null) return null;
  return stat.attack * fraction;
}

function isDamageText(node: Extract<TemplateNode, { type: "value" }>) {
  return /\b(damage|direct damage|energy damage)\b/i.test(node.hint ?? "");
}

function resolveTimeValue(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>,
  curve: ChampionAbilityCurve | null,
  sigLevel: number
) {
  if (!isTimeText(node)) return null;
  if (curve) return evaluateCurveDisplayForSource(curve, source, sigLevel);
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
  if (!isRatingBuffType(source.buffType ?? "") && !isRatingText(node) && !isPotencyText(node)) return null;
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
  return /\b(resistance up|physical vulnerability|energy vulnerability|pierce)\b/i.test(node.hint ?? "");
}

function resolveSourceValue(
  node: Extract<TemplateNode, { type: "value" }>,
  source: Extract<TemplateValueSource, { kind: "abilityParam" }>
) {
  const fieldValue = source.field ? readSourceNumber(source, source.field) : null;
  const isPercentContext = isPercentPlaceholder(node, source);

  if (!isPercentContext) return fieldValue;

  if (source.field === "duration" && typeof source.baseVal === "number" && source.baseVal !== 1) {
    return normalizePercentValue(source.baseVal);
  }

  if (source.buffType === "duration_percent" && typeof source.chance === "number") {
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

  return evaluateCurveDisplay(curve, sig);
}

function formatAbilityTextValue(value: number, curve: ChampionAbilityCurve | null, node: Extract<TemplateNode, { type: "value" }>) {
  const source = node.source;
  const params = curve?.params as Record<string, unknown> | null | undefined;
  const display = params && isRecord(params.display) ? params.display : null;
  const outputPrecision = source?.kind === "abilityParam" && ["fury", "resist_physical", "resist_magic", "crit_resist", "armor_up"].includes(source.buffType ?? "")
    ? 2
    : null;
  const ratingPrecision = source?.kind === "abilityParam" && (isRatingBuffType(source.buffType ?? "") || isRatingText(node)) ? 0 : null;
  const damagePrecision = isDamageText(node) ? 1 : null;
  const durationPrecision = source?.kind === "abilityParam" && source.field === "duration" && !!curve ? 2 : null;
  const precision = damagePrecision ?? durationPrecision ?? ratingPrecision ?? outputPrecision ?? readNumber(display ?? {}, ["precision"]) ?? (source?.kind === "abilityParam" ? source.display?.precision ?? 1 : 1);
  return value.toLocaleString("en-US", {
    maximumFractionDigits: precision,
    minimumFractionDigits: value % 1 === 0 ? 0 : Math.min(precision, 1),
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
