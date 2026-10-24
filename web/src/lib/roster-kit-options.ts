import { getGameEffectColors, projectResistanceLinks, type KitResistance } from './champion-kit';

type Effect = { name: string; iconUrl?: string | null; gameGlossaryTerm?: { raw: unknown } | null };
type Link = { type: string; ability: Effect; resistances?: KitResistance[] };
export type RosterEffectOption = { id: string | number; name: string; iconUrl?: string; color?: string };
export type ProtectionOption = RosterEffectOption & { resistanceOnly?: boolean };

/** Pickers describe the same current projection used by the roster matcher. */
export function rosterKitOptions(links: Link[]) {
  const projected = projectResistanceLinks(links);
  const icons = new Map<string, { iconUrl: string; color: string }>();
  const rememberIcon = (effect: Effect) => {
    const iconUrl = effect.iconUrl?.trim();
    if (iconUrl && !icons.has(effect.name)) icons.set(effect.name, { iconUrl, color: getGameEffectColors(effect.gameGlossaryTerm?.raw).color });
  };
  for (const link of links) {
    rememberIcon(link.ability);
    // Read the target directly: a projected resistance may inherit omitted fields from its parent ability.
    for (const resistance of link.resistances ?? []) rememberIcon(resistance.effect);
  }
  const names = (type: string) => new Set(projected.filter(link => link.type === type).map(link => link.ability.name));
  const immunityNames = names('IMMUNITY');
  const options = (values: Set<string>): RosterEffectOption[] => [...values].sort((a, b) => a.localeCompare(b)).map(name => ({ id: name, name, ...icons.get(name) }));
  return {
    abilities: options(names('ABILITY')),
    immunities: options(new Set([...immunityNames, ...names('RESISTANCE')])).map(option => ({ ...option, resistanceOnly: !immunityNames.has(option.name) })),
  };
}
