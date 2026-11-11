"""Offline contract tests; synthetic memory only, never imports Windows support."""
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import capture_reward_definitions as reader


class SyntheticMemory:
    def __init__(self):
        self.values = {}
        self.classes = {}
        self.strings = {}
        self.touches = []
        self.next = 0x100000

    def object(self, name):
        self.next += 0x1000
        self.classes[self.next] = name
        return self.next

    def text(self, text):
        address = self.object("String")
        self.strings[address] = text
        return address

    def value(self, address):
        self.touches.append(address)
        return self.values[address]

    ptr = value
    i32 = value

    def string(self, address):
        self.touches.append(address)
        return self.strings[address] if address else None

    def klass_name(self, address):
        self.touches.append(address)
        return self.classes[address]

    def read(self, address, size):
        assert size == 1
        return self.value(address)

    def set_field(self, address, kind, name, value):
        field_type, offset = reader.FIELDS[kind][name]
        self.values[address + offset] = self.text(value) if field_type == "string" and value else value

    def dictionary(self, entries):
        dictionary = self.object("Dictionary`2")
        array = self.object("Entry[]")
        self.values.update({dictionary + 24: array, dictionary + 32: len(entries),
                            dictionary + 40: 0, dictionary + 44: 1, array + 24: len(entries)})
        for index, (key, value) in enumerate(entries):
            entry = array + 32 + index * 24
            self.values.update({entry: 1, entry + 8: self.text(key), entry + 16: value})
        return dictionary, array


