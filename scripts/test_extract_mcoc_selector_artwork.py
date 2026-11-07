import unittest
from extract_mcoc_selector_artwork import bindings_for


class SelectorArtworkTests(unittest.TestCase):
    def snapshot(self):
        return {'version': 1, 'source': {'captureMethod': 'read-only-game-definition-registry', 'openingCatalogSha256': 'a' * 64},
            'selectors': [{'id': '69152ddc4d51d164bc3ea06f', 'icon': {'source': 'cdn', 'reference': 'selectable_rewards/a/icon.png'}}]}

    def test_exact_id_and_reference(self):
        row = bindings_for(self.snapshot(), 'a' * 64)[0]
        self.assertEqual((row['data'], row['registryId']), ('69152ddc4d51d164bc3ea06f',) * 2)
        self.assertEqual(row['reference'], 'selectable_rewards/a/icon.png')

    def test_refuses_unrelated_snapshot_and_paths(self):
        with self.assertRaisesRegex(ValueError, 'snapshot mismatch'):
            bindings_for(self.snapshot(), 'b' * 64)
        bad = self.snapshot(); bad['selectors'][0]['icon']['reference'] = '../private.png'
        with self.assertRaises(ValueError):
            bindings_for(bad, 'a' * 64)

    def test_null_icon_is_not_replaced_by_a_guess(self):
        snapshot = self.snapshot(); snapshot['selectors'][0]['icon'] = None
        self.assertEqual(bindings_for(snapshot, 'a' * 64), [])


if __name__ == '__main__':
    unittest.main()
