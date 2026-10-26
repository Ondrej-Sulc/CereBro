import { z } from "zod";

/** Presentation of source endpoints, never a bound champion's calculated stats. */
export type RelicValueDisplay = {
  multiplier: number;
  basis:
    | "number"
    | "chance-percent"
    | "unbound-percent"
    | "attack-percent"
    | "health-percent";
};

const sourceDisplaySchema = z.object({
  modSource: z.string(),
  durSource: z.string(),
  chanceSource: z.string(),
  formulaId: z.string().nullable().optional(),
  formula: z
    .object({
      formulaType: z.string(),
      reqAttrData: z.boolean(),
      vara: z.number().finite(),
    })
    .nullable()
    .optional(),
});

/** GetStatModValNumberStr: chance -> modifier display formula -> raw parameter.
 * Unknown expressions fail closed. Attack/HP coefficients can be shown as
 * relative percentages without calculating a bound champion's flat amount.
 */
export function relicParameterDisplay(
  key: string,
  source: unknown,
): RelicValueDisplay | undefined {
  const parsed = sourceDisplaySchema.safeParse(source);
  if (!parsed.success || !/^[abc]$/.test(key)) return;
  const { modSource, durSource, chanceSource, formula, formulaId } =
    parsed.data;
  if (
    ![modSource, durSource, chanceSource].every((s) =>
      /^(1|relic\.[ABC])$/.test(s),
    )
  )
    return;
  const ref = `relic.${key.toUpperCase()}`;
  if (chanceSource === ref) return { multiplier: 100, basis: "chance-percent" };
  if (modSource === ref && formulaId && formulaId !== "none" && !formula)
    return;
  if (modSource !== ref || !formula) return { multiplier: 1, basis: "number" };
  if (!formula.reqAttrData && formula.formulaType === "mod_x_vara")
    return { multiplier: formula.vara, basis: "number" };
  if (
    formula.reqAttrData &&
    ["standard", "standard_critdam"].includes(formula.formulaType)
  )
    return { multiplier: 100, basis: "unbound-percent" };
  if (formula.reqAttrData && formula.formulaType === "mod_x_attk")
    return { multiplier: 100, basis: "attack-percent" };
  if (formula.reqAttrData && formula.formulaType === "mod_x_hp")
    return { multiplier: 100, basis: "health-percent" };
}

/** Units come from the formula; surrounding prose only avoids duplicate units
 * and keeps a relative damage amount readable. Source text is never removed.
 */
export function relicRangeUnit(
  basis: RelicValueDisplay["basis"],
  followingTemplate: string,
): string {
  const tail = followingTemplate.replace(/\[[^\]]*\]/g, "").trimStart();
  if (basis === "number" || tail.startsWith("%")) return "";
  if (basis === "unbound-percent" || basis === "chance-percent") return "%";
  const stat = basis === "attack-percent" ? "Attack" : "Health";
  if (
    (basis === "attack-percent" && /^Attack Rating\b/i.test(tail)) ||
    (basis === "health-percent" && /^Health\b/i.test(tail))
  )
    return "%";
  const damage =
    /^(?:burst\s+)?(?:(?:Direct|Physical|Energy)\s+)?Damage\b/i.test(tail);
  return `% of ${stat}${damage ? " as" : ""}`;
}

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export function formatRelicRange(
  low: string | null | undefined,
  high: string | null | undefined,
  display: RelicValueDisplay,
  magnitude: boolean,
): string | undefined {
  if (
    ![low, high].every(
      (v) => typeof v === "string" && /^-?\d+(?:\.\d+)?$/.test(v),
    )
  )
    return;
  if (!Number.isFinite(display.multiplier)) return;
  let endpoints = [Number(low), Number(high)].map(
    (v) => v * display.multiplier,
  );
  if (!endpoints.every(Number.isFinite)) return;
  if (magnitude && endpoints.every((v) => v <= 0))
    endpoints = endpoints.map(Math.abs);
  endpoints.sort((a, b) => a - b);
  const [min, max] = endpoints.map((v) =>
    number.format(v).replace(/^-0$/, "0").replace(/^-/, "−"),
  );
  return min === max ? min : `${min}–${max}`;
}

/** A negative modifier is a magnitude only when the source phrase supplies direction.
 * Otherwise preserve both signed endpoints (e.g. Opponent Special Attack Damage).
 */
export function relicTemplateSuppliesReduction(prefix: string): boolean {
  const plain = prefix.replace(/\[[^\]]*\]/g, "");
  return /(?:[-−]\s*|\b(?:lower(?:ing|s)?|reduc(?:e|es|ed|ing)|decreas(?:e|es|ed|ing))[^.!?\n]*\bby\s*(?:an?\s+additional\s*)?)$/i.test(
    plain,
  );
}
