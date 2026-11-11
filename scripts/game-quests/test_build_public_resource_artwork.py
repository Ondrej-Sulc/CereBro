"""Portable offline tests: published source receipts and five PNGs only."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("build_public_resource_artwork.py")
SPEC = importlib.util.spec_from_file_location("resource_artwork", SCRIPT)
art = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(art)


class PublicResourceArtworkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.proof_raw = (art.OUTPUT / "proof.json").read_bytes()
        cls.proof = json.loads(cls.proof_raw)
        cls.catalog_raw = (art.OUTPUT / "catalog.json").read_bytes()
        cls.catalog = json.loads(cls.catalog_raw)
        cls.docs, cls.rows = art.validate_sources(cls.proof["sources"])
        cls.payloads = {r["iconTexture"]: (art.ASSETS / (r["inputSha256"] + ".png")).read_bytes()
                        for r in cls.catalog["resources"] if r["artworkStatus"] == "resolved"}

    def test_complete_exact_native_metadata_and_dates(self):
        self.assertEqual(tuple(r["data"] for r in self.rows), art.IDS)
        for row, raw in zip(self.rows, self.docs["public-resource-metadata.json"]["definitions"]):
            self.assertEqual({k: row[k] for k in ("name", "description", "iconTexture")},
                             {k: raw[k] for k in ("name", "description", "iconTexture")})
        self.assertEqual(self.catalog["source"]["capturedAt"], art.CAPTURE_DATE)
        self.assertEqual(self.catalog["source"]["artworkProofSha256"], art.digest(self.proof_raw))

    def test_empty_native_fields_remain_defined_without_alias_or_filter(self):
        rows = {r["data"]: r for r in self.catalog["resources"]}
        self.assertEqual(rows["sp"]["name"], "MASTERY POINT")
        for key in ("sp", "sp-max"):
            self.assertEqual(rows[key]["artworkStatus"], "native-empty")
            self.assertEqual(rows[key]["iconTexture"], "")
            self.assertNotIn("imageUrl", rows[key])
        self.assertEqual(rows["sp-max"]["name"], "")
        self.assertEqual(rows["sp-max"]["description"], "")
        self.assertEqual(len(rows), 7)

    def test_five_native_inputs_and_content_addresses(self):
        self.assertEqual(len(self.payloads), 5)
        self.assertEqual(len(self.catalog["assets"]), 5)
        for key, payload in self.payloads.items():
            sha = art.digest(payload)
            info = art.png_info(payload)
            asset = self.catalog["assets"][sha]
            self.assertEqual(asset["imageUrl"], f"/game-rewards/resource-definitions/{sha}.png")
            self.assertEqual({k: info[k] for k in ("width", "height", "byteLength")},
                             {k: asset[k] for k in ("width", "height", "byteLength")})
            self.assertEqual(self.proof["inputs"][key]["rgbaSha256"], info["rgbaSha256"])

    def test_exact_essentia_atlas_pointer_and_pixels(self):
        proof = self.docs["essentia-binding-proof.json"]
        self.assertEqual(proof["nativeAtlasIndex"]["spritePointer"], {"m_FileID": 0, "m_PathID": 1047})
        self.assertEqual(proof["nativeAtlasIndex"]["index"], 365)
        self.assertEqual({r["blobSha256"] for r in proof["matches"]}, {art.ESSENTIA_SHA})
        self.assertEqual(art.digest(self.payloads[art.ESSENTIA_KEY]), art.ESSENTIA_SHA)
        bad = dict(self.payloads)
        bad[art.ESSENTIA_KEY] = next(v for k, v in bad.items() if k != art.ESSENTIA_KEY)
        with self.assertRaisesRegex(ValueError, "Essentia"):
            art.make_outputs(self.proof["sources"], bad)

    def test_source_receipts_reject_any_byte_drift(self):
        for name in art.SOURCE_PINS:
            bad = copy.deepcopy(self.proof["sources"])
            bad[name]["utf8"] += " "
            with self.assertRaisesRegex(ValueError, "source drift"):
                art.validate_sources(bad)
        bad = copy.deepcopy(self.proof["sources"])
        bad["unknown-source"] = {}
        with self.assertRaises(ValueError):
            art.validate_sources(bad)

    def test_finite_projection_rejects_identity_private_fields_missing_and_provenance(self):
        changes = [lambda d: d["definitions"].pop(),
                   lambda d: d["definitions"][0].update(id="sp"),
                   lambda d: d["definitions"][0].update(amount=1),
                   lambda d: d.update(missingIds=["sp"]),
                   lambda d: d.update(capturedAt="2026-11-11"),
                   lambda d: d["source"].update(scopeSha256="0" * 64),
                   lambda d: d["definitions"][1].update(iconTexture="resources/iconCurrencyEssentia.png"),
                   lambda d: d["definitions"][4].update(iconTexture="summonerlevelup/iconSkillPoints"),
                   lambda d: d["definitions"][0].update(name="x" * 8193)]
        for change in changes:
            document = copy.deepcopy(self.docs["public-resource-metadata.json"])
            change(document)
            with self.assertRaises(ValueError):
                art.project(document)

    def test_public_url_boundary_is_exact(self):
        urls = [key for key in self.payloads if key != art.ESSENTIA_KEY]
        self.assertEqual(len(urls), 4)
        for url in urls:
            self.assertEqual(art.support.exact_url(url), url)
        base = urls[0]
        bad = [base + "?token=x", base + "#x", base.replace("https:", "http:"),
               base.replace("kabam-marvel.", "evil."), base.replace("https://", "https://user@"),
               base.replace("/resources/", "/%2e%2e/"), base.replace(".png", ".svg"),
               base.replace("/resources/", "/x%5cy/"), base + "\n"]
        for url in bad:
            with self.assertRaises(ValueError):
                art.support.exact_url(url)

    def test_http_request_no_redirect_or_credentials_and_original_bytes(self):
        url = next(key for key in self.payloads if key != art.ESSENTIA_KEY)
        payload = self.payloads[url]
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def geturl(self): return url
            def read(self, maximum):
                self.maximum = maximum
                return payload
        response = Response()
        class Opener:
            def open(self, request, timeout):
                self.request, self.timeout = request, timeout
                return response
        opener = Opener()
        with tempfile.TemporaryDirectory() as directory:
            retained = Path(directory)
            with patch.object(art.support, "build_opener", return_value=opener) as factory:
                self.assertEqual(art.support.acquire(url, retained, True), payload)
            self.assertIs(factory.call_args.args[0], art.support.NoRedirect)
            self.assertEqual(opener.request.full_url, url)
            self.assertFalse({"cookie", "authorization"} & {k.lower() for k in opener.request.headers})
            self.assertEqual(opener.timeout, 20)
            self.assertEqual(response.maximum, 8 * 1024 * 1024 + 1)
            self.assertIsNone(art.support.NoRedirect().redirect_request(None, None, 302, "redirect", {}, "https://example.com"))
            with patch.object(art.support, "build_opener", side_effect=AssertionError("No network in retained mode")):
                self.assertEqual(art.support.acquire(url, retained, False), payload)
            with self.assertRaisesRegex(ValueError, "opt in"):
                art.support.acquire(urls_not_retained(url), retained, False)

    def test_reject_bad_png_unrequested_inputs_and_immutable_collision(self):
        with self.assertRaises(ValueError): art.png_info(b"not a PNG")
        with self.assertRaises(ValueError): art.png_info(b"x" * (8 * 1024 * 1024 + 1))
        with self.assertRaises(ValueError): art.make_outputs(self.proof["sources"], {})
        with self.assertRaises(ValueError): art.make_outputs(self.proof["sources"], self.payloads | {"sp": b"x"})
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "immutable.png"
            art.support.immutable(path, b"a")
            art.support.immutable(path, b"a")
            with self.assertRaises(ValueError): art.support.immutable(path, b"b")

    def test_deterministic_portable_replay_without_ignored_sources(self):
        with patch.object(art.support, "build_opener", side_effect=AssertionError("Offline check")):
            result = art.replay()
        self.assertEqual((result["definitions"], result["uniqueAssets"], result["resolved"], result["nativeEmpty"]), (7, 5, 5, 2))
        self.assertEqual(art.make_outputs(self.proof["sources"], self.payloads), (self.catalog_raw, self.proof_raw))

    def test_portable_offline_rebuild_and_tamper_detection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            research, output, assets = root / "retained", root / "output", root / "assets"
            research.mkdir()
            for name, receipt in self.proof["sources"].items():
                (research / name).write_bytes(receipt["utf8"].encode("utf-8"))
            (research / "essentia-native.png").write_bytes(self.payloads[art.ESSENTIA_KEY])
            for url, payload in self.payloads.items():
                if url == art.ESSENTIA_KEY: continue
                key = art.digest(url.encode("utf-8"))
                art.support.immutable(research / "downloads" / (key + ".png"), payload)
                art.support.immutable(research / "downloads" / (key + ".json"),
                                      art.encoded({"url": url, "inputSha256": art.digest(payload), **art.png_info(payload)}))
            with patch.object(art.support, "build_opener", side_effect=AssertionError("Offline build")):
                art.build(research / "public-resource-metadata.json", research, output, assets)
                art.replay(output, assets)
            self.assertEqual((output / "catalog.json").read_bytes(), self.catalog_raw)
            self.assertEqual((output / "proof.json").read_bytes(), self.proof_raw)
            first = next(assets.glob("*.png"))
            first.write_bytes(b"tampered")
            with self.assertRaisesRegex(ValueError, "content address drift"):
                art.replay(output, assets)


def urls_not_retained(url):
    # Valid host/path still requires explicit acquisition and a source binding.
    return url.replace(".png", "_unretained.png")


if __name__ == "__main__":
    unittest.main()
