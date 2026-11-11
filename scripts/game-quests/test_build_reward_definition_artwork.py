"""Portable offline tests using only committed supplement data and synthetic I/O."""
import copy
import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import build_reward_definition_artwork as builder


ROOT = Path(__file__).resolve().parents[2]
CATALOG = json.loads((ROOT / "src/data/game-reward-definitions/catalog.json").read_text(encoding="utf-8"))
PROOF = json.loads((ROOT / "src/data/game-reward-definitions/artwork-proof.json").read_text(encoding="utf-8"))


def fixture():
    definitions = {kind: [] for kind in [*builder.COUNTS, "res"]}
    for row in PROOF["nativeFields"]:
        definitions[row["type"]].append(copy.deepcopy({key: value for key, value in row.items() if key != "type"}))
    return {"format": "cerebro.public-reward-definitions.v2", "source": {
        "readerSha256": builder.PINS["readerSha256"], "scopeSha256": builder.PINS["scopeSha256"],
        "allowlistSha256": builder.PINS["allowlistSha256"], "supportPins": {
            "GameAssembly.dll": builder.PINS["gameAssemblySha256"], "native-url-proof": builder.PINS["nativeUrlProofSha256"]}},
        "definitions": definitions, "missingIds": {key: [] for key in definitions}}, {
            **{key: sorted(row["id"] for row in rows) for key, rows in definitions.items()},
            "res": CATALOG["excludedResourceIds"]}


