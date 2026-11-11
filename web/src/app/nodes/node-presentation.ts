import { plainGameText, type ModifierApplication, type ModifierDefinition, type ModifierVersion } from "@cerebro/core/domain/node-modifiers/catalog"

export interface ResolvedVariant {
  text: string | null
  applications: { version: ModifierVersion; application: ModifierApplication }[]
}

/** Presentation grouping only. Every original application and version stays intact. */
export function resolvedVariants(definition: ModifierDefinition): ResolvedVariant[] {
  const groups = new Map<string | null, ResolvedVariant>()
  for (const version of definition.versions) {
    for (const application of version.applications) {
      const text = plainGameText(application.text) || null
      let group = groups.get(text)
      if (!group) {
        group = { text, applications: [] }
        groups.set(text, group)
      }
      group.applications.push({ version, application })
    }
  }
  return [...groups.values()]
}