class ContractTests(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.artifact = Path(directory.name)
        self.path = self.artifact / "lease.json"
        root_patch = patch.object(reader, "ARTIFACT", self.artifact)
        root_patch.start()
        self.addCleanup(root_patch.stop)
        self.now = datetime(2026, 11, 10, 12, tzinfo=timezone.utc)
        self.expected = {"scopeSha256": "scope", "readerSha256": "reader",
                         "allowlistSha256": "allowlist", "supportPins": {"pin": "fixed"}}
        self.lease = {"format": "cerebro.public-reward-definitions-lease.v2", "owner": reader.OWNER,
                      "grantedByRoot": True, **self.expected, "limits": reader.LIMITS,
                      "liveTypes": reader.LIVE_TYPES, "processId": 123,
                      "processCreationFileTime": "134072021234567890",
                      "rootReadinessEvidence": "Root inspected client and exclusively holds game access",
                      "grantedAt": self.now.isoformat(),
                      "expiresAt": (self.now + timedelta(minutes=2)).isoformat()}

    def save(self):
        self.path.write_text(json.dumps(self.lease), encoding="utf-8")

    def test_exact_lease_offline(self):
        self.save()
        self.assertEqual(reader.validate_lease(self.path, self.expected, self.now), self.lease)

    def test_revision_one_grant_is_rejected_even_if_other_fields_match(self):
        self.lease["format"] = "cerebro.public-reward-definitions-lease.v1"
        self.save()
        with self.assertRaisesRegex(ValueError, "disabled"):
            reader.validate_lease(self.path, self.expected, self.now)

    def test_denies_ungranted_identity_scope_and_time_drift(self):
        changes = {"grantedByRoot": False, "owner": "other", "processId": True,
                   "processCreationFileTime": "", "rootReadinessEvidence": "",
                   "scopeSha256": "other", "readerSha256": "other", "allowlistSha256": "other",
                   "supportPins": {}, "limits": {}, "liveTypes": ["res"],
                   "grantedAt": (self.now + timedelta(seconds=1)).isoformat(),
                   "expiresAt": (self.now + timedelta(minutes=6)).isoformat()}
        for key, value in changes.items():
            with self.subTest(key=key):
                old = self.lease[key]
                self.lease[key] = value
                self.save()
                with self.assertRaises(ValueError):
                    reader.validate_lease(self.path, self.expected, self.now)
                self.lease[key] = old
        for value in [self.now.isoformat(), self.now.replace(tzinfo=None).isoformat()]:
            self.lease["expiresAt"] = value
            self.save()
            with self.assertRaises(ValueError):
                reader.validate_lease(self.path, self.expected, self.now)

    def test_denies_output_or_lease_outside_artifact_and_overwrite(self):
        outside = self.artifact.parent / "outside.json"
        with self.assertRaises(ValueError):
            reader.within_artifact(outside)
        reader.write_new(self.path, {"safe": True})
        with self.assertRaises(FileExistsError):
            reader.write_new(self.path, {"safe": False})

    def test_capture_denied_before_importing_process_support(self):
        self.lease["grantedByRoot"] = False
        self.save()
        with patch.object(reader, "validate_inputs", return_value={}), \
                patch.object(reader, "contract", return_value=self.expected), \
                patch.object(reader.importlib.util, "spec_from_file_location") as loader:
            with self.assertRaisesRegex(ValueError, "disabled"):
                reader.capture(self.path, self.artifact / "never.json")
            loader.assert_not_called()

    def test_scope_binds_container_limits_targets_and_bootstraps(self):
        targets = reader.load_targets()
        first = reader.contract(targets, {})
        targets["sra"] = targets["sra"][:-1]
        self.assertNotEqual(first["scopeSha256"], reader.contract(targets, {})["scopeSha256"])
        for key in ["containers", "limits", "bootstraps", "fields", "nativeStringConstants"]:
            self.assertIn(key, first["scope"])
        self.assertNotIn("res", first["scope"]["liveTypes"])

    def test_registry_never_reads_unmatched_value_pointer(self):
        memory = SyntheticMemory()
        wanted, bait = memory.object("ProfileBadge"), 0xBADF00D
        dictionary, array = memory.dictionary([("other", bait), ("wanted", wanted)])
        self.assertEqual(reader.DefinitionReader(memory).selected(dictionary, {"wanted"}), {"wanted": wanted})
        self.assertNotIn(array + 32 + 16, memory.touches)
        self.assertNotIn(bait, memory.touches)

    def test_registry_mutation_and_oversize_fail_closed(self):
        memory = SyntheticMemory()
        dictionary, _ = memory.dictionary([("wanted", 123)])
        memory.values[dictionary + 32] = reader.LIMITS["maxRegistryEntries"] + 1
        with self.assertRaises(ValueError):
            reader.DefinitionReader(memory).selected(dictionary, {"wanted"})
        memory.values[dictionary + 32] = 1
        original = memory.i32
        count = 0
        def changing(address):
            nonlocal count
            if address == dictionary + 44:
                count += 1
                return count
            return original(address)
        memory.i32 = changing
        with self.assertRaisesRegex(ValueError, "mutated"):
            reader.DefinitionReader(memory).selected(dictionary, {"wanted"})

    def test_unknown_fields_fail_before_read(self):
        memory = SyntheticMemory()
        restricted = reader.DefinitionReader(memory)
        for kind, name in [("EB.Sparx.SelectableRewardsState", "<Active>k__BackingField"),
                           ("EB.Sparx.ProfileBadgesManager", "<UserProfileBadges>k__BackingField"),
                           ("EmotesManager", "<PlayerOwnedEmotes>k__BackingField"),
                           ("EmotesManager", "<PlayerEquippedEmotes>k__BackingField"),
                           ("EB.Sparx.UserTitleManager", "<LocalTitles>k__BackingField"),
                           ("EB.Sparx.ResourcesManager", "_status")]:
            with self.subTest(kind=kind, name=name), self.assertRaises(KeyError):
                restricted.field(0x100000, kind, name)
        self.assertEqual(memory.touches, [])

    def test_native_art_sources_preserve_prefix_inputs_and_reject_untrusted_urls(self):
        self.assertEqual(reader.icon_reference("resources/exact"), {"source": "resource", "reference": "resources/exact"})
        inputs = reader.image_inputs("exact.png", True, "https://kabam-marvel.shared.mcoc-cdn.net/profile_badges/")
        self.assertEqual(inputs["directIcon"], {"source": "cdn", "reference": "profile_badges//exact.png"})
        self.assertTrue(inputs["fetchablePublicUrl"])
        self.assertEqual(inputs["path"], "exact.png")
        for bad in ["../guess.png", "https://untrusted/x", "file:///x", "x%2f..%2fy", "x?token=bad"]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                reader.icon_reference(bad)
        for path, cdn in [("x?token=bad", "https://kabam-marvel.shared.mcoc-cdn.net/"),
                          ("exact.png", "https://kabam-marvel.shared.mcoc-cdn.net/?token=bad")]:
            with self.subTest(path=path, cdn=cdn), self.assertRaises(ValueError):
                reader.image_inputs(path, True, cdn)

    def test_exact_native_combine_branches_and_original_arguments(self):
        # Goldens derive from the pinned disassembly, including its surprising
        # ORIGINAL argument concat after trimmed-string emptiness checks.
        for first, second, expected in [
            (None, None, ""), ("", "", ""), (None, "/path", "path"),
            ("prefix/", None, "prefix"), ("prefix/", "/path", "prefix///path"),
            ("///", "/path", "path"), ("prefix/", ":/\\", "prefix"),
            ("\\/:/", "\\/:/", ""), ("prefix", "path", "prefix/path"),
            ("prefix", "https://untrusted/path", "prefix/https://untrusted/path"),
            ("prefix%2f", "%2fpath", "prefix%2f/%2fpath")]:
            with self.subTest(first=first, second=second):
                self.assertEqual(reader.native_uri_combine(first, second), expected)

    def test_relative_native_image_preserves_fields_without_inventing_origin(self):
        inputs = reader.image_inputs("/exact.png", True, "profile_badges/")
        self.assertEqual(inputs["path"], "/exact.png")
        self.assertEqual(inputs["cdn"], "profile_badges/")
        self.assertTrue(inputs["onS3"])
        self.assertEqual(inputs["cdnKind"], "native-prefix")
        self.assertEqual(inputs["nativeImage"], "profile_badges///exact.png")
        self.assertEqual(inputs["nativeImageKind"], "native-relative-reference")
        self.assertIsNone(inputs["directIcon"])
        self.assertFalse(inputs["fetchablePublicUrl"])

    def test_no_host_allowlist_expansion_or_absolute_child_resolution(self):
        foreign = reader.image_inputs("exact.png", True, "https://untrusted/x")
        self.assertEqual(foreign["cdnKind"], "unapproved-absolute-reference")
        self.assertEqual(foreign["nativeImage"], "https://untrusted/x/exact.png")
        self.assertIsNone(foreign["directIcon"])
        self.assertFalse(foreign["fetchablePublicUrl"])
        child = reader.image_inputs(reader.PUBLIC_CDN + "exact.png", True, "native_prefix")
        self.assertEqual(child["nativeImage"], "native_prefix/" + reader.PUBLIC_CDN + "exact.png")
        self.assertFalse(child["fetchablePublicUrl"])
        self.assertIsNone(child["directIcon"])

    def test_off_s3_getter_returns_raw_path_and_ignores_prefix_for_derivation(self):
        inputs = reader.image_inputs("resources/exact", False, "native_prefix")
        self.assertEqual(inputs["nativeImage"], "resources/exact")
        self.assertEqual(inputs["nativeRule"], "ImagePath passthrough")
        self.assertEqual(inputs["directIcon"], {"source": "resource", "reference": "resources/exact"})
        self.assertEqual(inputs["cdn"], "native_prefix")

    def test_credentials_and_query_text_are_not_retained_as_raw_evidence(self):
        for value in ["https://user:secret@host/x", "https://user%40host/x", "prefix?secret=x", "prefix%3fsecret=x", "prefix\x00x"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                reader.image_inputs("exact.png", True, value)

    def test_unsupported_art_interpretation_preserves_definition_evidence(self):
        for value in ["../unsupported/path", "native:public-art", "https://untrusted/x"]:
            with self.subTest(value=value):
                interpreted = reader.interpret_image(value, resource_if_relative=True)
                self.assertIsNone(interpreted["icon"])
                self.assertFalse(interpreted["fetchablePublicUrl"])

    def test_real_offline_pins_and_named_fields(self):
        pins = reader.validate_inputs()
        self.assertEqual(pins["GameAssembly.dll"], reader.GAME_SHA256)
        self.assertEqual(pins["Kabam.Core.Foundation.dll"], "e95106a613ab77be58d955748f0004e6485d202fdbed7a18c1c261572a024bb2")
        self.assertEqual(pins["native-url-proof"], reader.URL_PROOF_SHA256)
        self.assertEqual(set(reader.load_targets()), {"sra", "profilebadge", "emote", "utitle", "res"})

    def test_read_byte_wall_time_and_lease_deadlines(self):
        expires = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
        with patch.object(reader.time, "monotonic", return_value=100):
            reader.check_read_budget(0, 0, 1, 100, expires)
            cases = [(reader.LIMITS["maxReads"], 0, 1, 100, expires),
                     (0, reader.LIMITS["maxBytes"], 1, 100, expires),
                     (0, 0, 1, 55, expires),
                     (0, 0, 1, 100, (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat())]
            for args in cases:
                with self.subTest(args=args), self.assertRaisesRegex(ValueError, "budget"):
                    reader.check_read_budget(*args)

    def test_public_emote_and_title_definitions_do_not_touch_owned_or_local_lists(self):
        memory = SyntheticMemory()
        module = 0x180000000
        hub, manager = memory.object("SparxHub"), memory.object("EmotesManager")
        title_manager = memory.object("UserTitleManager")
        for rva, instance in [(reader.BOOTSTRAPS["HubTypeInfoRva"], hub),
                              (reader.BOOTSTRAPS["EmotesManagerTypeInfoRva"], manager)]:
            klass, static = memory.object("class"), memory.object("static")
            memory.values.update({module + rva: klass, klass + 184: static, static + 8: instance})
        memory.values[module + reader.NATIVE_CONSTANTS["utitle.GetTexture"]] = memory.text("resources/native_title_icon")
        memory.set_field(hub, "EB.Sparx.Hub", "<SelectableRewardsManager>k__BackingField", 0)
        memory.set_field(hub, "EB.Sparx.Hub", "<ProfileBadgesManager>k__BackingField", 0)
        memory.set_field(hub, "EB.Sparx.Hub", "<UserTitleManager>k__BackingField", title_manager)
        title = memory.object("UserTitleData")
        for field, value in {"<title>k__BackingField": "Exact title", "<description>k__BackingField": "Title description", "<IconImage>k__BackingField": "resources/individual_title_icon"}.items():
            memory.set_field(title, "EB.Sparx.UserTitleData", field, value)
        registry, _ = memory.dictionary([("title", title)])
        memory.set_field(title_manager, "EB.Sparx.UserTitleManager", "<TitleData>k__BackingField", registry)
        emote = memory.object("Emote")
        for field, value in {"<Id>k__BackingField": "emote", "<Title>k__BackingField": "Exact emote", "_imagePath": "specific_emote.png", "_imageOnS3": b"\x01"}.items():
            memory.set_field(emote, "Emote", field, value)
        registry, _ = memory.dictionary([("emote", emote)])
        memory.set_field(manager, "EmotesManager", "_emotes", registry)
        memory.set_field(manager, "EmotesManager", "<CDN>k__BackingField", "https://kabam-marvel.shared.mcoc-cdn.net/emotes/")
        targets = {"sra": [], "profilebadge": [], "emote": ["emote"], "utitle": ["title"], "res": ["tower_energy"]}
        rows = reader.read_definitions(memory, module, targets)
        self.assertEqual(rows["emote"][0]["name"], "Exact emote")
        self.assertEqual(rows["emote"][0]["nativeImageInputs"]["path"], "specific_emote.png")
        self.assertEqual(rows["utitle"][0]["nativeRedeemerIcon"]["reference"], "resources/native_title_icon")
        self.assertEqual(rows["utitle"][0]["definitionIcon"]["reference"], "resources/individual_title_icon")
        for forbidden in [manager + 192, manager + 200, title_manager + 56, title_manager + 64]:
            self.assertNotIn(forbidden, memory.touches)

    def test_synthetic_whole_capture_uses_public_registries_only(self):
        memory = SyntheticMemory()
        module = 0x180000000
        hub = memory.object("SparxHub")
        for rva, instance in [(reader.BOOTSTRAPS["HubTypeInfoRva"], hub),
                              (reader.BOOTSTRAPS["EmotesManagerTypeInfoRva"], 0)]:
            klass, static = memory.object("class"), memory.object("static")
            memory.values.update({module + rva: klass, klass + 184: static, static + 8: instance})
        memory.values[module + reader.NATIVE_CONSTANTS["utitle.GetTexture"]] = 0
        targets = {"sra": ["selector"], "profilebadge": ["badge"], "emote": ["emote"], "utitle": ["title"], "res": ["tower_energy"]}
        for kind, hub_field, manager_class, fields in [
            ("sra", "<SelectableRewardsManager>k__BackingField", "EB.Sparx.SelectableRewardsManager",
             {"<SRId>k__BackingField": "selector", "<Name>k__BackingField": "Exact selector", "<ActivateRedeemerTooltip>k__BackingField": "Native description", "<SRAIconPath>k__BackingField": "resources/exact", "<SRCIconPath>k__BackingField": None, "<QuestIconPath>k__BackingField": None}),
            ("profilebadge", "<ProfileBadgesManager>k__BackingField", "EB.Sparx.ProfileBadgesManager",
             {"<Id>k__BackingField": "badge", "<Title>k__BackingField": "Exact badge", "<Description>k__BackingField": "Native description", "ImagePath": "exact.png", "ImageOnS3": b"\x01"})]:
            data_class = "EB.Sparx.SelectableRewardSet" if kind == "sra" else "EB.Sparx.ProfileBadge"
            manager, definition = memory.object(manager_class.split(".")[-1]), memory.object(data_class.split(".")[-1])
            memory.set_field(hub, "EB.Sparx.Hub", hub_field, manager)
            for key, value in fields.items():
                memory.set_field(definition, data_class, key, value)
            registry, _ = memory.dictionary([(targets[kind][0], definition)])
            if kind == "sra":
                state = memory.object("SelectableRewardsState")
                memory.set_field(manager, manager_class, "_state", state)
                memory.set_field(state, "EB.Sparx.SelectableRewardsState", "<Available>k__BackingField", registry)
                active_bait = state + 24
            else:
                memory.set_field(manager, manager_class, "<ProfileBadgeDefinitions>k__BackingField", registry)
                memory.set_field(manager, manager_class, "<CDN>k__BackingField", getattr(self, "synthetic_badge_cdn", "https://kabam-marvel.shared.mcoc-cdn.net/profile_badges/"))
                owned_bait = manager + 56
        memory.set_field(hub, "EB.Sparx.Hub", "<UserTitleManager>k__BackingField", 0)
        result = reader.read_definitions(memory, module, targets)
        self.assertEqual(result["sra"][0]["name"], "Exact selector")
        self.assertEqual(result["profilebadge"][0]["name"], "Exact badge")
        self.assertEqual(result["res"], [])
        self.assertNotIn(active_bait, memory.touches)
        self.assertNotIn(owned_bait, memory.touches)

    def test_relative_native_prefix_does_not_abort_public_definitions(self):
        # Synthetic value exercises the reported failure class, not the unknown
        # runtime value from root's failed run (no raw body was retained).
        self.synthetic_badge_cdn = "profile_badges/"
        self.test_synthetic_whole_capture_uses_public_registries_only()


if __name__ == "__main__":
    unittest.main()