class ArtworkTests(unittest.TestCase):
    def setUp(self):
        self.document, self.targets = fixture()
        self.payload = (ROOT / "web/public" / CATALOG["rewards"][0]["imageUrl"].lstrip("/")).read_bytes()

    def test_all_34_metadata_and_exact_roles_reproject_portably(self):
        rows = builder.project(self.document, self.targets)
        expected = [{key: value for key, value in row.items() if key not in ("imageUrl", "inputSha256")} for row in CATALOG["rewards"]]
        self.assertEqual(rows, expected)
        self.assertEqual(len(rows), 34)

    def test_incomplete_duplicate_extra_registry_or_resource_source_fails(self):
        for mutation in [lambda d: d["definitions"]["sra"].pop(),
                         lambda d: d["definitions"]["sra"].__setitem__(1, d["definitions"]["sra"][0]),
                         lambda d: d["definitions"]["res"].append({"id": "tower_energy"}),
                         lambda d: d["definitions"].__setitem__("owned", []),
                         lambda d: d["missingIds"]["profilebadge"].append("missing")]:
            document = copy.deepcopy(self.document); mutation(document)
            with self.assertRaises(ValueError): builder.project(document, self.targets)

    def test_title_never_uses_per_title_definition_art(self):
        for row in self.document["definitions"]["utitle"]:
            row["iconImage"] = "wrong-per-title-picture"
        rows = builder.project(self.document, self.targets)
        self.assertTrue(all(row["imageReference"] == "misc/title_icon" for row in rows if row["type"] == "utitle"))
        self.document["definitions"]["utitle"][0]["nativeRedeemerIcon"] = {"source": "resource", "reference": "wrong"}
        with self.assertRaises(ValueError): builder.project(self.document, self.targets)

    def test_native_image_inputs_and_origin_are_checked(self):
        row = self.document["definitions"]["profilebadge"][0]
        row["cdn"] = "relative_prefix"
        with self.assertRaises(ValueError): builder.project(self.document, self.targets)
        row["nativeImageInputs"]["cdn"] = "relative_prefix"
        row["nativeImageInputs"]["nativeImage"] = "relative_prefix/" + row["imagePath"]
        row["nativeImageInputs"]["nativeImageKind"] = "native-relative-reference"
        with self.assertRaises(ValueError): builder.project(self.document, self.targets)

    def test_urls_cannot_escape_exact_public_png_boundary(self):
        valid = builder.CDN + "profilebadges/exact%20name.png"
        self.assertEqual(builder.exact_url(valid), valid)
        for value in ["http://kabam-marvel.shared.mcoc-cdn.net/x.png", "https://untrusted/x.png",
                      builder.CDN + "../x.png", builder.CDN + "%2e%2e/x.png", builder.CDN + "x.png?token=secret",
                      builder.CDN + "x.png#fragment", builder.CDN + "x.jpg", builder.CDN + "x%5csecret.png",
                      "https://user@kabam-marvel.shared.mcoc-cdn.net/x.png", builder.CDN + "x name.png"]:
            with self.subTest(value=value), self.assertRaises(ValueError): builder.exact_url(value)

    def test_bounded_png_and_immutable_export(self):
        info = builder.png_info(self.payload)
        self.assertGreater(info["width"], 0)
        self.assertEqual(info["byteLength"], len(self.payload))
        for bad in [b"<html>error</html>", b"", self.payload + b"x" * builder.MAX_BYTES]:
            with self.assertRaises(ValueError): builder.png_info(bad)
        with TemporaryDirectory() as directory:
            path = Path(directory) / "native.png"
            builder.immutable(path, self.payload); builder.immutable(path, self.payload)
            with self.assertRaises(ValueError): builder.immutable(path, b"different")
            self.assertEqual(path.read_bytes(), self.payload)

    def test_pin_drift_rejected_without_external_sources(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "source.json"; original = b'{"public":true}'
            path.write_bytes(original)
            self.assertEqual(builder.pinned_json(path, builder.digest(original)), {"public": True})
            path.write_bytes(b'{"public":false}')
            with self.assertRaises(ValueError): builder.pinned_json(path, builder.digest(original))

    def test_download_cache_receipt_is_exact_and_reused_without_network(self):
        url = builder.CDN + "exact/test.png"
        payload = self.payload
        class Response(io.BytesIO):
            status = 200
            def geturl(self): return url
        with TemporaryDirectory() as directory:
            retained = Path(directory)
            with patch.object(builder, "build_opener") as opener:
                opener.return_value.open.return_value = Response(payload)
                self.assertEqual(builder.acquire(url, retained, True), payload)
            with patch.object(builder, "build_opener") as opener:
                self.assertEqual(builder.acquire(url, retained, False), payload)
                opener.assert_not_called()
            (retained / (builder.digest(url.encode()) + ".png")).write_bytes(b"corrupt")
            with self.assertRaises(ValueError): builder.acquire(url, retained, False)

    def test_redirects_and_implicit_downloads_are_refused(self):
        self.assertIsNone(builder.NoRedirect().redirect_request(None, None, 302, "", {}, "https://untrusted/"))
        url = builder.CDN + "exact/test.png"
        with TemporaryDirectory() as directory, patch.object(builder, "build_opener") as opener:
            with self.assertRaises(ValueError): builder.acquire(url, Path(directory), False)
            opener.assert_not_called()

    def test_published_catalog_proof_and_original_png_bytes_agree(self):
        proof_bytes = (ROOT / "src/data/game-reward-definitions/artwork-proof.json").read_bytes()
        self.assertEqual(builder.digest(proof_bytes), CATALOG["source"]["artworkProofSha256"])
        payloads = {}
        for row in CATALOG["rewards"]:
            data = (ROOT / "web/public" / row["imageUrl"].lstrip("/")).read_bytes()
            self.assertEqual(builder.digest(data), row["inputSha256"])
            self.assertEqual(PROOF["inputs"][row["imageReference"]]["inputSha256"], row["inputSha256"])
            payloads[row["imageReference"]] = data
        rebuilt = builder.make_catalog(builder.project(self.document, self.targets), payloads,
                                       self.targets["res"], builder.digest(proof_bytes))
        self.assertEqual(builder.encoded(rebuilt), builder.encoded(CATALOG))
        self.assertEqual(len(CATALOG["assets"]), 21)


if __name__ == "__main__": unittest.main()
