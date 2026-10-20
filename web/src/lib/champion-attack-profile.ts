type RecordedAttack = { hits: Array<{ properties: string[] }> }

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
