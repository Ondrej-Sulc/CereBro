import copy
import json
import unittest
from pathlib import Path
from build_source_art import local_pack_reference
from build_permanent import project_map
from build_application_icons import bind

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'temp/quest-explorer-review/permanent-20261109'

class PermanentProjectionTests(unittest.TestCase):
    def test_legacy_keys_resolve_only_exact_manifest_files_not_similar_names(self):
        resources=Path('C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data')
        for key in ['quests/a1','quests/a2','quests/a3','quests/story_a1c1','quests/story_a2c1','quests/story_a3c1','quests/story_a3c2']:
            file,evidence=local_pack_reference(key,resources)
            self.assertEqual(file.with_suffix('').name,Path(key).name)
            self.assertEqual(evidence['pack'],'ui_fightlanding_quest')
        self.assertIsNone(local_pack_reference('quests/a1_guess',resources))
        self.assertIsNone(local_pack_reference('../quests/a1',resources))

    def test_maps_follow_placement_refs_and_preserve_unknown_source_metadata(self):
        p=SOURCE/'maps/roadtolabyrinth_ch1_quest_1.json';d=json.loads(p.read_text(encoding='utf-8'))
        identity=lambda tier:dict(tierId=tier,gameId=tier,rarity=1,name=tier,champion=None)
        m=project_map(d['quest'],d['map'],identity,p)
        keys={(t['x'],t['y'],k) for t in d['map']['walkableTiles'] for k in ([t['bossId']] if t['bossId'] else [])+[e['bossId'] for e in t['tileEntities'] or [] if e['bossId']]}
        self.assertEqual(keys,{(*e['coordinate'],e['bossKey']) for e in m['encounters']})
        unknown=[a for t in m['tiles'] for a in t['applications'] if a['sourceType']=='Unspecified']
        self.assertTrue(unknown);self.assertTrue(all(a['remainActive'] is None for a in unknown))
        changed=copy.deepcopy(d);changed['quest']['bosses']['unused-candidate']=next(iter(d['quest']['bosses'].values()))
        self.assertEqual(len(project_map(changed['quest'],changed['map'],identity,p)['encounters']),len(m['encounters']))

    def test_native_icon_binding_rejects_definition_appearance_component_and_bcg_drift(self):
        inputs=json.loads(Path('C:/Code/CereBro/temp/parallel-reference-20261109/quest-icon-source-inputs.json').read_text())['read_only_source_inputs']
        data={Path(i['path']).name:json.loads(Path(i['path']).read_text(encoding='utf-8')) for i in inputs}
        cat,bindings,art=[data[k] for k in ['catalog.json','icon-bindings.json','artwork.json']]
        icon=next(i for i in art['icons'] if i['status']=='verified')
        version=next(v for d in cat['definitions'] if d['id']==icon['effectId'] for v in d['versions'] if v['hash']==icon['versionHash'])
        args=(cat,bindings,art,version['sourceBcgSha256'])
        self.assertIsNotNone(bind(version['raw'],icon['glyph'],*args))
        changed=copy.deepcopy(version['raw']);changed['localizedName']='same id but changed source'
        self.assertIsNone(bind(changed,icon['glyph'],*args))
        self.assertIsNone(bind(version['raw'],'wrong-glyph',*args))
        self.assertIsNone(bind(version['raw'],icon['glyph'],cat,bindings,art,'changed-bcg'))
        altered=copy.deepcopy(cat);v=next(v for d in altered['definitions'] if d['id']==icon['effectId'] for v in d['versions'] if v['hash']==icon['versionHash']);v['components'].append(dict(id='fake'))
        self.assertIsNone(bind(version['raw'],icon['glyph'],altered,bindings,art,version['sourceBcgSha256']))

if __name__=='__main__':unittest.main()
