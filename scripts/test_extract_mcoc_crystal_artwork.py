import hashlib
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path
from PIL import Image

from extract_mcoc_crystal_artwork import cache_file, export_image, resource_index, safe_reference, extract, download, CDN_BASE


class CrystalArtworkTest(unittest.TestCase):
    def test_download_encodes_spaces_in_exact_source_paths(self):
        with tempfile.TemporaryDirectory() as directory, patch('extract_mcoc_crystal_artwork.urlopen') as open_url:
            response = open_url.return_value.__enter__.return_value
            response.url = CDN_BASE + 'gacha/banner%20name.jpg'
            response.read.return_value = b'image bytes'
            self.assertEqual(download('gacha/banner name.jpg', Path(directory)), b'image bytes')
            open_url.assert_called_once_with(CDN_BASE + 'gacha/banner%20name.jpg', timeout=20)

    def test_game_cache_uses_sha1_of_absolute_uri_path(self):
        reference = 'gacha/titan/Titan_Nexus.png'
        expected = hashlib.sha1(('/' + reference).encode()).hexdigest().upper() + '.png'
        self.assertEqual(cache_file(Path('cache'), reference), Path('cache') / expected)

    def test_pixel_preserving_transparency_and_content_addressed_output(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source.png'
            original = Image.new('RGBA', (3, 2), (10, 20, 30, 128))
            original.putpixel((0, 0), (255, 10, 30, 0))
            original.save(source)
            result = export_image(source.read_bytes(), root / 'primary')
            output = root / result['file']
            self.assertEqual(output.name, hashlib.sha256(output.read_bytes()).hexdigest() + '.webp')
            with Image.open(output) as decoded:
                self.assertEqual(decoded.convert('RGBA').tobytes(), original.tobytes())

    def test_resource_lookup_uses_complete_logical_path_and_rejects_ambiguous_art(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for pack, color in [('pack1', 'red'), ('pack2', 'blue')]:
                path = root / pack / 'uigacha' / 'crystal.png'
                path.parent.mkdir(parents=True)
                Image.new('RGB', (2, 2), color).save(path)
            with self.assertRaisesRegex(ValueError, 'Ambiguous resource'):
                resource_index(root)

    def test_unsafe_or_external_references_are_rejected(self):
        for reference in ['../secrets.png', 'https://other.example/art.png', 'gacha/%2e%2e/private.png', 'gacha\\art.png']:
            with self.assertRaises(ValueError):
                safe_reference(reference)

    def test_exact_resource_binding_recovers_a_legacy_opposite_transport_flag(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            image = root / 'resources/pack/uigacha/banner.png'
            image.parent.mkdir(parents=True)
            Image.new('RGBA', (2, 2), (10, 20, 30, 128)).save(image)
            metadata = root / 'metadata.dat'
            metadata.write_bytes(CDN_BASE.encode())
            catalog = {'source': {'gachaSha256': 'a' * 64}, 'crystals': [
                {'bannerArtwork': {'source': 'resource', 'reference': 'uigacha/banner'}},
                {'bannerArtwork': {'source': 'cdn', 'reference': 'uigacha/banner'}}]}
            result = extract(catalog, root / 'resources', root / 'cache', root / 'out', metadata, root / 'downloads', False)
            self.assertEqual(len(result['assets']), 2)
            self.assertEqual({a['role'] for a in result['assets']}, {'banner'})
            self.assertEqual(result['missing'], [])
            self.assertEqual({a['origin'] for a in result['assets']}, {'game-resource'})


if __name__ == '__main__':
    unittest.main()
