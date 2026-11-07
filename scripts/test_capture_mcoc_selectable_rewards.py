import unittest
from capture_mcoc_selectable_rewards import CONTRACT, METADATA_SHA256, icon_reference, validate_layout


class SelectorCaptureContractTests(unittest.TestCase):
    def layout(self):
        return {'sources': [{'sha256': METADATA_SHA256}], 'types': {
            name: {'fields': [{'name': key, 'offset': offset, 'static': False} for key, offset in fields.items()]}
            for name, fields in CONTRACT.items()}}

    def test_reviewed_layout_only(self):
        validate_layout(self.layout())
        bad = self.layout(); bad['sources'][0]['sha256'] = 'a' * 64
        with self.assertRaisesRegex(ValueError, 'Unreviewed selector metadata'):
            validate_layout(bad)
        bad = self.layout(); bad['types']['EB.Sparx.SelectableRewardsState']['fields'][0]['offset'] = 24
        with self.assertRaisesRegex(ValueError, 'layout changed'):
            validate_layout(bad)

    def test_only_exact_artwork_transport_and_safe_references(self):
        self.assertEqual(icon_reference('https://kabam-marvel.shared.mcoc-cdn.net/selectable_rewards/a/icon.png'),
            {'source': 'cdn', 'reference': 'selectable_rewards/a/icon.png'})
        self.assertIsNone(icon_reference(''))
        for value in ['https://other.example/icon.png', '//other/icon.png', '%2e%2e/private.png']:
            with self.assertRaises(ValueError):
                icon_reference(value)


if __name__ == '__main__':
    unittest.main()
