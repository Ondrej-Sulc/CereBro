import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest

from project_mcoc_node_icon_registry import project

REPO = Path(__file__).resolve().parents[1]


class NativeIconRegistryTests(unittest.TestCase):
    def fixture(self, root):
        folder = root/'src/data/game-node-modifiers'
        folder.mkdir(parents=True)
        (root/'src/domain/node-modifiers').mkdir(parents=True)
        source = (REPO/'src/data/game-node-modifiers/artwork.json').read_bytes()
        (folder/'artwork.json').write_bytes(source)
        return folder

    def test_reviewed_registry_and_exact_version_projection_reproduce_byte_for_byte(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); self.fixture(root)
            with contextlib.redirect_stdout(io.StringIO()): project(root)
            for relative in ['src/domain/node-modifiers/native-icon-registry.ts', 'src/data/game-node-modifiers/icon-bindings.json']:
                self.assertEqual((root/relative).read_bytes(), (REPO/relative).read_bytes())

    def test_changed_source_artwork_is_rejected_before_any_registry_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); folder = self.fixture(root)
            source = json.loads((folder/'artwork.json').read_text(encoding='utf-8'))
            source['icons'][0]['effectId'] = 'unreviewed-replacement'
            (folder/'artwork.json').write_text(json.dumps(source), encoding='utf-8')
            with self.assertRaisesRegex(ValueError, 'Artwork hash mismatch'): project(root)
            self.assertFalse((folder/'icon-bindings.json').exists())


if __name__ == '__main__':
    unittest.main()
