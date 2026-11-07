"""Synthetic network boundary fixtures; never a source of published crystal rates."""
import hashlib
import json
import tempfile
import unittest
from unittest.mock import patch
from decimal import Decimal
from pathlib import Path

from collect_mcoc_crystal_odds import (
    HttpResult, OddsContractError, atomic_json, collect, normalize_odds, sanitize_odds_response,
)
from publish_mcoc_crystal_odds import publish_catalog


def fixture():
    return {'ts': 1793892357, 'result': {'kinds': [
        {'n': 'Featured category', 'f': True, 'k': [
            {'n': 'Hero', 'v': 1.25, 't': 'hero', 'd': 'fixture_t7', 'br': 'fixture_bonus', 'dri': 7},
            {'n': 'Nested crystal', 'v': 98.75, 't': 'ebpf', 'd': 'fixture_nested', 'p': '<', 's': -1},
        ]},
        {'n': 'Bonus category', 'f': False, 'k': [{'n': 'Material', 'v': 100, 't': 'inv', 'd': 'fixture_token'}]},
    ]}}


def response(status=200, payload=None):
    data = json.dumps(payload if payload is not None else fixture()).encode()
    return HttpResult(status, data, '2026-11-05T15:00:00+00:00', None)


class BulkOddsTests(unittest.TestCase):
    def test_preserves_groups_source_fields_and_non_champion_outcomes(self):
        clean = sanitize_odds_response(json.dumps(fixture()).encode())
        result = normalize_odds('exact_fixture', clean, '2026-11-05T15:00:00+00:00')
        self.assertEqual(result['sourceCrystalId'], 'exact_fixture')
        self.assertEqual(len(result['groups']), 2)
        first = result['groups'][0]
        self.assertTrue(first['isFeatured'])
        self.assertEqual(first['rows'][0]['percentValue'], '1.25')
        self.assertEqual(first['rows'][0]['bonusRewardId'], 'fixture_bonus')
        self.assertEqual(first['rows'][1]['rewardData'], 'fixture_nested')
        self.assertEqual(first['rows'][1]['prefix'], '<')
        self.assertEqual(result['groups'][1]['rows'][0]['rewardType'], 'inv')
        self.assertFalse(result['individualChampionOddsInferred'])

    def test_rejects_unknown_or_account_fields_without_exporting_values(self):
        for mutate in [
            lambda p: p.update(stoken='must-never-save'),
            lambda p: p['result'].update(user={'private': 'must-never-save'}),
            lambda p: p['result']['kinds'][0]['k'][0].update(session='must-never-save'),
        ]:
            payload=fixture(); mutate(payload)
            with self.assertRaises(OddsContractError) as context:
                sanitize_odds_response(json.dumps(payload).encode())
            self.assertNotIn('must-never-save', str(context.exception))

    def test_preserves_decimal_lexemes_and_rejects_invalid_values(self):
        clean = sanitize_odds_response(b'{"result":{"kinds":[{"k":[{"n":"Fixture","v":0.010000000000000001}]}]}}')
        result = normalize_odds('fixture',clean,'2026-11-05T15:00:00+00:00')
        self.assertEqual(result['groups'][0]['rows'][0]['percentValue'],'0.010000000000000001')
        for value in [-1, 101, True, '0.5', float('nan')]:
            payload=fixture(); payload['result']['kinds'][0]['k'][0]['v']=value
            with self.assertRaises(OddsContractError):sanitize_odds_response(json.dumps(payload).encode())

    def test_resumes_exact_source_ids_without_alias_inference(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); calls=[]
            def fetch(name):calls.append(name);return response()
            first=collect(['alias_a','alias_b'],'a'*64,'example.invalid',fetch,root,interval=0,sleep=lambda _:None,limit=1)
            self.assertEqual(calls,['alias_a'])
            self.assertEqual(first['entries']['alias_b']['status'],'unattempted')
            second=collect(['alias_a','alias_b'],'a'*64,'example.invalid',fetch,root,interval=0,sleep=lambda _:None)
            self.assertEqual(calls,['alias_a','alias_b'])
            self.assertEqual(second['entries']['alias_b']['status'],'captured')
            self.assertEqual(len(list((root/'responses').glob('*.json'))),2)
            with self.assertRaises(ValueError):collect(['alias_a','alias_b'],'b'*64,'example.invalid',fetch,root,interval=0,sleep=lambda _:None)

    def test_stops_on_auth_error_and_records_unknown_as_unattempted(self):
        with tempfile.TemporaryDirectory() as temp:
            calls=[]
            def fetch(name):calls.append(name);return response(payload={'err':'invalid_session','result':None})
            result=collect(['a','b'],'a'*64,'example.invalid',fetch,Path(temp),interval=0,sleep=lambda _:None)
            self.assertEqual(calls,['a'])
            self.assertEqual(result['entries']['a']['status'],'authentication_failed')
            self.assertEqual(result['entries']['b']['status'],'unattempted')
            self.assertFalse((Path(temp)/'responses').exists())

    def test_tracks_errors_and_rate_limits_without_persisting_raw_errors(self):
        with tempfile.TemporaryDirectory() as temp:
            sequence=iter([response(429,{'err':'private_account_value'}), response(404,{'err':'private_account_value'}), response()])
            waits=[]
            result=collect(['historical','current'],'a'*64,'example.invalid',lambda _:next(sequence),Path(temp),interval=0,sleep=waits.append)
            self.assertEqual(result['entries']['historical']['status'],'http_not_found')
            self.assertEqual(result['entries']['current']['status'],'captured')
            self.assertTrue(waits)
            content=''.join(p.read_text() for p in Path(temp).rglob('*.json'))
            self.assertNotIn('private_account_value',content)

    def test_records_genuine_empty_disclosure_without_assigning_zero_odds(self):
        with tempfile.TemporaryDirectory() as temp:
            result=collect(['historical'],'a'*64,'example.invalid',lambda _:response(payload={'ts':1793892357,'result':{}}),Path(temp),interval=0,sleep=lambda _:None)
            entry=result['entries']['historical']
            self.assertEqual(entry['status'],'empty_disclosure')
            normalized=json.loads((Path(temp)/entry['normalizedFile']).read_text())
            self.assertEqual(normalized['groups'],[])
            self.assertNotIn('percentValue',json.dumps(normalized))

    def test_publisher_projects_only_reviewed_disclosures_and_every_status(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            collect(['first','unattempted'],'a'*64,'example.invalid',lambda _:response(),root,interval=0,sleep=lambda _:None,limit=1)
            manifest=json.loads((root/'coverage.json').read_text())
            manifest['private_field']='must-not-publish'
            (root/'coverage.json').write_text(json.dumps(manifest))
            result=publish_catalog(root)
            self.assertEqual(result['source']['gachaSha256'],'a'*64)
            self.assertEqual(result['source']['attemptedSourceCount'],1)
            self.assertEqual(result['openings']['unattempted']['status'],'unattempted')
            self.assertEqual(len(result['openings']['first']['groups']),2)
            self.assertNotIn('must-not-publish',json.dumps(result))

    def test_recovers_from_a_brief_windows_manifest_read_lock(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'coverage.json';path.write_text('{"old":true}')
            original=Path.replace;calls=[]
            def sometimes_locked(source,target):
                calls.append(target)
                if len(calls)<3:raise PermissionError('Synthetic reader lock')
                return original(source,target)
            with patch.object(Path,'replace',sometimes_locked),patch('collect_mcoc_crystal_odds.time.sleep',lambda _:None):
                atomic_json(path,{'new':True})
            self.assertEqual(json.loads(path.read_text()),{'new':True})
            self.assertEqual(len(calls),3)

    def test_merges_additional_exact_source_captures_without_mutating_live_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'bulk';extra=Path(temp)/'priority'
            collect(['a','b'],'a'*64,'example.invalid',lambda _:response(),root,interval=0,sleep=lambda _:None,limit=1)
            collect(['b'],'a'*64,'example.invalid',lambda _:response(),extra,interval=0,sleep=lambda _:None)
            result=publish_catalog(root,[extra])
            self.assertEqual(result['counts'],{'captured':2})
            self.assertEqual(json.loads((root/'coverage.json').read_text())['entries']['b']['status'],'unattempted')


if __name__=='__main__':unittest.main()
