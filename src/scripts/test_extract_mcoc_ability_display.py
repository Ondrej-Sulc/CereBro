"""Exercise the actual extraction CLI with small, local game-export fixtures."""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest


SCRIPT = pathlib.Path(__file__).with_name('extract-mcoc-ability-display.py')


class AbilityDisplayExtractionTest(unittest.TestCase):
    def extract(self, descriptions, debug, localization=None):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / 'champions.json').write_text(json.dumps(descriptions), encoding='utf-8')
            (root / 'ability_display_debug.json').write_text(json.dumps(debug), encoding='utf-8')
            (root / 'localization.json').write_text(json.dumps(localization or {}), encoding='utf-8')
            (root / 'parse_bcg.py').write_text(
                'import json, pathlib\n'
                'LOC_STAT_EN = pathlib.Path(__file__).with_name("localization.json")\n'
                'def _load_loc_file(path):\n'
                '    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))\n',
                encoding='utf-8',
            )
            output = root / 'metadata.json'
            subprocess.run(
                [sys.executable, '-B', str(SCRIPT), '--scripts-dir', str(root), '--out', str(output)],
                check=True, capture_output=True, text=True,
            )
            return json.loads(output.read_text(encoding='utf-8'))

    def test_direct_legacy_ability_and_glossary_keep_source_ids_and_explicit_section(self):
        source = {'component_id': 'legacy_component', 'hud_id': 'legacy_hud', 'panel_id': ''}
        items = [
            {'description': 'Inflict Poison.', 'source': source},
            {'description': 'Deals damage over time.', 'source': {**source, 'component_id': 'help', 'hud_id': 'help'}},
        ]
        debug = {
            'panels': {}, 'ability_to_hud': {'legacy_component': 'legacy_hud'},
            'displays': {'legacy_hud': {'resolved': {'attr_desc': 'Inflict Poison.'}},
                         'help': {'resolved': {'buff_desc': 'Deals damage over time.'}}},
            'abilities': {'legacy_component': [{'raw_fields': {'5': {'strings': ['HEAVY']}}}]},
        }
        result = self.extract({'legacy': {'base_abilities': items}}, debug,
                              {'ID_UI_STAT_ATTRIBUTE_TRIGGER_SUBTITLE_HEAVY': 'Heavy Attacks'})
        self.assertEqual(result['unmatched'], [])
        self.assertEqual([e['sourceId'] for e in result['entries']], ['base:1', 'base:2'])
        self.assertEqual([e['display']['kind'] for e in result['entries']], ['ability', 'glossary'])
        self.assertEqual(result['entries'][0]['display']['section']['title'], 'Heavy Attacks')
        self.assertEqual(result['entries'][1]['raw'], items[1]['description'])

    def test_wrong_hud_and_changed_raw_text_are_reported_instead_of_guessed(self):
        source = {'component_id': 'component', 'hud_id': 'wrong_hud'}
        debug = {'panels': {}, 'ability_to_hud': {'component': 'correct_hud'},
                 'displays': {'wrong_hud': {'resolved': {'attr_desc': 'Text.'}},
                              'correct_hud': {'resolved': {'attr_desc': 'Original.'}}}, 'abilities': {}}
        result = self.extract({'legacy': {'base_abilities': [
            {'description': 'Text.', 'source': source},
            {'description': 'Edited.', 'source': {**source, 'hud_id': 'correct_hud'}},
        ]}}, debug)
        self.assertEqual(result['entries'], [])
        self.assertEqual(len(result['unmatched']), 2)

    def test_existing_panel_path_is_unchanged(self):
        display = {'resolved': {'attr_desc': 'Modern ability.'}}
        debug = {'panels': {'panel': [{'component_id': 'component', 'hud_id': 'hud',
                                     'display': display, 'abilities': []}]}}
        result = self.extract({'modern': {'base_abilities': [
            {'description': 'Modern ability.', 'group': 'special2',
             'source': {'panel_id': 'panel', 'component_id': 'component', 'hud_id': 'hud'}},
        ]}}, debug)
        self.assertEqual(result['entries'], [{'gameId': 'modern', 'sourceId': 'special2:1',
            'raw': 'Modern ability.', 'display': {'kind': 'ability', 'panelId': 'panel',
            'componentId': 'component', 'hudId': 'hud'}}])

    def test_ambiguous_or_unlocalized_triggers_do_not_invent_headings(self):
        debug = {'panels': {}, 'ability_to_hud': {},
                 'displays': {'hud': {'resolved': {'attr_desc': 'Ability.'}}},
                 'abilities': {'hud': [{'raw_fields': {'5': {'strings': ['HEAVY', 'SPECIAL1']}}}]}}
        descriptions = {'legacy': {'sig_abilities': [
            {'description': 'Ability.', 'source': {'component_id': 'hud', 'hud_id': 'hud'}},
            {'description': 'Ability.', 'source': {'component_id': 'hud', 'hud_id': 'hud'}},
        ]}}
        result = self.extract(descriptions, debug, {
            'ID_UI_STAT_ATTRIBUTE_TRIGGER_SUBTITLE_HEAVY': 'Heavy Attacks',
            'ID_UI_STAT_ATTRIBUTE_TRIGGER_SUBTITLE_SPECIAL1': 'Special Attack 1',
        })
        self.assertEqual([e['sourceId'] for e in result['entries']], ['signature', 'signature:2'])
        self.assertTrue(all('section' not in e['display'] for e in result['entries']))
        result = self.extract(descriptions, debug)
        self.assertTrue(all('section' not in e['display'] for e in result['entries']))


if __name__ == '__main__':
    unittest.main()
