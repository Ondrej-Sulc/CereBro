import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from historical_text_output import historical_crlf_output
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
            with historical_crlf_output(root), contextlib.redirect_stdout(io.StringIO()): project(root)
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


class HistoricalTextOutputTests(unittest.TestCase):
    def test_default_writes_replay_crlf_under_linux_defaults_only_inside_output_root(self):
        original_open = Path.open

        def linux_open(path, mode='r', buffering=-1, encoding=None, errors=None, newline=None):
            if newline is None and 'b' not in mode and any(flag in mode for flag in 'wax+'):
                newline = '\n'
            return original_open(path, mode, buffering, encoding, errors, newline)

        with tempfile.TemporaryDirectory() as directory, patch.object(Path, 'open', linux_open):
            parent = Path(directory)
            root = parent/'output'; root.mkdir()
            sibling = parent/'output-other'; sibling.mkdir()
            with historical_crlf_output(root):
                (root/'default.txt').write_text('first\nsecond\n', encoding='utf-8')
                with (root/'stream.txt').open('w', encoding='utf-8') as stream:
                    stream.write('first\nsecond\n')
                (root/'explicit-lf.txt').write_text('first\nsecond\n', encoding='utf-8', newline='\n')
                (root/'explicit-cr.txt').write_text('first\nsecond\n', encoding='utf-8', newline='\r')
                (root/'binary.bin').write_bytes(b'first\nsecond\n')
                (sibling/'outside.txt').write_text('first\nsecond\n', encoding='utf-8')
                self.assertEqual((root/'default.txt').read_text(encoding='utf-8'), 'first\nsecond\n')
            self.assertEqual((root/'default.txt').read_bytes(), b'first\r\nsecond\r\n')
            self.assertEqual((root/'stream.txt').read_bytes(), b'first\r\nsecond\r\n')
            self.assertEqual((root/'explicit-lf.txt').read_bytes(), b'first\nsecond\n')
            self.assertEqual((root/'explicit-cr.txt').read_bytes(), b'first\rsecond\r')
            self.assertEqual((root/'binary.bin').read_bytes(), b'first\nsecond\n')
            self.assertEqual((sibling/'outside.txt').read_bytes(), b'first\nsecond\n')
            (root/'after.txt').write_text('restored\n', encoding='utf-8')
            self.assertEqual((root/'after.txt').read_bytes(), b'restored\n')

    def test_context_restores_writer_after_producer_failure(self):
        before = Path.open
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(RuntimeError, 'producer failed'):
                with historical_crlf_output(Path(directory)):
                    raise RuntimeError('producer failed')
        self.assertIs(Path.open, before)


if __name__ == '__main__':
    unittest.main()
