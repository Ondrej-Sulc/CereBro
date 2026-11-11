"""Portable synthetic-only checks. No game files, processes, HTTP or Win32 imports."""
import contextlib
import copy
import ctypes
from ctypes import wintypes
from datetime import datetime, timedelta, timezone
import io
import json
from pathlib import Path
import struct
import sys
from tempfile import TemporaryDirectory
import types
import unittest
from unittest.mock import patch

import capture_public_resource_metadata as reader


class SyntheticMemory:
    def __init__(self):
        self.values, self.payloads, self.classes, self.texts = {}, {}, {}, {}
        self.touches, self.read_calls = [], []
        self.counts = {}
        self.next = 0x100000
        self.reads = self.bytes = 0
        self.h, self.closed = 123, False

    def object(self, kind):
        self.next += 0x1000
        self.classes[self.next] = kind
        return self.next

    def text(self, value):
        if value is None:
            return 0
        pointer = self.object("String")
        self.texts[pointer] = value
        self.values[pointer + 16] = len(value)
        self.payloads[pointer + 20] = value.encode("utf-16-le")
        return pointer

    def value(self, address):
        self.touches.append(address)
        self.counts[address] = self.counts.get(address, 0) + 1
        result = self.values[address]
        return result(self.counts[address]) if callable(result) else result

    ptr = value
    i32 = value

    def read(self, address, size):
        self.read_calls.append((address, size))
        data = self.payloads[address]
        if len(data) != size:
            raise ValueError("Synthetic read size mismatch")
        self.reads += 1
        self.bytes += size
        return data

    def string(self, pointer):
        self.touches.append(pointer)
        return self.texts[pointer] if pointer else None

    def klass_name(self, pointer):
        self.touches.append(pointer)
        return self.classes[pointer]

    def close(self):
        self.closed = True
        self.h = None


def graph(ids=reader.IDS, unmatched=True):
    m = SyntheticMemory()
    m.base = 0x180000000
    m.hub = m.object("SparxHub")
    m.manager = m.object("ResourcesManager")
    m.status = m.object("ResourcesStatus")
    m.resource_list = m.object("List`1")
    m.array = m.object("ResourcesType[]")
    klass, static = m.object("class"), m.object("static")
    m.static = static
    m.values.update({m.base + reader.BOOTSTRAP["HubTypeInfoRva"]: klass, klass + 184: static,
                     static + 8: m.hub, m.hub + 376: m.manager, m.manager + 40: m.status,
                     m.status + 16: m.resource_list, m.resource_list + 16: m.array})
    m.resources, m.unmatched = [], []
    for name in (["unrequested_public_type"] if unmatched else []) + list(ids):
        pointer = m.object("ResourcesType")
        m.values[pointer + 16] = m.text(name)
        m.resources.append(pointer)
        if name not in reader.IDS:
            m.unmatched.append(pointer)
            # No other fields exist. An accidental extra read fails immediately.
            continue
        m.values[pointer + 32] = m.text("Exact label for " + name)
        m.values[pointer + 40] = m.text(None if name == "sp" else "Exact description")
        m.values[pointer + 216] = m.text("resources/native_" + name)
    count = len(m.resources)
    m.values.update({m.resource_list + 24: count, m.resource_list + 28: 7, m.array + 24: count})
    m.payloads[m.array + 32] = struct.pack("<" + "Q" * count, *m.resources)
    return m


