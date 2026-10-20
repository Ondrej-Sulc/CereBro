import importlib.util
import pathlib
import json
import unittest

spec = importlib.util.spec_from_file_location('bindings', pathlib.Path(__file__).with_name('extract-mcoc-ability-bindings.py'))
bindings = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bindings)


def component(modifier=1, formula='', chance=1, duration=.65, stackable=6):
    fields = {str(tag): {kind: [value]} for tag, kind, value in [
        (13, 'floats', chance), (14, 'floats', modifier), (15, 'floats', duration),
        (24, 'ints', stackable), (7, 'strings', formula), (18, 'strings', ''), (19, 'strings', 'none')]}
    return {'ability_id': 'arbitrary_component', 'hud_id': 'hud', 'buff_type': 'anything', 'raw_fields': fields}


class GameBindingExtractionTest(unittest.TestCase):
    def test_captured_raw_game_components_reproduce_committed_bindings(self):
        fixture = json.loads((pathlib.Path(__file__).parents[1] / 'domain/champion-ability-text/fixtures/game-display-bindings.json').read_text(encoding='utf-8'))
        for case in fixture['cases']:
            with self.subTest(component=case['componentId']):
                actual = bindings.build_sources(case['row'], [int(i) for i in case['sources']], fixture['formulas'], {})
                self.assertEqual(actual, case['sources'])
    def test_single_count_is_modifier_not_chance_or_percent(self):
        sources = bindings.build_sources(component(modifier=1, stackable=1), [1, 2], {}, {})
        self.assertEqual(sources['1']['gameBinding']['value'], 1)
        self.assertEqual(sources['1']['gameBinding']['formula']['type'], 'identity')
        self.assertEqual(sources['1']['display']['multiplier'], 1)
        self.assertEqual(sources['2']['gameBinding']['value'], .65)

    def test_power_rate_uses_explicit_display_formula_and_separate_cap(self):
        formula = {'id': 'times_hundred', 'type': 'mod_x_vara', 'a': 100, 'b': 0, 'c': 0}
        sources = bindings.build_sources(component(modifier=.02, formula='times_hundred'), [0, 1, 3], {'times_hundred': formula}, {})
        self.assertEqual([sources[str(i)]['gameBinding']['value'] for i in [0, 1, 3]], [1, .02, 6])
        self.assertEqual(sources['1']['gameBinding']['formula'], formula)

    def test_growth_only_binds_the_named_target_not_every_placeholder(self):
        row = component()
        row['raw_fields']['18']['strings'] = ['duration']
        row['raw_fields']['19']['strings'] = ['duration_curve']
        curve = {'id': 'duration_curve', 'a': .1, 'b': 0, 'c': 0, 'exponent': 1}
        sources = bindings.build_sources(row, [0, 1, 2, 3], {}, {'duration_curve': curve})
        self.assertEqual([i for i, s in sources.items() if 'growth' in s['gameBinding']], ['2'])

    def test_missing_formula_curve_or_unknown_slot_refused(self):
        with self.assertRaisesRegex(ValueError, 'formula'):
            bindings.build_sources(component(formula='new_formula'), [1], {}, {})
        with self.assertRaisesRegex(ValueError, 'Unknown display slot'):
            bindings.build_sources(component(), [4], {}, {})
        row = component()
        row['raw_fields']['18']['strings'] = ['modifier']
        row['raw_fields']['19']['strings'] = ['missing']
        with self.assertRaisesRegex(ValueError, 'growth curve'):
            bindings.build_sources(row, [1], {}, {})

    def test_ambiguous_hud_component_not_silently_selected(self):
        item = {'description': 'Gain {1} Buff.', 'source': {'component_id': 'hud', 'hud_id': 'hud'}}
        other = component(modifier=2)
        other['ability_id'] = 'other_component'
        entries, held = bindings.extract({'test': {'base_abilities': [item]}},
                                         {'abilities': {'hud': [component(), other]}}, {}, {})
        self.assertEqual(entries, [])
        self.assertEqual(held[0]['reason'], 'different-display-arguments-on-shared-hud')

    def test_shared_hud_prefers_the_champions_explicit_rank_components(self):
        item = {'description': '{1}% chance.', 'source': {'component_id': 'hud', 'hud_id': 'hud'}}
        other = component(modifier=.34)
        other['ability_id'] = 'quest_variant'
        champion = {'base_abilities': [item], 'tiers': {'tier': {'ranks': [{'base_ability_ids': ['arbitrary_component']}]}}}
        entries, held = bindings.extract({'test': champion}, {'abilities': {'hud': [other, component(modifier=.5)]}}, {}, {})
        self.assertEqual(held, [])
        self.assertEqual(entries[0]['sources']['1']['gameBinding']['value'], .5)

    def test_current_raw_bcg_drift_is_refused(self):
        item = {'description': 'Gain {1} Buff.', 'source': {'component_id': 'arbitrary_component', 'hud_id': 'hud'}}
        entries, held = bindings.extract({'test': {'base_abilities': [item]}}, {'abilities': {'arbitrary_component': [component()]}}, {}, {},
                                         {'arbitrary_component': [component(modifier=2)]})
        self.assertEqual(entries, [])
        self.assertEqual(held[0]['reason'], 'raw-debug-versus-bcg-drift')


if __name__ == '__main__': unittest.main()
