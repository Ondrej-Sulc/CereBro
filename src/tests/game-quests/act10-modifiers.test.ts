import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadQuestMap} from '../../data/game-quests';
import {act10Data} from '../../data/game-quests/act10';
import {withAct10Modifiers} from '../../data/game-quests/act10-modifiers';
import {act10ModifierIcons,resolveAct10ModifierIcon} from '../../data/game-quests/act10-modifier-icons';
import {gameText, type QuestMap} from '../../domain/game-quests';

it('restores every recorded Act 10 assignment with readable names and fully formatted descriptions',async()=>{
  let applications=0;
  for(const [id,source] of Object.entries(act10Data.maps)){
    const file=readFileSync(`src/data/game-quests/act10-maps/${id}.json`);
    expect(createHash('sha256').update(file).digest('hex')).toBe(source.publicMapSha256);
    const original=JSON.parse(file.toString()) as QuestMap;
    const map=(await loadQuestMap(id))!;
    expect(map.paths).toEqual(original.paths);expect(map.encounters).toEqual(original.encounters);expect(map.rewards).toEqual(original.rewards);
    for(let i=0;i<map.tiles.length;i++){
      const {applications:actual,...tile}=map.tiles[i],{applications:saved,...savedTile}=original.tiles[i];
      expect(tile).toEqual(savedTile);expect(actual).toHaveLength(saved.length);
      for(let j=0;j<actual.length;j++){
        const a=actual[j];applications++;
        expect(a.name).not.toBe('Modifier details unavailable');
        expect(gameText(a.name).trim()).not.toBe('');
        expect(gameText(a.description).trim()).not.toBe('');
        expect(a.description).not.toMatch(/\{\d+\}/);
        for(const key of ['id','effectId','amount','target','sourceCoordinate','sourceType','remainActive','linkedTargets','extra'] as const)expect(a[key]).toEqual(saved[j][key]);
      }
    }
    expect(map.modifierCoverage?.resolvedDefinitions).toBe(map.modifierCoverage?.applications);
  }
  expect(applications).toBe(271);
});

it('refuses changed map identities and leaves unobserved application contexts unresolved',()=>{
  const original=JSON.parse(readFileSync('src/data/game-quests/act10-maps/epilogue_ch01_q01.json','utf8')) as QuestMap;
  const before=JSON.stringify(original);
  for(const altered of [{...original,questId:'__proto__'},{...original,mapId:'wrong-map'},{...original,sourceHash:'new-source'}])expect(withAct10Modifiers(altered)).toBe(altered);
  const first=original.tiles.findIndex(tile=>tile.applications.length>0);
  const mutations:Array<(a:QuestMap['tiles'][number]['applications'][number])=>void>=[
    a=>{a.effectId='ava_limber10';},a=>{a.amount=2;},a=>{a.target='attacker';},
    a=>{a.sourceCoordinate=[0,0];},a=>{a.sourceType='Global';},a=>{a.remainActive=true;},
    a=>{a.linkedTargets=[[0,0]];},a=>{a.parameters.nativeRedeemer={t:'buff',n:a.effectId,q:1,unknown:true};},
    a=>{a.name='Already reviewed';a.description='Keep this independent definition';},
  ];
  for(const mutate of mutations){
    const altered=structuredClone(original);mutate(altered.tiles[first].applications[0]);
    const saved=JSON.stringify(altered),result=withAct10Modifiers(altered);
    expect(result.tiles[first].applications[0]).toBe(altered.tiles[first].applications[0]);
    expect(JSON.stringify(altered)).toBe(saved);
  }
  expect(JSON.stringify(original)).toBe(before);
  const projected=withAct10Modifiers(original);
  expect(projected.capturedAt).toBe(original.capturedAt);
  expect(projected.modifierCoverage?.definitionCapturedAt).toBe('2026-11-16T14:47:10.335988+00:00');
  expect(withAct10Modifiers(projected)).toBe(projected);
});

it('accepts only the finite added icon keys and verifies their exact public SVG bytes',()=>{
  expect(act10ModifierIcons).toHaveLength(13);
  for(const icon of act10ModifierIcons){
    expect(resolveAct10ModifierIcon(icon.key)).toBe(icon);
    const hash=createHash('sha256').update(readFileSync('web/public'+icon.src)).digest('hex');
    expect(icon.src).toBe(`/node-modifiers/act10/icons/${hash}.svg`);
    expect(icon.key).toBe('node-game-glyph-'+hash.slice(0,16));
  }
  for(const key of [null,undefined,'__proto__','https://example.com/icon.svg','node-game-glyph-unknown'])expect(resolveAct10ModifierIcon(key)).toBeUndefined();
});

it('renders native template values, stack counts and percentages instead of guessed numbers',async()=>{
  const map=(await loadQuestMap('epilogue_ch01_q01'))!;
  const applications=map.tiles.flatMap(t=>t.applications);
  const brace=applications.find(a=>a.effectId==='pve_braceimpact_sp_1')!;
  expect(gameText(brace.name)).toBe('Brace For Impact (Punish Special) - 1');
  expect(gameText(brace.description)).toContain('disables it for 20 seconds');
  expect(brace.rawDescription).toContain('{1}');
  expect(gameText(applications.find(a=>a.effectId==='avx_atk_pct_125')!.description)).toBe('+125% Attack');
  expect(gameText(applications.find(a=>a.effectId==='avx_hp_pct1000')!.description)).toBe('+1000% Health');
});
