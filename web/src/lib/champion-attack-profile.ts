type RecordedAttack = { hits: Array<{ properties: string[] }> }

/** Presentation dimensions stay independent; absent fields carry no inferred defaults. */
export function describeChampionAttackHit(properties: string[]) {
  const unique = [...new Set(properties.filter(property => property.trim().length > 0))]
  return {
    damage: ["Physical", "Energy"].filter(property => unique.includes(property)),
    delivery: ["Contact", "Projectile"].filter(property => unique.includes(property)),
    other: unique.filter(property => !["Physical", "Energy", "Contact", "Projectile"].includes(property)).sort(),
  }
}

/** Collapse only adjacent equal property sets, retaining their exact 1-based hit positions. */
export function groupChampionAttackHits(hits: RecordedAttack["hits"]) {
  const runs: Array<ReturnType<typeof describeChampionAttackHit> & { start: number; end: number }> = []
  hits.forEach((hit, index) => {
    const properties = describeChampionAttackHit(hit.properties)
    const previous = runs[runs.length - 1]
    if (previous && (["damage", "delivery", "other"] as const).every(key =>
      previous[key].join("\u0000") === properties[key].join("\u0000"))) {
      previous.end = index + 1
    } else {
      runs.push({ start: index + 1, end: index + 1, ...properties })
    }
  })
  return runs
}

/** Counts recorded hits, independent of their damage amounts or in-fight modifiers. */
export function summarizeChampionAttackHits(attacks: RecordedAttack[]) {
  const damage = { physical: 0, energy: 0, mixed: 0, other: 0 }
  let total = 0, contact = 0, projectile = 0
  for (const attack of attacks) {
    for (const hit of attack.hits) {
      total++
      const properties = new Set(hit.properties)
      const physical = properties.has("Physical"), energy = properties.has("Energy")
      damage[physical && energy ? "mixed" : physical ? "physical" : energy ? "energy" : "other"]++
      if (properties.has("Contact")) contact++
      if (properties.has("Projectile")) projectile++
    }
  }
  return { total, damage, contact, projectile }
}
