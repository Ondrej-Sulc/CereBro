export type ChampionAbilityTextTemplateNode =
  | { type: "text"; value: string }
  | {
      type: "value";
      key: string;
      placeholderIndex: number;
      source?: ChampionAbilityTextTemplateValueSource;
      hint?: string;
    }
  | { type: "glossary"; id: string; label: string }
  | { type: "color"; color: string; children: ChampionAbilityTextTemplateNode[] };

export type ChampionAbilityTextTemplateValueSource =
  | { kind: "placeholder" }
  | {
      kind: "abilityParam";
      componentId?: string;
      buffType?: string;
      paramName?: string;
      field?: string;
      rawValue?: number;
      curveId?: string;
      secondaryCurveId?: string;
      scaleVar?: string;
      baseVal?: number;
      chance?: number;
      duration?: number;
      atkFrac?: number;
      f22?: number;
      f23?: number;
      f24?: number;
      f27?: number;
      display?: { multiplier?: number; precision?: number };
    };

export type ChampionAbilityTextTemplate = {
  raw: string;
  blocks?: Array<{ type: "paragraph"; children: ChampionAbilityTextTemplateNode[] }>;
};
