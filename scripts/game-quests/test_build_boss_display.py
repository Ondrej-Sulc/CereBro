"""Focused offline join/allowlist checks; no game, process or service access."""
import copy
import unittest

from build_boss_display import project_flags


def fixture():
    tile=dict(x=1,y=2,bossId='exact-key',tileEntities=[],isFinalBoss=False,
              metadata=dict(shouldDisplayFinalBossIcon=True),final=False)
    boss=dict(isFinalBoss=False,isMetaDataFinalBoss=True)
    raw=dict(quest=dict(qid='quest',mapId='map',bosses={'exact-key':boss}),
             map=dict(walkableTiles=[tile,dict(x=9,y=9,final=True)]))
    public=dict(questId='quest',mapId='map',sourceHash='raw-hash',
                encounters=[dict(id='exact-encounter',coordinate=[1,2],bossKey='exact-key',final=False)])
    return public,raw


class BossDisplayTests(unittest.TestCase):
    def test_projects_all_four_exact_flags_without_names_builds_or_finish_inference(self):
        public,raw=fixture();before=copy.deepcopy((public,raw))
        result=project_flags(public,raw,'raw-hash')
        self.assertEqual(result,dict(questId='quest',mapId='map',sourceHash='raw-hash',encounters=[dict(
            id='exact-encounter',coordinate=[1,2],bossKey='exact-key',tileIsFinalBoss=False,
            tileShouldDisplayFinalBossIcon=True,bossIsFinalBoss=False,bossMetadataFinalBoss=True)]))
        self.assertEqual((public,raw),before)

    def test_keeps_authoritative_negative_flags_even_when_public_final_is_true(self):
        public,raw=fixture();public['encounters'][0]['final']=True
        raw['map']['walkableTiles'][0]['metadata']['shouldDisplayFinalBossIcon']=False
        raw['quest']['bosses']['exact-key']['isMetaDataFinalBoss']=False
        result=project_flags(public,raw,'raw-hash')
        self.assertFalse(any(result['encounters'][0][key] for key in ('tileIsFinalBoss','tileShouldDisplayFinalBossIcon','bossIsFinalBoss','bossMetadataFinalBoss')))

    def test_missing_or_malformed_captured_booleans_cannot_invent_negative_evidence(self):
        for value in [None,0,'false']:
            public,raw=fixture();raw['quest']['bosses']['exact-key']['isFinalBoss']=value
            with self.subTest(value=value),self.assertRaises(ValueError):project_flags(public,raw,'raw-hash')
        public,raw=fixture();del raw['map']['walkableTiles'][0]['isFinalBoss']
        with self.assertRaises(ValueError):project_flags(public,raw,'raw-hash')

    def test_refuses_source_hash_identity_coordinate_or_boss_reference_mismatch(self):
        for case in ['hash','qid','map','coordinate','boss','unplaced','duplicate']:
            public,raw=fixture();digest='raw-hash'
            if case=='hash':digest='different-hash'
            elif case=='qid':raw['quest']['qid']='other'
            elif case=='map':raw['quest']['mapId']='other'
            elif case=='coordinate':public['encounters'][0]['coordinate']=[2,1]
            elif case=='boss':public['encounters'][0]['bossKey']='other'
            elif case=='unplaced':raw['map']['walkableTiles'][0]['bossId']='other'
            else:public['encounters'].append(copy.deepcopy(public['encounters'][0]))
            with self.subTest(case=case),self.assertRaises(ValueError):project_flags(public,raw,digest)

    def test_act10_reuses_pinned_normalized_flags_and_checks_present_wire_flags(self):
        public,_=fixture();flags=dict(tileIsFinalBoss=False,tileShouldDisplayFinalBossIcon=True,bossIsFinalBoss=False,bossMetadataFinalBoss=True)
        public['nativeBossFlags']={'exact-encounter':flags}
        raw=dict(requestedQuestId='quest',data=dict(qid='quest',mapId='map',bossTable={'exact-key':dict(metadataFinalBoss=True)}),
                 map=dict(grid=[[dict(x=1,y=2,walkable=True,boss='exact-key',isFinalBoss=False,metadata=dict(shouldDisplayFinalBossIcon=True))]]))
        self.assertEqual({key:project_flags(public,raw,'raw-hash',act10=True)['encounters'][0][key] for key in flags},flags)
        raw['data']['bossTable']['exact-key']['isFinalBoss']=True
        with self.assertRaises(ValueError):project_flags(public,raw,'raw-hash',act10=True)
        raw['data']['bossTable']['exact-key']['isFinalBoss']=None
        with self.assertRaises(ValueError):project_flags(public,raw,'raw-hash',act10=True)


if __name__=='__main__':unittest.main()
