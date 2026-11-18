"""Portable checks for the finite, unchanged native portal sprite projection."""
import hashlib
import io
from pathlib import Path
import tempfile
import unittest

from PIL import Image

from build_portal_artwork import png_info, select_exact_sprite, write_projection


class PortalArtworkTests(unittest.TestCase):
    def test_exact_name_type_and_source_required_without_alias_fallback(self):
        spec = {"name": "PortalSmall", "sourcePath": "bundle", "width": 2, "height": 3,
                "sha256": "a" * 64}
        row = {"name": "PortalSmall", "type": "Sprite", "root": "installed", "sourcePath": "bundle",
               "width": 2, "height": 3, "blobSha256": "a" * 64, "pixelSha256": "b" * 64}
        self.assertEqual(select_exact_sprite([row], spec), row)
        for changes in ({"name": "portalsmall"}, {"name": "Other"}, {"type": "Texture2D"},
                        {"sourcePath": "other"}, {"root": "image-cache"}, {"width": 3},
                        {"blobSha256": "c" * 64}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                select_exact_sprite([{**row, **changes}], spec)
        with self.assertRaisesRegex(ValueError, "Ambiguous"):
            select_exact_sprite([row, row], spec)
        with self.assertRaisesRegex(ValueError, "Conflicting"):
            select_exact_sprite([row, {**row, "sourcePath": "duplicate", "pixelSha256": "c" * 64}], spec)

    def test_png_validation_retains_dimensions_and_transparent_rgb(self):
        image = Image.new("RGBA", (2, 3), (11, 186, 255, 0))
        image.putpixel((1, 2), (118, 217, 255, 185))
        stream = io.BytesIO()
        image.save(stream, format="PNG")
        raw = stream.getvalue()
        info = png_info(raw)
        self.assertEqual((info["width"], info["height"]), (2, 3))
        self.assertEqual(info["sha256"], hashlib.sha256(raw).hexdigest())
        self.assertEqual(info["rgbaSha256"], hashlib.sha256(image.tobytes()).hexdigest())
        self.assertEqual(info["alphaBounds"], [1, 2, 2, 3])
        for invalid in (b"", b"not an image"):
            with self.assertRaises(ValueError):
                png_info(invalid)

    def test_check_detects_manifest_and_original_byte_drift_without_writing(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            output, proof, assets = root / "manifest.json", root / "proof.json", root / "art"
            payload = {"exact.png": b"native PNG bytes"}
            write_projection({"small": {"url": "/exact.png"}}, {"source": "native"}, payload,
                             output, proof, assets, check=False)
            write_projection({"small": {"url": "/exact.png"}}, {"source": "native"}, payload,
                             output, proof, assets, check=True)
            before = {path: path.read_bytes() for path in root.rglob("*") if path.is_file()}
            with self.assertRaisesRegex(ValueError, "manifest drift"):
                write_projection({}, {"source": "native"}, payload, output, proof, assets, check=True)
            self.assertEqual(before, {path: path.read_bytes() for path in root.rglob("*") if path.is_file()})
            (assets / "exact.png").write_bytes(b"changed")
            with self.assertRaisesRegex(ValueError, "bytes changed"):
                write_projection({"small": {"url": "/exact.png"}}, {"source": "native"}, payload,
                                 output, proof, assets, check=True)
            with self.assertRaisesRegex(ValueError, "collision"):
                write_projection({"small": {"url": "/exact.png"}}, {"source": "native"}, payload,
                                 output, proof, assets, check=False)


if __name__ == "__main__":
    unittest.main()
