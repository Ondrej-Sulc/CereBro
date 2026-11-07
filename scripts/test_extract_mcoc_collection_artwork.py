import copy
import unittest
from extract_mcoc_collection_artwork import project_artwork


class CollectionProjectionTests(unittest.TestCase):
    def fixture(self):
        digest = 'a' * 64
        catalog = {'sources': [{'id': 'game', 'gameData': {'sha256': digest, 'items': [{'id': 'piece_t6'}, {'id': 'piece_t7'}]}}],
                   'methods': [{'sourceIds': ['game'], 'pieces': [{'itemId': 'piece_t7'}, {'itemId': 'piece_t6'}]}]}
        manifest = {'source': {'bucket': 'champion-images', 'registries': [{'kind': 'gameStore', 'sha256': digest}]},
                    'assets': [{'type': 'inv', 'data': item, 'role': 'full', 'registry': 'gamestore', 'registryId': item, 'sha256': image,
                                'url': 'https://storage.googleapis.com/champion-images/rewards/full/' + image + '.webp'}
                               for item, image in [('piece_t6', 'b' * 64), ('piece_t7', 'c' * 64)]]}
        return catalog, manifest

    def test_projects_only_matching_star_images_from_the_shared_registry(self):
        catalog, manifest = self.fixture()
        result = project_artwork(catalog, manifest)
        self.assertEqual([row['itemId'] for row in result['assets']], ['piece_t6', 'piece_t7'])
        self.assertNotEqual(result['assets'][0]['artworkUrl'], result['assets'][1]['artworkUrl'])
        self.assertNotIn('gameData', str(result))

    def test_rejects_missing_mismatched_or_unrelated_artwork(self):
        catalog, manifest = self.fixture()
        changed = copy.deepcopy(catalog); changed['sources'][0]['gameData']['sha256'] = 'd' * 64
        with self.assertRaisesRegex(ValueError, 'evidence'): project_artwork(changed, manifest)
        changed = copy.deepcopy(manifest); changed['assets'].pop()
        with self.assertRaisesRegex(ValueError, 'Missing'): project_artwork(catalog, changed)
        changed = copy.deepcopy(manifest); changed['assets'][0]['url'] = manifest['assets'][1]['url']
        with self.assertRaisesRegex(ValueError, 'URL'): project_artwork(catalog, changed)


if __name__ == '__main__': unittest.main()
