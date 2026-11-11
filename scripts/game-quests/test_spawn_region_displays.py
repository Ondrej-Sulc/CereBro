"""Meaningful source, anchor and deterministic-build boundary checks."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from build_spawn_region_displays import build, choose_anchor, read, project_quest, verify_sources, ROOT, RESEARCH


class SpawnRegionAnchorTests(unittest.TestCase):
    def test_middle_follows_graph_not_centroid_across_a_bend(self):
        # A long U-shaped route: geometric centre is off-route; its middle is [2, 2].
        points=[(0,0),(0,1),(0,2),(1,2),(2,2),(3,2),(4,2),(4,1),(4,0)]
        links={p:[] for p in points}
        for a,b in zip(points,points[1:]):links[a].append(b)
        self.assertEqual(choose_anchor(points,links,set()),[2,2])
        self.assertEqual(choose_anchor(list(reversed(points)),links,set()),[2,2])

    def test_fixed_portrait_is_avoided_and_disconnected_fallback_is_a_member(self):
        p=[(0,0),(1,0),(2,0)]
        links={(0,0):[(1,0)],(1,0):[(2,0)],(2,0):[]}
        self.assertEqual(choose_anchor(p,links,{(1,0)}),[0,0])
        self.assertEqual(choose_anchor([(0,0),(4,0),(8,0)],{},set()),[4,0])
        with self.assertRaises(AssertionError):choose_anchor([],{},set())


class SpawnRegionSourceTests(unittest.TestCase):
    def test_actual_sources_regions_builds_and_unmapped_counts(self):
        sources=verify_sources()
        for qid,count,missing in [('realm3',62,1),('eq_labyrinth',23,8)]:
            record,proof=project_quest(qid,sources)
            self.assertEqual(len(record['regions']),count)
            self.assertEqual(record['unmappedDefinitionCount'],missing)
            for region in record['regions']:
                self.assertIn(region['anchor'],region['coordinates'])
                self.assertGreater(region['definitionCandidateCount'],0)
                self.assertEqual(region['defender']['name'],sources['identities'][region['defender']['tierId']]['name'])
            self.assertEqual(proof['nativeRegionGeometry'],'game')
            self.assertEqual(proof['defenderAssociations'],'archived-reference')

    def test_geometry_and_build_drift_fail_closed(self):
        sources=verify_sources()
        bad=copy.deepcopy(sources)
        q=next(q for q in bad['native']['quests'] if q['questId']=='realm3')
        q['regions'][1]['members'][0]['x']+=1
        with self.assertRaises(AssertionError):project_quest('realm3',bad)
        bad=copy.deepcopy(sources)
        q=next(q for q in bad['native']['quests'] if q['questId']=='realm3')
        q['ambushDefinitions'][0]['definition']['rank']+=1
        with self.assertRaises(AssertionError):project_quest('realm3',bad)
        bad=copy.deepcopy(sources)
        q=next(q for q in bad['native']['quests'] if q['questId']=='realm3')
        q['ambushDefinitions'][0]['definition']['characters'].append('npc_abyss_medusa_t6')
        bad['unplaced']['realm3']['rows'][0]['candidateTierIds'].append('npc_abyss_medusa_t6')
        with self.assertRaises(AssertionError):project_quest('realm3',bad)

    def test_candidate_row_duplicates_are_not_arbitrarily_selected(self):
        record,proof=project_quest('realm3',verify_sources())
        thing=[r for r in record['regions'] if r['defender']['tierId']=='npc_abyss_thing_t6']
        self.assertEqual(len(thing),2)
        self.assertTrue(all(r['definitionCandidateCount']==2 for r in thing))
        self.assertTrue(all(len(proof['regionBindings'][r['id']]['definitionOrdinals'])==2 for r in thing))

    def test_generated_outputs_reproduce_without_touching_source_maps(self):
        before={qid:(ROOT/f'src/data/game-quests/progressed-maps/{qid}.json').read_bytes() for qid in ('realm3','eq_labyrinth')}
        with tempfile.TemporaryDirectory() as first,tempfile.TemporaryDirectory() as second:
            build(Path(first));build(Path(second))
            files=sorted(p.name for p in Path(first).iterdir())
            self.assertEqual(files,['eq_labyrinth.json','index.json','provenance.json','realm3.json'])
            for name in files:self.assertEqual((Path(first)/name).read_bytes(),(Path(second)/name).read_bytes())
        for qid,data in before.items():self.assertEqual(data,(ROOT/f'src/data/game-quests/progressed-maps/{qid}.json').read_bytes())

if __name__=='__main__':unittest.main()
