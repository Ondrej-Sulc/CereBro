import unittest
from extract_mcoc_node_artwork import icon_binding, public_bindings


class NodeArtworkTests(unittest.TestCase):
    def version(self, glyph='x'):
        return {'hash': 'version', 'raw': {'buffType': 'statMods', 'valueStr': ['component'], 'iconTexture': '', 'glyphIcon': ''},
                'components': [{'id': 'component', 'raw': {'AppearanceID': 'appearance'}}],
                'applications': [{'hash': 'application', 'raw': {'buffAppearance': glyph}}]}

    def test_exact_component_appearance_join_not_english_name(self):
        row = icon_binding(self.version(), {'appearance': {'ID': 'appearance', 'IconTexture': 'x'}})
        self.assertEqual(row['glyph'], 'x')
        self.assertEqual(row['appearanceId'], 'appearance')
        self.assertEqual(row['componentId'], 'component')

    def test_missing_or_changed_appearance_is_held(self):
        self.assertEqual(icon_binding(self.version(), {})['status'], 'unresolved-appearance')
        with self.assertRaisesRegex(ValueError, 'Appearance drift'):
            icon_binding(self.version(), {'appearance': {'IconTexture': 'y'}})

    def test_font_code_is_opaque_not_a_guessed_text_placeholder(self):
        self.assertEqual(icon_binding(self.version('-'), {'appearance': {'IconTexture': '-'}})['status'], 'verified')

    def test_missing_first_component_does_not_fall_through_to_another_effect(self):
        v = self.version(); v['raw']['valueStr'] = ['missing', 'component']
        self.assertEqual(icon_binding(v, {'appearance': {'IconTexture': 'x'}})['status'], 'unresolved-first-component')

    def test_different_application_glyphs_are_not_flattened(self):
        v = self.version(); v['applications'].append({'hash': 'other', 'raw': {'buffAppearance': 'y'}})
        self.assertEqual(icon_binding(v, {})['status'], 'multiple-application-glyphs')

    def test_captured_bcg_glyph_stays_distinct_from_component_icon(self):
        v = self.version('H'); v['raw']['buffType'] = 'bcg'
        row = icon_binding(v, {})
        self.assertEqual(row['kind'], 'captured-bcg-glyph')
        self.assertIsNone(row['appearanceId'])
        self.assertEqual(row['glyph'], 'H')

    def test_direct_texture_requires_its_own_review(self):
        v = self.version(); v['raw']['iconTexture'] = 'unreviewed/direct/art'
        self.assertEqual(icon_binding(v, {})['status'], 'unreviewed-direct-icon')

    def test_public_champion_links_require_exact_unique_game_id(self):
        public = public_bindings([{'id': 1, 'name': 'Hulk', 'gameId': 'hulk', 'slug': 'hulk'}, {'id': 2, 'name': 'Maestro', 'gameId': None, 'slug': 'maestro'}])
        self.assertEqual(public['hulk']['href'], '/champions/hulk')
        self.assertNotIn('maestro', public)
        with self.assertRaisesRegex(ValueError, 'Duplicate gameId'):
            public_bindings([{'gameId': 'hulk'}, {'gameId': 'hulk'}])


if __name__ == '__main__':
    unittest.main()