class ScopeTests(unittest.TestCase):
    def test_all_seven_exact_ids_and_only_four_output_strings(self):
        memory = graph()
        rows = reader.ResourceReader(memory).read(memory.base)
        self.assertEqual([row["id"] for row in rows], list(reader.IDS))
        self.assertTrue(all(set(row) == {"id", "name", "description", "iconTexture"} for row in rows))
        self.assertEqual(next(row for row in rows if row["id"] == "sp")["description"], None)
        self.assertNotIn("unrequested_public_type", json.dumps(rows))
        for pointer in memory.unmatched:
            self.assertIn(pointer + 16, memory.touches)
            for offset in (32, 40, 120, 168, 176, 184, 192, 216):
                self.assertNotIn(pointer + offset, memory.touches)
        for pointer in memory.resources:
            for offset in (120, 128, 144, 148, 152, 156, 160, 168, 176, 184, 192, 224, 232):
                self.assertNotIn(pointer + offset, memory.touches)

    def test_missing_and_empty_resources_preserve_absence_without_fallback_names(self):
        memory = graph(ids=("sp",), unmatched=False)
        resource = memory.resources[0]
        memory.values[resource + 32] = memory.text("")
        rows = reader.ResourceReader(memory).read(memory.base)
        self.assertEqual(rows, [{"id": "sp", "name": "", "description": None, "iconTexture": "resources/native_sp"}])
        empty = graph(ids=(), unmatched=False)
        self.assertEqual(reader.ResourceReader(empty).read(empty.base), [])

    def test_list_array_count_version_capacity_and_structural_pointers_checked_at_end(self):
        for member in ("array", "count", "version", "capacity", "list", "status", "manager", "hub"):
            with self.subTest(member=member):
                m = graph()
                locations = {"array": (m.resource_list + 16, m.array, m.object("ResourcesType[]")),
                             "count": (m.resource_list + 24, len(m.resources), len(m.resources) - 1),
                             "version": (m.resource_list + 28, 7, 8),
                             "capacity": (m.array + 24, len(m.resources), len(m.resources) + 1),
                             "list": (m.status + 16, m.resource_list, m.object("List`1")),
                             "status": (m.manager + 40, m.status, m.object("ResourcesStatus")),
                             "manager": (m.hub + 376, m.manager, m.object("ResourcesManager")),
                             "hub": (m.static + 8, m.hub, m.object("SparxHub"))}
                address, first, second = locations[member]
                if member == "array":
                    m.values[second + 24] = len(m.resources)
                m.values[address] = lambda count, a=first, b=second: a if count == 1 else b
                with self.assertRaises(ValueError): reader.ResourceReader(m).read(m.base)

    def test_oversized_list_duplicate_identity_and_changed_name_rejected(self):
        memory = graph()
        memory.values[memory.resource_list + 24] = 513
        with self.assertRaises(ValueError): reader.ResourceReader(memory).read(memory.base)
        memory = graph(ids=("sp", "sp"), unmatched=False)
        with self.assertRaisesRegex(ValueError, "Duplicate"): reader.ResourceReader(memory).read(memory.base)
        memory = graph(ids=("sp",), unmatched=False)
        address = memory.resources[0] + 16
        original = memory.values[address]
        different = memory.text("sp-max")
        memory.values[address] = lambda count: original if count == 1 else different
        with self.assertRaisesRegex(ValueError, "identity changed"): reader.ResourceReader(memory).read(memory.base)

    def test_forbidden_fields_fail_before_any_read(self):
        memory = SyntheticMemory()
        for kind, field in [("EB.Sparx.ResourcesType", name) for name in ["_Amount", "LastReportedAmount", "<Max>k__BackingField", "growthAmountBuffs", "<SpendRestricted>k__BackingField"]] + [("EB.Sparx.ResourcesManager", "_api")]:
            with self.subTest(field=field), self.assertRaises(KeyError):
                reader.ResourceReader(memory).field(0x200000, kind, field)
        self.assertEqual(memory.touches, [])

    def test_icon_strings_are_verbatim_but_query_credentials_are_excluded(self):
        for value in [None, "", "resources/exact", "https://kabam-marvel.shared.mcoc-cdn.net/exact.png", "native_prefix/exact"]:
            reader.validate_icon_text(value)
        for value in ["x?token=secret", "x%3ftoken=secret", "https://user:secret@host/x", "x#fragment", "x\x00"]:
            with self.subTest(value=value), self.assertRaises(ValueError): reader.validate_icon_text(value)

    def test_named_layout_bindings_fail_closed_on_field_drift(self):
        layout = {"types": {kind: {"fields": [{"name": name, "type": spec[0], "offset": spec[1], "static": False} for name, spec in fields.items()]} for kind, fields in reader.FIELDS.items()}}
        reader.validate_layout(layout)
        for field, value in [("offset", 168), ("static", True), ("type", "long")]:
            changed = copy.deepcopy(layout)
            changed["types"]["EB.Sparx.ResourcesType"]["fields"][0][field] = value
            with self.assertRaises(ValueError): reader.validate_layout(changed)


