"""Offline Tower reader tests; no Windows, game, network or database access."""
import datetime
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import capture_public_towers as tower


class MemoryFixture:
    def __init__(self):
        self.values = {1024: 2000, 1032: 3, 1040: 1, 1044: 9, 2024: 3,
                       2032: 1, 2040: 3000, 2048: 1, 2052: 2, 2056: 5000,
                       2064: 1, 2072: 3001, 2096: -1}
        self.strings = {3000: "class_skill", 3001: "event_tower"}

    def ptr(self, address):
        return self.values[address]

    def i32(self, address):
        return self.values[address]

    def string(self, address):
        return self.strings[address]

    def klass_name(self, address):
        if address != 1000:
            raise ValueError("Unexpected object access")
        return "Dictionary`2"


class ReaderFixture:
    def spec(self, kind, field):
        return {"offset": {("Tower.TowerFloorData", "ParentBlockData"): 40,
                           ("Tower.TowerBlockData", "Floors"): 40}[kind, field]}


class TowerReaderTests(unittest.TestCase):
    def test_selected_block_captures_only_its_loaded_floor_definitions(self):
        rows = [[(("class_skill",), 10)], [(("class_skill", 1), 11), (("class_skill", 2), 12)],
                [(("class_skill", 1, 1), 21), (("class_skill", 2, 1), 22)]]
        selected = tower.select_block_rows(rows, ("class_skill", 2))
        self.assertEqual(selected[1], [(("class_skill", 2), 12)])
        self.assertEqual(selected[2], [(("class_skill", 2, 1), 22)])
        with self.assertRaisesRegex(ValueError, "not loaded"):
            tower.select_block_rows(rows, ("class_skill", 3))
        with self.assertRaisesRegex(ValueError, "Invalid"):
            tower.select_block_rows(rows, ("event_tower", 1))

    def test_registry_captures_exact_tuple_and_skips_unapproved_definitions(self):
        rows, stamp = tower.read_registry(MemoryFixture(), 1000, 3)
        self.assertEqual(rows, [(("class_skill", 1, 2), 5000)])
        self.assertEqual(stamp, (2000, 3, 1, 9))

    def test_registry_rejects_mutation_and_invalid_bounds(self):
        class Mutating(MemoryFixture):
            versions_read = 0

            def i32(self, address):
                if address == 1044:
                    self.versions_read += 1
                    return self.versions_read
                return super().i32(address)

        with self.assertRaisesRegex(ValueError, "changed"):
            tower.read_registry(Mutating(), 1000, 3)
        memory = MemoryFixture()
        memory.values[1040] = 4
        with self.assertRaisesRegex(ValueError, "bounds"):
            tower.read_registry(memory, 1000, 3)

    def test_registry_rejects_duplicate_exact_keys(self):
        memory = MemoryFixture()
        memory.strings[3001] = "class_skill"
        memory.values.update({2080: 1, 2084: 2, 2088: 5001})
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            tower.read_registry(memory, 1000, 3)

    def test_floor_requires_exact_parent_and_array_slot(self):
        memory = MemoryFixture()
        memory.values.update({5040: 4000, 4040: 6000, 6024: 3, 6048: 5000})
        floor = {"TowerId": "class_skill", "BlockId": 1}
        tower.verify_floor(memory, ReaderFixture(), ("class_skill", 1, 2), 5000, floor,
                           {("class_skill", 1): 4000})
        memory.values[6048] = 5001
        with self.assertRaisesRegex(ValueError, "native block array"):
            tower.verify_floor(memory, ReaderFixture(), ("class_skill", 1, 2), 5000, floor,
                               {("class_skill", 1): 4000})

    def test_floor_rejects_missing_parent_and_identity_disagreement(self):
        floor = {"TowerId": "class_skill", "BlockId": 1}
        with self.assertRaisesRegex(ValueError, "parent block"):
            tower.verify_floor(MemoryFixture(), ReaderFixture(), ("class_skill", 1, 2), 5000, floor, {})
        with self.assertRaisesRegex(ValueError, "key/definition"):
            tower.verify_floor(MemoryFixture(), ReaderFixture(), ("class_skill", 3, 2), 5000, floor, {})

    def test_allowlist_contains_public_defender_and_prizes_only(self):
        self.assertEqual(tower.ALLOW["HeroData"], {"mBlueprint", "mUserHero"})
        self.assertEqual(tower.ALLOW["BCGUserHero"], {"Blueprint", "Rank", "Level", "SigLvl", "AscensionTier"})
        self.assertTrue({"Rewards", "RatingRewards", "EntryCost"} <= tower.ALLOW["Tower.TowerBlockData"])
        self.assertTrue({"Buffs", "BossData", "Rewards"} <= tower.ALLOW["Tower.TowerFloorData"])
        self.assertFalse({"UserData", "UserFloorsData", "ActiveMatchData"} & tower.POINTER_FIELDS["EB.Sparx.TowerManager"])
        self.assertFalse({"Context", "Source", "Balance"} & tower.ALLOW["EB.Sparx.RedeemerItem"])

    def test_named_fields_reject_duplicates_or_missing_offsets(self):
        layout = {"types": {}}
        for kind in tower.ALLOW.keys() | tower.POINTER_FIELDS.keys():
            names = tower.ALLOW.get(kind, set()) | tower.POINTER_FIELDS.get(kind, set())
            layout["types"][kind] = {"fields": [{"name": n, "type": "string", "offset": 16, "static": False}
                                                     for n in sorted(names)]}
        self.assertIn("BossData", tower.field_specs(layout)["Tower.TowerFloorData"])
        layout["types"]["HeroData"]["fields"][0]["offset"] = None
        with self.assertRaisesRegex(ValueError, "Unbound"):
            tower.field_specs(layout)

    def test_lease_rejects_stale_unconfirmed_pid_or_changed_scope(self):
        now = datetime.datetime(2026, 11, 10, tzinfo=datetime.timezone.utc)
        valid = {"format": "cerebro.public-tower-lease.v1", "owner": tower.OWNER,
                 "grantedByRoot": True, "userReadyConfirmed": True,
                 "readinessEvidence": "Actual user:Ready at Tower selection", "processId": 42,
                 "readerSha256": tower.sha(Path(tower.__file__)), "scopeSha256": tower.scope_hash(),
                 "supportPins": tower.PINS, "layoutSha256": tower.LAYOUT_SHA,
                 "allowedTowerIds": sorted(tower.PUBLIC_TOWERS),
                 "grantedAt": now.isoformat(), "expiresAt": (now + datetime.timedelta(minutes=15)).isoformat()}
        with tempfile.TemporaryDirectory(prefix="tower-test-") as folder, patch.object(tower, "REPO", Path(folder)):
            path = Path(folder) / "temp" / "lease.json"
            path.parent.mkdir()
            path.write_text(json.dumps(valid), encoding="utf-8")
            self.assertEqual(tower.validate_lease(path, 42, now)["processId"], 42)
            for key, value in [("grantedByRoot", False), ("userReadyConfirmed", False),
                               ("processId", 43), ("readerSha256", "bad"), ("scopeSha256", "bad"),
                               ("allowedTowerIds", ["event_tower"]), ("expiresAt", now.isoformat())]:
                with self.subTest(key=key):
                    path.write_text(json.dumps({**valid, key: value}), encoding="utf-8")
                    with self.assertRaises(ValueError):
                        tower.validate_lease(path, 42, now)

    def test_capture_closes_handle_before_output_and_never_overwrites(self):
        self.capture_lifecycle(False)

    def test_capture_failure_closes_handle_without_creating_output(self):
        self.capture_lifecycle(True)

    def capture_lifecycle(self, fail):
        closed = []

        class FakeMemory:
            reads = 1
            bytes = 8

            def __init__(self, pid):
                if pid != 42:
                    raise ValueError("Unexpected PID")

            def close(self):
                closed.append(True)

        fake_modules = {"read_memory": SimpleNamespace(Memory=FakeMemory, find_game=lambda: (42, {"path": "fake.dll"})),
                        "capture_quests": SimpleNamespace(QuestReader=object)}
        original_open = Path.open
        with tempfile.TemporaryDirectory(prefix="tower-test-") as folder, patch.object(tower, "REPO", Path(folder)):
            output = Path(folder) / "temp" / "capture.json"

            def checked_open(path, *args, **kwargs):
                if path == output:
                    self.assertTrue(closed, "Output must not be opened until the handle is closed")
                return original_open(path, *args, **kwargs)

            data = {"towers": [], "blocks": [], "floors": [], "coverage": {"capturedFloors": 0}}
            with patch.dict(tower.sys.modules, fake_modules), patch.object(tower, "validate_lease"), \
                    patch.object(tower, "preflight", return_value=({}, {})), \
                    patch.object(tower, "sha", return_value=tower.PINS["GameAssembly.dll"]), \
                    patch.object(tower, "collect", side_effect=ValueError("incomplete") if fail else None, return_value=data), \
                    patch.object(Path, "open", checked_open):
                if fail:
                    with self.assertRaisesRegex(ValueError, "incomplete"):
                        tower.capture(Path("support"), Path("layout"), output, Path("lease"))
                    self.assertFalse(output.exists())
                else:
                    self.assertEqual(tower.capture(Path("support"), Path("layout"), output, Path("lease")), {"capturedFloors": 0})
                    self.assertEqual(json.loads(output.read_text())["floors"], [])
                    with self.assertRaisesRegex(ValueError, "new ignored"):
                        tower.capture(Path("support"), Path("layout"), output, Path("lease"))
            self.assertEqual(closed, [True])


if __name__ == "__main__":
    unittest.main()
