"""Separate opt-in seven-ID public resource string reader; default is OFFLINE.

Structural Hub/manager/status/list traversal only. Name is read first; only a
matched resource's LocalizedName/LocalizedDescription/IconTexture may follow.
No amount/limit/buff/ownership/status values, game calls, sessions or HTTP.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import struct
import time
import types
from urllib.parse import unquote

REPO = Path(__file__).resolve().parents[2]
INVESTIGATION = REPO / "temp/quest-explorer-review/reward-resource-definition-investigation-20261110"
ACQUISITION = INVESTIGATION / "acquisition"
ALLOWLIST = REPO / "temp/quest-explorer-review/reward-completeness-20261110/missing-public-reward-ids.json"
SUPPORT = Path("C:/Code/CereBro/temp/quest-data-investigation/game-only/read_memory.py")
GAME_ROOT = Path("C:/Games/Marvel Contest of Champions/default/game")
OWNER = "quest-tower-public-resource-metadata"
LEASE_FORMAT = "cerebro.public-resource-metadata-lease.v1"
IDS = ("eod2026_doomscrip", "essentia_currency", "mysterium", "sp", "sp-max",
       "tower_challenge_energy", "tower_energy")
LIMITS = {"maxSeconds": 20, "maxReads": 20000, "maxBytes": 2 * 1024 * 1024,
          "maxTypeEntries": 512, "maxStringChars": 8192}
MAX_LEASE_SECONDS = 180
EXECUTABLE_PINS = {
    "Champions.exe": "4dafab2c11cdf9f0aebb74faf666f3c16c15421c8658c754afe258f23c6d4498",
    "GameAssembly.dll": "01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb",
}
FIELDS = {
    "EB.Sparx.Hub": {"<ResourcesManager>k__BackingField": ("EB.Sparx.ResourcesManager", 376)},
    "EB.Sparx.ResourcesManager": {"_status": ("EB.Sparx.ResourcesStatus", 40)},
    "EB.Sparx.ResourcesStatus": {"<Types>k__BackingField": ("System.Collections.Generic.List`1<EB.Sparx.ResourcesType>", 16)},
    "EB.Sparx.ResourcesType": {"<Name>k__BackingField": ("string", 16),
        "<LocalizedName>k__BackingField": ("string", 32),
        "<LocalizedDescription>k__BackingField": ("string", 40),
        "<IconTexture>k__BackingField": ("string", 216)},
}
BOOTSTRAP = {"HubTypeInfoRva": 0x6182EC8, "staticFieldsOffset": 184, "instanceOffset": 8}
CONTAINERS = {"list": {"array": 16, "count": 24, "version": 28},
              "array": {"length": 24, "data": 32, "pointerStride": 8},
              "string": {"length": 16, "data": 20},
              "object": {"klass": 0, "className": 16, "classNameBytes": 160}}
INPUTS = {
    "allowlist": (ALLOWLIST, "2cfac5db2ba5788fc0411b3b12634a16eeeb43feeaeff38fdb5f4ee79f558b39"),
    "layout": (INVESTIGATION / "layouts.json", "a37071c661b5966d992241c1cc1c833695f592383135c6a9badd96e00bcc82d3"),
    "native-proof": (INVESTIGATION / "native-resource-metadata-proof.json", "357b936abbeb46d7e67c471e6414403ba95eee23411568a0616cd9b09aa2b996"),
    "bootstrap-proof": (REPO / "temp/quest-explorer-review/reward-definition-reader-20261110/named-native-proof.json", "5fb10a789442ff377721c0d4693a073464ff74e888c9f3bd4ad2c1610c9b8b6e"),
    "read_memory.py": (SUPPORT, "edd46c2014f0e35bf819e992411dface976195fb7ec70eb3181bc08cc063ddac"),
}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def read_json(path):
    # Root's PowerShell can emit a UTF-8 BOM. Accept it as encoding, never as a
    # bypass of any raw-byte support/source pin or lease identity requirement.
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def validate_layout(layout):
    for kind, names in FIELDS.items():
        for name, (field_type, offset) in names.items():
            matches = [f for f in layout["types"][kind]["fields"] if f["name"] == name]
            if len(matches) != 1 or matches[0]["static"] or matches[0]["type"] != field_type or matches[0]["offset"] != offset:
                raise ValueError("Exact public field binding drift: " + kind + "." + name)


def validate_inputs():
    pins = dict(EXECUTABLE_PINS)
    for name, (path, expected) in INPUTS.items():
        if sha(path) != expected:
            raise ValueError("Pinned offline input drift: " + name)
        pins[name] = expected
    allowlist = read_json(ALLOWLIST)
    if allowlist.get("format") != "cerebro.public-reward-artwork-allowlist.v1" or allowlist["targets"]["res"] != list(IDS):
        raise ValueError("The exact seven public resource IDs changed")
    layout = read_json(INPUTS["layout"][0])
    validate_layout(layout)
    for key in ("layout", "native-proof", "bootstrap-proof"):
        document = read_json(INPUTS[key][0])
        for source in document.get("sources", []) + document.get("metadataSources", []):
            if sha(source["path"]) != source["sha256"]:
                raise ValueError("Named metadata/native code source drift")
            name = Path(source["path"]).name
            if name in pins and pins[name] != source["sha256"]:
                raise ValueError("Conflicting named source pin")
            pins[name] = source["sha256"]
    if read_json(INPUTS["native-proof"][0])["layoutSha256"] != INPUTS["layout"][1]:
        raise ValueError("Native proof/layout mismatch")
    # Files only; no process enumeration, handle, import of Win32 support or game call.
    for name, expected in EXECUTABLE_PINS.items():
        if sha(GAME_ROOT / name) != expected:
            raise ValueError("Offline executable bytes drifted: " + name)
    return pins


def contract(pins):
    scope = {"owner": OWNER, "allowedIds": list(IDS), "fields": FIELDS,
             "bootstrap": BOOTSTRAP, "containers": CONTAINERS, "limits": LIMITS,
             "maxSingleReadBytes": LIMITS["maxStringChars"] * 2,
             "maxLeaseSeconds": MAX_LEASE_SECONDS,
             "access": "Only structural pointers/list headers and public Name; only matched IDs permit the other three public strings. No status numeric/account fields or getters/invokes/session/HTTP.",
             "stability": "Recheck root instance, Hub.manager, manager.status, status.Types and list array/count/version/capacity after the complete metadata scan.",
             "outputFields": ["id", "name", "description", "iconTexture"],
             "rendering": "Raw metadata only. sp default-tag art remains the separately proved fixed native GetTexture mapping; never replace it with this IconTexture field."}
    return {"format": "cerebro.public-resource-metadata-contract.v1", "scope": scope,
            "readerSha256": sha(__file__), "scopeSha256": digest(scope),
            "layoutSha256": INPUTS["layout"][1], "nativeProofSha256": INPUTS["native-proof"][1],
            "allowlistSha256": INPUTS["allowlist"][1], "idsSha256": digest(list(IDS)),
            "executablePins": EXECUTABLE_PINS, "supportPins": pins,
            "processAccess": False, "captureExecuted": False}


def inside_acquisition(path):
    path = Path(path)
    if not path.resolve().is_relative_to(ACQUISITION.resolve()):
        raise ValueError("Lease and output must stay in this separate ignored acquisition directory")
    return path


def append_output(path, document):
    path = inside_acquisition(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def validate_lease(path, expected, now=None):
    lease = read_json(inside_acquisition(path))
    if lease.get("format") != LEASE_FORMAT or lease.get("owner") != OWNER or lease.get("grantedByRoot") is not True:
        raise ValueError("Capture disabled: a separate explicit root resource-metadata lease is required")
    for field in ("readerSha256", "scopeSha256", "layoutSha256", "nativeProofSha256", "allowlistSha256", "idsSha256", "executablePins", "supportPins"):
        if lease.get(field) != expected[field]:
            raise ValueError("Exact root lease pin mismatch: " + field)
    if lease.get("allowedIds") != list(IDS) or lease.get("limits") != LIMITS:
        raise ValueError("Root resource ID scope or budget mismatch")
    if type(lease.get("processId")) is not int or lease["processId"] <= 0:
        raise ValueError("Exact process ID required")
    created = lease.get("processCreationFileTime")
    if type(created) not in (int, str) or not re.fullmatch(r"[1-9][0-9]{0,19}", str(created)) or int(created) > (1 << 64) - 1:
        raise ValueError("Exact 64-bit process creation FILETIME required")
    if not isinstance(lease.get("rootReadinessEvidence"), str) or not lease["rootReadinessEvidence"].strip():
        raise ValueError("Independent root readiness evidence required")
    try:
        start, end = datetime.fromisoformat(lease["grantedAt"]), datetime.fromisoformat(lease["expiresAt"])
        if start.utcoffset() is None or end.utcoffset() is None:
            raise ValueError("Lease timestamps require timezone")
        current = now or datetime.now(timezone.utc)
        if not (start <= current < end and timedelta(0) < end - start <= timedelta(seconds=MAX_LEASE_SECONDS)):
            raise ValueError("Lease expired, future or longer than three minutes")
    except (KeyError, TypeError) as error:
        raise ValueError("Invalid root lease timestamps") from error
    return lease


def check_budget(reads, byte_count, size, started, expires_at, final=False):
    valid_size = size == 0 if final else type(size) is int and 0 < size <= LIMITS["maxStringChars"] * 2
    if (not valid_size or reads + (0 if final else 1) > LIMITS["maxReads"]
            or byte_count + size > LIMITS["maxBytes"]
            or time.monotonic() - started >= LIMITS["maxSeconds"]
            or datetime.now(timezone.utc) >= datetime.fromisoformat(expires_at)):
        raise ValueError("Public resource metadata read budget exhausted")


def validate_icon_text(value):
    if value is None:
        return
    decoded = unquote(value)
    authority = re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://([^/\\]*)", decoded)
    if any(ord(c) < 32 or ord(c) == 127 for c in decoded) or any(c in decoded for c in "?#") or (authority and "@" in authority[1]):
        raise ValueError("Public icon metadata contains excluded query/control/credential text")


class ResourceReader:
    def __init__(self, memory):
        self.memory = memory

    def identity(self, pointer, kind):
        if not pointer or self.memory.klass_name(pointer) != kind:
            raise ValueError("Public structural/definition type mismatch: " + kind)
        return pointer

    def field(self, pointer, kind, name):
        field_type, offset = FIELDS[kind][name]  # Unapproved fields fail before reading.
        value = self.memory.ptr(pointer + offset)
        return self.memory.string(value) if field_type == "string" else value

    def hub(self, base):
        klass = self.memory.ptr(base + BOOTSTRAP["HubTypeInfoRva"])
        static = self.memory.ptr(klass + BOOTSTRAP["staticFieldsOffset"])
        return self.identity(self.memory.ptr(static + BOOTSTRAP["instanceOffset"]), "SparxHub")

    def list_state(self, pointer):
        m = self.memory
        array, count, version = m.ptr(pointer + 16), m.i32(pointer + 24), m.i32(pointer + 28)
        if not 0 <= count <= LIMITS["maxTypeEntries"]:
            raise ValueError("Public resource type list exceeds finite bounds")
        capacity = m.ptr(array + 24) if array else 0
        if not count <= capacity <= LIMITS["maxTypeEntries"]:
            raise ValueError("Public resource type list capacity mismatch")
        return array, count, version, capacity

    def read(self, base):
        m = self.memory
        hub = self.hub(base)
        manager = self.identity(self.field(hub, "EB.Sparx.Hub", "<ResourcesManager>k__BackingField"), "ResourcesManager")
        status = self.identity(self.field(manager, "EB.Sparx.ResourcesManager", "_status"), "ResourcesStatus")
        resource_list = self.identity(self.field(status, "EB.Sparx.ResourcesStatus", "<Types>k__BackingField"), "List`1")
        initial = self.list_state(resource_list)
        array, count, _, _ = initial
        pointers = struct.unpack("<" + "Q" * count, m.read(array + 32, count * 8)) if count else ()
        rows = {}
        for pointer in pointers:
            self.identity(pointer, "ResourcesType")
            name = self.field(pointer, "EB.Sparx.ResourcesType", "<Name>k__BackingField")
            if name not in IDS:
                continue
            if name in rows:
                raise ValueError("Duplicate matched public resource identity")
            row = {"id": name,
                   "name": self.field(pointer, "EB.Sparx.ResourcesType", "<LocalizedName>k__BackingField"),
                   "description": self.field(pointer, "EB.Sparx.ResourcesType", "<LocalizedDescription>k__BackingField"),
                   "iconTexture": self.field(pointer, "EB.Sparx.ResourcesType", "<IconTexture>k__BackingField")}
            validate_icon_text(row["iconTexture"])
            if self.field(pointer, "EB.Sparx.ResourcesType", "<Name>k__BackingField") != name:
                raise ValueError("Public resource identity changed during read")
            rows[name] = row
        if (self.list_state(resource_list) != initial
                or self.field(status, "EB.Sparx.ResourcesStatus", "<Types>k__BackingField") != resource_list
                or self.field(manager, "EB.Sparx.ResourcesManager", "_status") != status
                or self.field(hub, "EB.Sparx.Hub", "<ResourcesManager>k__BackingField") != manager
                or self.hub(base) != hub):
            raise ValueError("Public resource structural list/pointer/count/version changed")
        return [rows[name] for name in sorted(rows)]


def load_support():
    raw = SUPPORT.read_bytes()
    if hashlib.sha256(raw).hexdigest() != INPUTS["read_memory.py"][1]:
        raise ValueError("Public read helper drift before import")
    module = types.ModuleType("_public_resource_metadata_memory")
    module.__file__ = str(SUPPORT)
    exec(compile(raw, str(SUPPORT), "exec"), module.__dict__)
    return module


def process_identity(helper, handle, lease):
    c, w, kernel = helper.C, helper.W, helper.K
    kernel.GetProcessTimes.argtypes = [w.HANDLE] + [c.POINTER(w.FILETIME)] * 4
    kernel.GetProcessTimes.restype = w.BOOL
    values = [w.FILETIME() for _ in range(4)]
    if not kernel.GetProcessTimes(handle, *(c.byref(v) for v in values)):
        raise c.WinError(c.get_last_error())
    created = values[0].dwLowDateTime | values[0].dwHighDateTime << 32
    if str(created) != str(lease["processCreationFileTime"]):
        raise ValueError("Leased process creation FILETIME mismatch/PID reused")
    kernel.QueryFullProcessImageNameW.argtypes = [w.HANDLE, w.DWORD, w.LPWSTR, c.POINTER(w.DWORD)]
    kernel.QueryFullProcessImageNameW.restype = w.BOOL
    buffer, length = c.create_unicode_buffer(32768), w.DWORD(32768)
    if not kernel.QueryFullProcessImageNameW(handle, 0, buffer, c.byref(length)):
        raise c.WinError(c.get_last_error())
    if Path(buffer.value).name.lower() != "champions.exe" or sha(Path(buffer.value)) != EXECUTABLE_PINS["Champions.exe"]:
        raise ValueError("Leased executable name or bytes mismatch; no memory read performed")


def process_module(helper, pid):
    # Module enumeration ONLY for this leased PID, after the root lease passes.
    c, kernel = helper.C, helper.K
    snapshot = kernel.CreateToolhelp32Snapshot(0x18, pid)
    if snapshot == c.c_void_p(-1).value:
        raise c.WinError(c.get_last_error())
    row = helper.MODULE(); row.dwSize = c.sizeof(row)
    found, seen = [], 0
    try:
        ok = kernel.Module32FirstW(snapshot, c.byref(row))
        while ok:
            seen += 1
            if seen > 512:
                raise ValueError("Leased module list exceeds bounds")
            if row.szModule.lower() == "gameassembly.dll":
                found.append({"base": row.modBaseAddr, "path": row.szExePath})
            ok = kernel.Module32NextW(snapshot, c.byref(row))
    finally:
        kernel.CloseHandle(snapshot)
    if len(found) != 1 or sha(found[0]["path"]) != EXECUTABLE_PINS["GameAssembly.dll"]:
        raise ValueError("Pinned GameAssembly mismatch; no memory read performed")
    return found[0]


def capture(lease_path, output):
    output = inside_acquisition(output)
    if output.exists():
        raise ValueError("Append-only capture refuses an existing output")
    expected = contract(validate_inputs())
    lease = validate_lease(lease_path, expected)  # Before importing any live support.
    helper = load_support()
    started = time.monotonic()

    class BoundedMemory(helper.Memory):
        def read(self, address, size):
            check_budget(self.reads, self.bytes, size, started, lease["expiresAt"])
            if self.reads % 128 == 0 and validate_lease(lease_path, expected) != lease:
                raise ValueError("Root resource lease changed during capture")
            return super().read(address, size)

        def string(self, pointer):
            if not pointer:
                return None
            if self.klass_name(pointer) != "String":
                raise ValueError("Public resource field is not a managed string")
            length = self.i32(pointer + 16)
            if not 0 <= length <= LIMITS["maxStringChars"]:
                raise ValueError("Public resource string length exceeds bounds")
            return self.read(pointer + 20, length * 2).decode("utf-16-le") if length else ""

    memory = BoundedMemory(lease["processId"])
    try:
        process_identity(helper, memory.h, lease)
        module = process_module(helper, lease["processId"])
        if validate_lease(lease_path, expected) != lease:
            raise ValueError("Root resource lease changed before first memory read")
        rows = ResourceReader(memory).read(module["base"])
        check_budget(memory.reads, memory.bytes, 0, started, lease["expiresAt"], final=True)
        if validate_lease(lease_path, expected) != lease:
            raise ValueError("Root resource lease changed before completion")
        document = {"format": "cerebro.public-resource-metadata.v1",
                    "capturedAt": datetime.now(timezone.utc).isoformat(),
                    "source": {key: expected[key] for key in ("readerSha256", "scopeSha256", "layoutSha256", "nativeProofSha256", "allowlistSha256", "idsSha256", "executablePins", "supportPins")},
                    "definitions": rows, "missingIds": sorted(set(IDS) - {row["id"] for row in rows}),
                    "policy": "Only matched public definition strings; no account/status numeric values. IconTexture is verbatim metadata; sp default-tag rendering uses the separate proved fixed native icon.",
                    "readMetrics": {"calls": memory.reads, "bytes": memory.bytes, "seconds": round(time.monotonic() - started, 3)}}
    finally:
        memory.close()
    if validate_lease(lease_path, expected) != lease:
        raise ValueError("Root resource lease changed before append-only output")
    append_output(output, document)
    return {"output": str(output), "resolved": len(rows), "missing": len(document["missingIds"])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preflight", action="store_true", help="offline default; imports no live support")
    parser.add_argument("--capture", action="store_true", help="requires a NEW exact root resource lease")
    parser.add_argument("--lease", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.capture:
        if args.preflight or not args.lease or not args.out:
            parser.error("Capture requires --lease and --out without --preflight")
        result = capture(args.lease, args.out)
    else:
        if args.lease:
            parser.error("Offline preflight does not consume a lease")
        result = contract(validate_inputs())
        if args.out:
            append_output(args.out, result)
    print(json.dumps(result))


if __name__ == "__main__":
    main()
