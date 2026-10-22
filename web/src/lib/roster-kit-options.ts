import { projectResistanceLinks, type KitResistance } from './champion-kit';

type Link = { type: string; ability: { name: string }; resistances?: KitResistance[] };
export type ProtectionOption = { id: string | number; name: string; resistanceOnly?: boolean };

/** Pickers describe the same current projection used by the roster matcher. */
export function rosterKitOptions(links: Link[]) {
  const projected = projectResistanceLinks(links);
  const names = (type: string) => new Set(projected.filter(link => link.type === type).map(link => link.ability.name));
  const immunityNames = names('IMMUNITY');
  const options = (values: Set<string>) => [...values].sort((a, b) => a.localeCompare(b)).map(name => ({ id: name, name }));
  return {
    abilities: options(names('ABILITY')),
    immunities: options(new Set([...immunityNames, ...names('RESISTANCE')])).map(option => ({ ...option, resistanceOnly: !immunityNames.has(option.name) })),
  };
}
