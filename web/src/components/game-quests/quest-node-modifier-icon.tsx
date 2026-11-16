import type {ComponentProps,CSSProperties} from 'react';
import {resolveAct10ModifierIcon} from '@cerebro/core/data/game-quests/act10-modifier-icons';
import {GameNodeModifierIcon} from '../nodes/GameNodeModifierIcon';

/** Additive quest shapes; the existing native and curated registries stay intact. */
export function QuestNodeModifierIcon({iconKey,size=16,className}:ComponentProps<typeof GameNodeModifierIcon>){
  const icon=resolveAct10ModifierIcon(iconKey);
  if(!icon)return <GameNodeModifierIcon iconKey={iconKey} size={size} className={className}/>;
  const pixels=Number.isFinite(size)&&size>0&&size<=64?size:16;
  const style:CSSProperties={display:'inline-block',flexShrink:0,width:pixels,height:pixels,backgroundColor:'currentColor',
    maskImage:`url("${icon.src}")`,WebkitMaskImage:`url("${icon.src}")`,maskSize:'contain',WebkitMaskSize:'contain',
    maskRepeat:'no-repeat',WebkitMaskRepeat:'no-repeat',maskPosition:'center',WebkitMaskPosition:'center',verticalAlign:'middle'};
  return <span aria-hidden="true" data-native-modifier-icon data-game-modifier-icon={icon.key} data-act10-modifier-icon className={className} style={style}/>;
}
