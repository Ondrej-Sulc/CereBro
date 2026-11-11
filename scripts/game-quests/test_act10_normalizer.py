"""Portable real-wire regression fixtures plus all16 published graph/hash checks."""
import copy
import json
import unittest
from pathlib import Path
from act10_normalizer import normalize,validate_graph,IDS
from build_act10 import read,sha,source_documents,RUN,REPO

FIXTURE=REPO/'src/tests/game-quests/fixtures/act10-wire.json'

class Act10Tests(unittest.TestCase):
    def test_actual_wire_fixtures_normalize_all_assignments_without_definitions(self):
        for case in read(FIXTURE)['cases']:
            with self.subTest(qid=case['doc']['requestedQuestId']):
                m,_,_=normalize(case['doc'],case['identities'].__getitem__,case['sourceSha256'],'fixture',case['catalog'])
                self.assertEqual(case['expected'],dict(tiles=len(m['tiles']),paths=len(m['paths']),encounters=len(m['encounters']),applications=sum(len(t['applications']) for t in m['tiles'])))
                validate_graph(m)
                self.assertTrue(all(a['iconKey'] is None and a['description'] is None for t in m['tiles'] for a in t['applications']))
                self.assertEqual(m['provenance']['eligibility'],'unknown')

    def test_enemy_ascension_and_rank_are_not_clamped(self):
        case=copy.deepcopy(read(FIXTURE)['cases'][1]);b=case['doc']['data']['bossTable']['finalBossID'];b['rank']=11;b['ascensionTier']=11
        m,_,_=normalize(case['doc'],case['identities'].__getitem__,case['sourceSha256'],'fixture',case['catalog'])
        self.assertEqual((m['encounters'][0]['rank'],m['encounters'][0]['ascension']),(11,11))

    def test_unimplemented_modifier_semantics_abort_instead_of_empty_applications(self):
        for mutate in ['global','link','entity','legacy','random','map','boss']:
            case=copy.deepcopy(read(FIXTURE)['cases'][1]);t=next(t for row in case['doc']['map']['grid'] for t in row if t and t.get('boss'))
            if mutate in ['global','link']:t['all_buffs'][0]['typ']=mutate
            if mutate=='entity':t['entities']['finalBossID']['all_buffs']=[{'typ':'local'}]
            if mutate=='legacy':t['ab']=[{'n':'exact-id','q':1,'t':'buff'}]
            if mutate=='random':t['all_buffs'][0]['buffsp']=['unsupported']
            if mutate=='map':case['doc']['map']['attackTactics']={'buffPool':'unknown'}
            if mutate=='boss':case['doc']['data']['bossTable']['finalBossID']['buffs']=[{'n':'unknown','q':1}]
            with self.subTest(mutate=mutate),self.assertRaises(ValueError):normalize(case['doc'],case['identities'].__getitem__,case['sourceSha256'],'fixture',case['catalog'])

    def test_identity_invalid_graph_and_missing_blueprint_fail_closed(self):
        for mode in ['identity','edge','blueprint','grid']:
            case=copy.deepcopy(read(FIXTURE)['cases'][1]);doc=case['doc']
            if mode=='identity':doc['data']['setId']='wrong'
            if mode=='edge':doc['map']['pathData'][0]['path'][0]={'x':29,'y':29}
            if mode=='blueprint':doc['data']['bossTable']['finalBossID']['character']='unobserved'
            if mode=='grid':doc['map']['gridDimension']=29
            with self.subTest(mode=mode),self.assertRaises((ValueError,KeyError)):
                normalize(doc,case['identities'].__getitem__,case['sourceSha256'],'fixture',case['catalog'])

    def test_all16_public_shards_hashes_counts_names_and_native_flags(self):
        root=REPO/'src/data/game-quests';meta=read(root/'act10.json');self.assertEqual(set(meta['maps']),set(IDS))
        total=dict(tiles=0,paths=0,placements=0,portals=0,applications=0)
        for qid,row in meta['maps'].items():
            p=root/'act10-maps'/(qid+'.json');self.assertEqual(sha(p),row['publicMapSha256']);m=read(p);validate_graph(m)
            self.assertEqual(m['sourceHash'],row['sourceHash']);self.assertEqual(m['questId'],qid)
            self.assertEqual(set(m['nativeBossFlags']),{e['id'] for e in m['encounters']})
            for e in m['encounters']:
                self.assertTrue(e['name'] and not e['name'].startswith('#!#'))
                self.assertEqual(e['pathIndices'],[p['index'] for p in m['paths'] if e['coordinate'] in p['coordinates']])
            for k,v in [('tiles',len(m['tiles'])),('paths',len(m['paths'])),('placements',len(m['encounters'])),('portals',sum(len(t['portals']) for t in m['tiles'])),('applications',sum(len(t['applications']) for t in m['tiles']))]:total[k]+=v
        self.assertEqual(total,dict(tiles=249,paths=37,placements=32,portals=13,applications=271))
        self.assertEqual(sum(len(v) for v in meta['unplacedBossTableKeys'].values()),8)

    def test_real16_source_to_output_exact_graph_build_modifiers_and_rewards(self):
        if not RUN.exists():self.skipTest('Optional immutable local acquisition corpus absent; portable fixtures and all published hashes remain checked')
        docs,_=source_documents(RUN);root=REPO/'src/data/game-quests';meta=read(root/'act10.json')
        for qid,doc in docs.items():
            m=read(root/'act10-maps'/(qid+'.json'));native=doc['data'];wire={tuple((t['x'],t['y'])):t for row in doc['map']['grid'] for t in row if t and t.get('walkable')}
            self.assertEqual([p['coordinates'] for p in m['paths']],[[[c['x'],c['y']] for c in p['path']] for p in doc['map']['pathData']])
            for tile in m['tiles']:
                t=wire[tuple(tile['coordinate'])]
                self.assertEqual(tile['links'],[[p['x'],p['y']] for p in t.get('links',[])])
                self.assertEqual([p['target'] for p in tile['portals']],[[p['x'],p['y']] for p in t.get('pt',[])])
                self.assertEqual([(a['effectId'],a['amount']) for a in tile['applications']],[(b['n'],b['q']) for g in t.get('all_buffs',[]) for b in g['buffs']])
            for e in m['encounters']:
                b=native['bossTable'][e['bossKey']]
                self.assertEqual([e[k] for k in ['tierId','rank','level','signature','ascension']],[b['character'],b['rank'],b['level'],b.get('sig_lvl',0),b.get('ascensionTier',0)])
                tile=wire[tuple(e['coordinate'])]
                self.assertEqual(e['final'],tile.get('final',False))
                self.assertEqual(m['nativeBossFlags'][e['id']],dict(tileIsFinalBoss=tile.get('isFinalBoss',False),tileShouldDisplayFinalBossIcon=(tile.get('metadata') or {}).get('shouldDisplayFinalBossIcon',False),bossIsFinalBoss=b.get('isFinalBoss',False),bossMetadataFinalBoss=b.get('metadataFinalBoss',False)))
            r=meta['rewards'][qid]
            self.assertEqual(r['sourceHash'],m['sourceHash'])
            self.assertEqual(meta['sources'][r['sourceHash']]['capturedAt'],doc['capturedAt'])
            for field,scope in [('_firstItemAwards','firstCompletionRewards'),('_masteryItemAwards','masteryCompletionRewards'),
                ('_potentialItemAwards','potentialCompletionRewards'),('_firstItemAwardsMax','firstCompletionMaximumRewards'),
                ('_replayItemAwards','replayRewards'),('allianceBossItems','allianceBossRewards')]:
                self.assertEqual([(x['sourceIndex'],x['type'],x['data'],x['quantity']) for x in r['scopes'][scope]],
                    [(i,x['t'],x['n'],x['q']) for i,x in enumerate(native['completionRewards'][field])])


if __name__=='__main__':unittest.main()
