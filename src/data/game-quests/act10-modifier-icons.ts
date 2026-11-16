import raw from './act10-modifier-icons.json';

export const act10ModifierIcons:ReadonlyArray<{key:string;src:string}>=raw.icons;

/** Finite additional native font outlines used by the Act 10 observation. */
export function resolveAct10ModifierIcon(key?:string|null){
  return key?act10ModifierIcons.find(icon=>icon.key===key):undefined;
}
