"""Portable checks: generated repo artifacts and synthetic public native rows."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from build_unplaced_defenders import bind_identity, check, read, saved_row

ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'src/data/game-quests/unplaced-defenders'
ASSETS=ROOT/'web/public/game-quests/unplaced-art'

class UnplacedDefenderTests(unittest.TestCase):
    def test_finite_permanent_scope_and_preserved_row_order(self):
        index=read(DATA/'index.json')
        self.assertEqual(len(index['quests']),138)
        self.assertEqual(sum(q['rowCount'] for q in index['quests'].values()),461)
        for qid,binding in index['quests'].items():
            doc=read(DATA/'quests'/f'{qid}.json')
            self.assertEqual([r['sourceIndex'] for r in doc['rows']],list(range(binding['rowCount'])))
            self.assertEqual(doc['definitionSourceHash'],binding['definitionSourceHash'])
        self.assertNotIn('epilogue_ch01_q01',index['quests'])

    def test_labyrinth_duplicate_is_not_deduplicated_in_source(self):
        rows=read(DATA/'quests/eq_labyrinth.json')['rows']
        duplicate=[r for r in rows if r['bossId']=='eq_labyrinth_treasure7']
        self.assertEqual([r['sourceIndex'] for r in duplicate],[23,24])
        self.assertEqual(len(rows),31)
        self.assertEqual(len({r['bossId'] for r in rows}),30)

    def test_exact_npc_identity_and_no_playable_alias(self):
        identities=read(DATA/'identities.json')
        thing=identities['npc_abyss_thing_t6']
        self.assertEqual(thing['gameId'],'ex_thing')
        self.assertEqual(thing['name'],'EX. THING')
        self.assertNotIn('champion',thing)
        self.assertTrue(thing['portraitUrl'].startswith('/game-quests/unplaced-art/'))

    def test_exact_candidate_index_preserves_occurrences(self):
        identities=read(DATA/'identities.json');index=read(DATA/'index.json');expected={}
        for qid in index['quests']:
            for row in read(DATA/'quests'/f'{qid}.json')['rows']:
                gids=dict.fromkeys([identities[row['tierId']]['gameId']]+[identities[t]['gameId'] for t in row['candidateTierIds']])
                for gid in gids:expected.setdefault(gid,{}).setdefault(qid,[]).append(row['sourceIndex'])
        actual={g:{r['questId']:r['sourceIndices'] for r in refs} for g,refs in index['byGameId'].items()}
        self.assertEqual(actual,expected)
        self.assertEqual(len(actual),117)

    def test_every_native_name_and_portrait_has_exact_evidence(self):
        identities=read(DATA/'identities.json');manifest=read(DATA/'manifest.json')
        for tier,identity in identities.items():
            proof=manifest['identityEvidence'][tier];portrait=manifest['portraitEvidence'][identity['gameId']]
            self.assertEqual(proof['character'],identity['gameId'])
            self.assertEqual(proof['blueprint'],tier)
            self.assertEqual(proof['nameField'],'BCGCharacterData._friendlyNameLoc.en')
            self.assertEqual(identity['portraitUrl'],portrait['url'])
            self.assertEqual(portrait['character'],identity['gameId'])
            self.assertEqual(portrait['bcgSha256'],manifest['bcgSha256'])
            self.assertTrue(portrait['nativePack']['path'].lower().endswith('.png'))
            self.assertTrue(identity['name'])

    def test_output_and_asset_hashes_are_complete(self):
        manifest=read(DATA/'manifest.json')
        for rel,digest in manifest['outputs'].items():self.assertEqual(hashlib.sha256((DATA/rel).read_bytes()).hexdigest(),digest)
        self.assertEqual(set(manifest['outputs'])-{'index.json','identities.json','loaders.js','loaders.d.ts'}, {'quests/'+p.name for p in (DATA/'quests').glob('*.json')})
        for rel,digest in manifest['assets'].items():self.assertEqual(hashlib.sha256((ASSETS/rel).read_bytes()).hexdigest(),digest)
        self.assertEqual(set(manifest['assets']),{p.name for p in ASSETS.glob('*.webp')})

    def test_rows_cannot_supply_a_placement_or_private_data(self):
        forbidden={'coordinate','coordinates','position','pathIndices','uid','userId','progression','encounters'}
        for p in (DATA/'quests').glob('*.json'):
            for row in read(p)['rows']:self.assertFalse(forbidden & row.keys())

    def test_binding_requires_exact_character_not_a_similar_name(self):
        bp={'exact_tier':{'Character':'ex_thing','Rarity':6}}
        chars={'ex_thing':{'_friendlyNameLoc':{'en':'EX. THING'}},'thing':{'_friendlyNameLoc':{'en':'Thing'}}}
        self.assertEqual(bind_identity('exact_tier',bp,chars)['gameId'],'ex_thing')
        del chars['ex_thing']
        with self.assertRaisesRegex(ValueError,'Unresolved exact'):bind_identity('exact_tier',bp,chars)

    def test_source_drift_stops_before_projection(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'source.json';p.write_text('{}')
            with self.assertRaisesRegex(ValueError,'Pinned source drift'):check(p,'0'*64)

    def test_native_row_selection_checks_values_and_strips_context(self):
        row=dict(bossId='same-id',blueprint='exact',candidateBlueprints=['exact','candidate'],ordinal=0,
            rank=5,level=65,signature=200,ascension=0,type={'value':0,'name':'Default'},coordinate=None)
        native=dict(bossId='same-id',blueprint='exact',potentialCharacters=['exact','candidate'],rank=5,level=65,
            sigLvl=200,ascensionTier=0,Type={'value':0,'name':'Default'},uid='PRIVATE',position=[0,0])
        selected=saved_row(row,native)
        self.assertEqual(selected['candidateTierIds'],['exact','candidate'])
        self.assertNotIn('PRIVATE',json.dumps(selected));self.assertNotIn('position',selected)
        bad=copy.deepcopy(native);bad['blueprint']='similar'
        with self.assertRaisesRegex(ValueError,'row drift'):saved_row(row,bad)
        with self.assertRaisesRegex(ValueError,'coordinate'):saved_row(dict(row,coordinate=[0,0]),native)

if __name__=='__main__':unittest.main()