class GateTests(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.acquisition = self.root / "acquisition"
        self.acquisition.mkdir()
        patcher = patch.object(reader, "ACQUISITION", self.acquisition)
        patcher.start(); self.addCleanup(patcher.stop)
        self.pins = {"synthetic-helper": "offline-only"}
        self.contract = reader.contract(self.pins)
        self.now = datetime.now(timezone.utc)
        self.lease = {"format": reader.LEASE_FORMAT, "owner": reader.OWNER, "grantedByRoot": True,
            **{key: self.contract[key] for key in ("readerSha256", "scopeSha256", "layoutSha256", "nativeProofSha256", "allowlistSha256", "idsSha256", "executablePins", "supportPins")},
            "allowedIds": list(reader.IDS), "limits": reader.LIMITS,
            "processId": 123, "processCreationFileTime": "134387927708255910",
            "rootReadinessEvidence": "SYNTHETIC TEST ONLY; no actual client observation or grant",
            "grantedAt": (self.now - timedelta(seconds=1)).isoformat(),
            "expiresAt": (self.now + timedelta(seconds=60)).isoformat()}
        self.path = self.acquisition / "synthetic-lease.json"

    def save(self, bom=False):
        self.path.write_text(json.dumps(self.lease), encoding="utf-8-sig" if bom else "utf-8")

    def test_exact_lease_and_utf8_bom_accepted_offline(self):
        for bom in (False, True):
            self.save(bom)
            self.assertEqual(reader.validate_lease(self.path, self.contract, self.now), self.lease)

    def test_old_scope_or_any_exact_pin_change_rejected(self):
        mutations = {"format": "cerebro.public-reward-definitions-lease.v2", "owner": "quest-tower-public-reward-definitions", "grantedByRoot": False,
                     "allowedIds": ["xp"], "limits": {}, "readerSha256": "other", "scopeSha256": "other", "layoutSha256": "other", "nativeProofSha256": "other", "allowlistSha256": "other", "idsSha256": "other", "executablePins": {}, "supportPins": {}, "processId": True, "processCreationFileTime": "18446744073709551616", "rootReadinessEvidence": ""}
        for field, value in mutations.items():
            with self.subTest(field=field):
                original = self.lease[field]; self.lease[field] = value; self.save()
                with self.assertRaises(ValueError): reader.validate_lease(self.path, self.contract, self.now)
                self.lease[field] = original

    def test_time_window_future_expired_naive_or_over_three_minutes_rejected(self):
        for start, end in [(self.now, self.now), (self.now + timedelta(seconds=1), self.now + timedelta(seconds=30)),
                           (self.now, self.now + timedelta(seconds=181)), (self.now.replace(tzinfo=None), self.now.replace(tzinfo=None) + timedelta(seconds=60))]:
            self.lease.update(grantedAt=start.isoformat(), expiresAt=end.isoformat()); self.save()
            with self.assertRaises(ValueError): reader.validate_lease(self.path, self.contract, self.now)

    def test_parent_lease_output_escape_and_overwrite_rejected(self):
        self.save()
        with self.assertRaises(ValueError): reader.validate_lease(self.root / "old-lease.json", self.contract, self.now)
        with self.assertRaises(ValueError): reader.append_output(self.root / "outside.json", {})
        output = self.acquisition / "immutable.json"
        reader.append_output(output, {"first": True})
        with self.assertRaises(FileExistsError): reader.append_output(output, {"second": True})
        self.assertEqual(json.loads(output.read_text()), {"first": True})

    def test_invalid_lease_denied_before_live_import_or_handle(self):
        self.lease["grantedByRoot"] = False; self.save()
        with patch.object(reader, "validate_inputs", return_value=self.pins), patch.object(reader, "load_support") as loader:
            with self.assertRaisesRegex(ValueError, "disabled"): reader.capture(self.path, self.acquisition / "never.json")
            loader.assert_not_called()

    def test_default_cli_is_offline_and_does_not_import_live_support(self):
        with patch.object(sys, "argv", ["capture_public_resource_metadata.py"]), patch.object(reader, "validate_inputs", return_value=self.pins), patch.object(reader, "load_support") as loader:
            output = io.StringIO()
            with contextlib.redirect_stdout(output): reader.main()
            self.assertFalse(json.loads(output.getvalue())["processAccess"])
            loader.assert_not_called()

    def test_read_byte_wall_clock_string_block_and_expiry_budgets(self):
        expires = (self.now + timedelta(seconds=60)).isoformat()
        with patch.object(reader.time, "monotonic", return_value=100):
            reader.check_budget(0, 0, 1, 100, expires)
            reader.check_budget(20000, 2097152, 0, 100, expires, final=True)
            for args in [(20000, 0, 1, 100, expires), (0, 2097152, 1, 100, expires),
                         (0, 0, 1, 80, expires), (0, 0, 16385, 100, expires), (0, 0, 0, 100, expires),
                         (0, 0, 1, 100, (self.now - timedelta(seconds=1)).isoformat())]:
                with self.subTest(args=args), self.assertRaises(ValueError): reader.check_budget(*args)

    @contextlib.contextmanager
    def fake_live(self, memory=None):
        source, instances = memory or graph(), []
        class FakeLiveMemory(SyntheticMemory):
            def __init__(self, pid):
                self.__dict__.update(copy.deepcopy(source.__dict__))
                self.pid = pid
                instances.append(self)
        helper = types.SimpleNamespace(Memory=FakeLiveMemory)
        with patch.object(reader, "validate_inputs", return_value=self.pins), patch.object(reader, "load_support", return_value=helper) as loader, \
                patch.object(reader, "process_identity") as identity, patch.object(reader, "process_module", return_value={"base": source.base}) as module:
            yield instances, loader, identity, module

    def test_capture_synthetic_only_outputs_seven_and_closes_handle(self):
        self.save(bom=True)
        output = self.acquisition / "synthetic-public.json"
        with self.fake_live() as (instances, _, identity, module):
            result = reader.capture(self.path, output)
            self.assertEqual(result["resolved"], 7)
            self.assertTrue(instances[0].closed)
            identity.assert_called_once(); module.assert_called_once_with(unittest.mock.ANY, 123)
        document = json.loads(output.read_text())
        self.assertEqual(document["missingIds"], [])
        self.assertNotIn("unrequested_public_type", output.read_text())
        self.assertEqual(document["source"]["scopeSha256"], self.contract["scopeSha256"])

    def test_identity_or_binary_gate_failure_closes_before_any_memory_read(self):
        self.save()
        for gate in ("identity", "module"):
            with self.subTest(gate=gate), self.fake_live() as (instances, _, identity, module):
                (identity if gate == "identity" else module).side_effect = ValueError("synthetic gate failure")
                with self.assertRaises(ValueError): reader.capture(self.path, self.acquisition / "never.json")
                self.assertTrue(instances[0].closed)
                self.assertEqual(instances[0].read_calls, [])

    def test_string_limit_and_list_mutation_abort_without_output_and_close(self):
        self.save()
        for failure in ("long-string", "list-mutation"):
            source = graph()
            if failure == "long-string":
                string = source.values[source.resources[0] + 16]
                source.values[string + 16] = 8193
            else:
                source.values[source.resource_list + 28] = lambda count: 7 if count == 1 else 8
            with self.subTest(failure=failure), self.fake_live(source) as (instances, _, _, _):
                with self.assertRaises(ValueError): reader.capture(self.path, self.acquisition / "never.json")
                self.assertTrue(instances[0].closed)
                self.assertFalse((self.acquisition / "never.json").exists())
                if failure == "long-string": self.assertNotIn((string + 20, 8193 * 2), instances[0].read_calls)

    def test_lease_revocation_before_first_read_still_closes(self):
        self.save()
        with self.fake_live() as (instances, _, identity, _):
            def revoke(*args):
                self.lease["grantedByRoot"] = False; self.save()
            identity.side_effect = revoke
            with self.assertRaises(ValueError): reader.capture(self.path, self.acquisition / "never.json")
            self.assertTrue(instances[0].closed)
            self.assertEqual(instances[0].read_calls, [])


class CallableStub:
    """Writable ctypes-like callable, with no OS implementation behind it."""
    def __init__(self, implementation):
        self.implementation, self.calls = implementation, []

    def __call__(self, *args):
        self.calls.append(args)
        return self.implementation(*args)


class NativeIdentityGateTests(unittest.TestCase):
    def helper(self, created=134387927708255910, executable="C:/synthetic/Champions.exe"):
        def times(handle, creation, exit_time, kernel_time, user_time):
            creation._obj.dwLowDateTime = created & 0xFFFFFFFF
            creation._obj.dwHighDateTime = created >> 32
            return True
        def image(handle, flags, buffer, length):
            buffer.value = executable
            length._obj.value = len(executable)
            return True
        kernel = types.SimpleNamespace(GetProcessTimes=CallableStub(times), QueryFullProcessImageNameW=CallableStub(image))
        return types.SimpleNamespace(C=ctypes, W=wintypes, K=kernel)

    def test_actual_identity_gate_checks_creation_and_exact_executable_bytes(self):
        helper = self.helper()
        with patch.object(reader, "sha", return_value=reader.EXECUTABLE_PINS["Champions.exe"]) as hasher:
            reader.process_identity(helper, 123, {"processCreationFileTime": "134387927708255910"})
            hasher.assert_called_once_with(Path("C:/synthetic/Champions.exe"))
        self.assertEqual(len(helper.K.GetProcessTimes.calls), 1)
        self.assertEqual(len(helper.K.QueryFullProcessImageNameW.calls), 1)

    def test_pid_reuse_wrong_executable_name_and_wrong_bytes_fail_closed(self):
        helper = self.helper(created=134387927708255911)
        with patch.object(reader, "sha") as hasher, self.assertRaisesRegex(ValueError, "FILETIME"):
            reader.process_identity(helper, 123, {"processCreationFileTime": "134387927708255910"})
        hasher.assert_not_called()
        self.assertEqual(helper.K.QueryFullProcessImageNameW.calls, [])
        for name, digest in [("C:/synthetic/Other.exe", reader.EXECUTABLE_PINS["Champions.exe"]),
                             ("C:/synthetic/Champions.exe", "different")]:
            with self.subTest(name=name), patch.object(reader, "sha", return_value=digest), self.assertRaisesRegex(ValueError, "executable"):
                reader.process_identity(self.helper(executable=name), 123, {"processCreationFileTime": "134387927708255910"})

    def test_only_leased_pid_module_enumeration_and_snapshot_close(self):
        class Module(ctypes.Structure):
            _fields_ = [("dwSize", wintypes.DWORD), ("modBaseAddr", ctypes.c_void_p),
                        ("szModule", wintypes.WCHAR * 260), ("szExePath", wintypes.WCHAR * 260)]
        def first(handle, row):
            row._obj.modBaseAddr = 0x180000000
            row._obj.szModule = "GameAssembly.dll"
            row._obj.szExePath = "C:/synthetic/GameAssembly.dll"
            return True
        for digest in [reader.EXECUTABLE_PINS["GameAssembly.dll"], "different"]:
            kernel = types.SimpleNamespace(CreateToolhelp32Snapshot=CallableStub(lambda flags, pid: 777),
                Module32FirstW=CallableStub(first), Module32NextW=CallableStub(lambda *args: False),
                CloseHandle=CallableStub(lambda handle: True))
            helper = types.SimpleNamespace(C=ctypes, K=kernel, MODULE=Module)
            with patch.object(reader, "sha", return_value=digest):
                if digest == "different":
                    with self.assertRaisesRegex(ValueError, "GameAssembly"): reader.process_module(helper, 123)
                else:
                    self.assertEqual(reader.process_module(helper, 123), {"base": 0x180000000, "path": "C:/synthetic/GameAssembly.dll"})
            self.assertEqual(kernel.CreateToolhelp32Snapshot.calls, [(0x18, 123)])
            self.assertEqual(kernel.CloseHandle.calls, [(777,)])


if __name__ == "__main__": unittest.main()
