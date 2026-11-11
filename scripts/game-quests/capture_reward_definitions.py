"""Finite public reward definitions reader. Default/preflight is strictly offline.

Capture is disabled without a fresh root-issued lease binding this reader, all
inputs, the exact allowlist, PID + creation FILETIME, and bounded read scope.
No process enumeration, game calls, network, inventory or user-state traversal.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import time
from urllib.parse import unquote

REPO = Path(__file__).resolve().parents[2]
ORIGINAL_ARTIFACT = REPO / "temp/quest-explorer-review/reward-definition-reader-20261110"
ARTIFACT = ORIGINAL_ARTIFACT / "revision-2"
ALLOWLIST = REPO / "temp/quest-explorer-review/reward-completeness-20261110/missing-public-reward-ids.json"
SUPPORT = Path("C:/Code/CereBro/temp/quest-data-investigation/game-only/read_memory.py")
GAME_SHA256 = "01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb"
OWNER = "quest-tower-public-reward-definitions"
REVISION = 2
PUBLIC_CDN = "https://kabam-marvel.shared.mcoc-cdn.net/"
URL_PROOF_SHA256 = "a3a50022375fc00adf8a8bdee19f7aada488152e1870d5a63b3d3909edbaa012"
NATIVE_URL_RULES = {"method": "EB.Uri.Combine", "rva": 0x29F0C70,
                    "trimCharacters": "\\/:", "nonemptyJoin": "original-first + '/' + original-second",
                    "addsHost": False, "approvedFetchOrigin": PUBLIC_CDN,
                    "relativeOnS3Output": "native-relative-reference; no invented origin",
                    "proofSha256": URL_PROOF_SHA256}
LIVE_TYPES = ["sra", "profilebadge", "emote", "utitle"]
LIMITS = {"maxReads": 60000, "maxBytes": 8 * 1024 * 1024,
          "maxSeconds": 45, "maxRegistryEntries": 4096, "maxStringChars": 8192}
INPUTS = {
    "selectable-layout": (Path("C:/Code/CereBro/temp/selectable-rewards/layouts.json"),
        "7d322334e4ed8b4da27cac87cfffd06a0a696cea128a31c899496cba86aa9515"),
    "reward-layout": (Path("C:/Code/CereBro/temp/reward-debug/layouts.json"),
        "372031db82e70d0e768ad049f99455e09ff2db39822f91d00fa5d88dfac6088c"),
    "quest-layout": (Path("C:/Code/CereBro/temp/quest-data-investigation/game-only/layouts.json"),
        "d222efe9fd9334aa8095236abd990078470801237dd60897b04798a5b817befa"),
    "definition-layout": (ORIGINAL_ARTIFACT / "layouts.json",
        "33851af9dc9e82ea3577d91ff27427702e6c818f6cfb3ebcb0ce0c172c53f1e9"),
    "native-url-proof": (ARTIFACT / "native-url-proof.json", URL_PROOF_SHA256),
    "read_memory.py": (SUPPORT,
        "edd46c2014f0e35bf819e992411dface976195fb7ec70eb3181bc08cc063ddac"),
}
# Exact names, types and offsets. No object serializer or reflection traversal.
FIELDS = {
    "EB.Sparx.Hub": {
        "<SelectableRewardsManager>k__BackingField": ("EB.Sparx.SelectableRewardsManager", 712),
        "<ProfileBadgesManager>k__BackingField": ("EB.Sparx.ProfileBadgesManager", 472),
        "<UserTitleManager>k__BackingField": ("EB.Sparx.UserTitleManager", 120)},
    "EB.Sparx.SelectableRewardsManager": {"_state": ("EB.Sparx.SelectableRewardsState", 128)},
    "EB.Sparx.SelectableRewardsState": {"<Available>k__BackingField":
        ("System.Collections.Generic.Dictionary`2<string,EB.Sparx.SelectableRewardSet>", 16)},
    "EB.Sparx.SelectableRewardSet": {
        "<SRId>k__BackingField": ("string", 16), "<Name>k__BackingField": ("string", 24),
        "<ActivateRedeemerTooltip>k__BackingField": ("string", 48),
        "<SRAIconPath>k__BackingField": ("string", 96),
        "<SRCIconPath>k__BackingField": ("string", 120),
        "<QuestIconPath>k__BackingField": ("string", 144)},
    "EB.Sparx.ProfileBadgesManager": {
        "<CDN>k__BackingField": ("string", 32),
        "<ProfileBadgeDefinitions>k__BackingField":
            ("System.Collections.Generic.Dictionary`2<string,EB.Sparx.ProfileBadge>", 48)},
    "EB.Sparx.ProfileBadge": {
        "<Id>k__BackingField": ("string", 16), "<Title>k__BackingField": ("string", 24),
        "<Description>k__BackingField": ("string", 32),
        "ImagePath": ("string", 40), "ImageOnS3": ("bool", 48)},
    "EmotesManager": {
        "_emotes": ("System.Collections.Generic.Dictionary`2<string,Emote>", 160),
        "<CDN>k__BackingField": ("string", 184)},
    "Emote": {"_imagePath": ("string", 16), "_imageOnS3": ("bool", 24),
        "<Id>k__BackingField": ("string", 32), "<Title>k__BackingField": ("string", 48)},
    "EB.Sparx.UserTitleManager": {"<TitleData>k__BackingField":
        ("System.Collections.Generic.Dictionary`2<string,EB.Sparx.UserTitleData>", 48)},
    "EB.Sparx.UserTitleData": {
        "<title>k__BackingField": ("string", 16),
        "<description>k__BackingField": ("string", 24),
        "<IconImage>k__BackingField": ("string", 56)},
}
BOOTSTRAPS = {"HubTypeInfoRva": 0x6182EC8, "EmotesManagerTypeInfoRva": 0x60F5A70,
              "staticFieldsOffset": 184, "instanceOffset": 8}
NATIVE_CONSTANTS = {"utitle.GetTexture": 0x60ED750}
CONTAINERS = {"dictionary": {"entries": 24, "count": 32, "free": 40, "version": 44},
              "array": {"length": 24, "data": 32},
              "entry": {"stride": 24, "hash": 0, "key": 8, "value": 16},
              "string": {"length": 16, "data": 20},
              "object": {"klass": 0, "className": 16, "classNameBytes": 160}}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def load_targets(path=ALLOWLIST):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("format") != "cerebro.public-reward-artwork-allowlist.v1":
        raise ValueError("Unreviewed public allowlist format")
    targets = data.get("targets", {})
    if set(targets) != {"sra", "profilebadge", "emote", "utitle", "res"}:
        raise ValueError("Allowlist categories changed")
    for kind, ids in targets.items():
        if not isinstance(ids, list) or ids != sorted(set(ids)) or not ids or len(ids) > 50:
            raise ValueError("Allowlist must be finite, unique and sorted")
        if any(not isinstance(i, str) or not re.fullmatch(r"[a-zA-Z0-9_-]{1,128}", i) for i in ids):
            raise ValueError("Invalid public definition identity")
    if sum(map(len, targets.values())) != data.get("total") or data["total"] > 100:
        raise ValueError("Allowlist size changed")
    return targets


def validate_inputs():
    layouts = []
    pins = {"GameAssembly.dll": GAME_SHA256}
    for key, (path, expected) in INPUTS.items():
        if sha(path) != expected:
            raise ValueError("Pinned offline input drift: " + key)
        pins[key] = expected
        if key.endswith("layout") or key == "native-url-proof":
            layout = json.loads(path.read_text(encoding="utf-8"))
            for source in layout["sources"]:
                if sha(source["path"]) != source["sha256"]:
                    raise ValueError("Named metadata source drift")
                source_key = Path(source["path"]).name
                if source_key in pins and pins[source_key] != source["sha256"]:
                    raise ValueError("Conflicting metadata source")
                pins[source_key] = source["sha256"]
            if key.endswith("layout"):
                layouts.append(layout)
    for kind, fields in FIELDS.items():
        for name, (field_type, offset) in fields.items():
            matches = [f for layout in layouts for f in layout["types"].get(kind, {}).get("fields", [])
                       if f["name"] == name]
            if not matches or any(f["static"] or f["offset"] != offset or f["type"] != field_type for f in matches):
                raise ValueError("Exact named field binding missing: " + kind + "." + name)
    return pins


def contract(targets, pins):
    scope = {"owner": OWNER, "revision": REVISION, "targets": targets, "liveTypes": LIVE_TYPES,
             "fields": FIELDS, "bootstraps": BOOTSTRAPS, "nativeStringConstants": NATIVE_CONSTANTS,
             "nativeUrlRules": NATIVE_URL_RULES,
             "containers": CONTAINERS, "limits": LIMITS,
             "resources": "offline evidence only; runtime ResourcesStatus explicitly excluded"}
    return {"format": "cerebro.public-reward-definitions-contract.v2", "scope": scope,
            "scopeSha256": digest(scope), "readerSha256": sha(__file__), "supportPins": pins,
            "allowlistSha256": sha(ALLOWLIST), "gameAccess": False}


def within_artifact(path):
    if not Path(path).resolve().is_relative_to(ARTIFACT.resolve()):
        raise ValueError("Reader artifacts and lease must stay in its ignored artifact directory")
    return Path(path)


def write_new(path, document):
    path = within_artifact(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def validate_lease(path, expected, now=None):
    lease = json.loads(within_artifact(path).read_text(encoding="utf-8"))
    if (lease.get("format") != "cerebro.public-reward-definitions-lease.v2"
            or lease.get("owner") != OWNER or lease.get("grantedByRoot") is not True):
        raise ValueError("Capture disabled: an explicit new root lease is required")
    for field in ("scopeSha256", "readerSha256", "supportPins", "allowlistSha256"):
        if lease.get(field) != expected[field]:
            raise ValueError("Lease does not bind exact reader/allowlist/layout scope: " + field)
    if lease.get("limits") != LIMITS or lease.get("liveTypes") != LIVE_TYPES:
        raise ValueError("Lease budget or public registry scope mismatch")
    if type(lease.get("processId")) is not int or lease["processId"] <= 0:
        raise ValueError("Exact PID required")
    if not re.fullmatch(r"[1-9][0-9]{0,19}", str(lease.get("processCreationFileTime", ""))):
        raise ValueError("Exact PID creation FILETIME required")
    if not isinstance(lease.get("rootReadinessEvidence"), str) or not lease["rootReadinessEvidence"].strip():
        raise ValueError("Root client-readiness evidence required")
    try:
        start = datetime.fromisoformat(lease["grantedAt"])
        end = datetime.fromisoformat(lease["expiresAt"])
        current = now or datetime.now(timezone.utc)
        if start.utcoffset() is None or end.utcoffset() is None:
            raise ValueError("Lease timestamps must have timezone")
        if not (start <= current < end and timedelta(0) < end - start <= timedelta(minutes=5)):
            raise ValueError("Lease expired, future or exceeds five minutes")
    except (KeyError, TypeError) as error:
        raise ValueError("Invalid lease time window") from error
    return lease


def icon_reference(path, on_s3=None):
    """Preserve native source classification; never infer from an ID or basename."""
    if not path:
        return None
    cdn = PUBLIC_CDN
    if path.startswith(cdn):
        if on_s3 is False:
            raise ValueError("Conflicting native artwork source")
        source, reference = "cdn", path[len(cdn):]
    else:
        source, reference = ("cdn" if on_s3 else "resource"), path
    decoded = unquote(reference)
    if any(c in decoded for c in ":\\?#\x00") or ".." in decoded.split("/") or decoded.startswith("/"):
        raise ValueError("Artwork path is outside public asset-reference scope")
    return {"source": source, "reference": reference}


def validate_image_text(value):
    """Keep native evidence exact while excluding credential/query-bearing text."""
    if value is None:
        return
    if not isinstance(value, str) or len(value) > LIMITS["maxStringChars"]:
        raise ValueError("Invalid public image text")
    decoded = unquote(value)
    authority = re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://([^/\\]*)", decoded)
    if (any(ord(c) < 32 or ord(c) == 127 for c in decoded) or any(c in decoded for c in "?#")
            or (authority and "@" in authority[1])):
        raise ValueError("Public image evidence cannot contain queries, controls or URL credentials")


def interpret_image(value, *, resource_if_relative=False, prefix=False):
    """Interpret separately from the raw field. Unknown art never erases definitions."""
    validate_image_text(value)
    if not value:
        return {"kind": "empty", "icon": None, "fetchablePublicUrl": False}
    try:
        icon = icon_reference(value)
    except ValueError:
        kind = "unapproved-absolute-reference" if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", value) else "unsupported-native-reference"
        return {"kind": kind, "icon": None, "fetchablePublicUrl": False}
    if icon["source"] == "cdn":
        return {"kind": "public-cdn-url", "icon": icon, "fetchablePublicUrl": True}
    if resource_if_relative:
        return {"kind": "resource-path", "icon": icon, "fetchablePublicUrl": False}
    return {"kind": "native-prefix" if prefix else "native-relative-reference",
            "icon": None, "fetchablePublicUrl": False}


def native_uri_combine(first, second):
    """Pinned EB.Uri.Combine, including its use of ORIGINAL nonempty arguments.

    The trim character set is proved by EB.Uri..cctor -> System.IO.Path..cctor
    -> three MonoIO getter thunks and immediate-return code in the pinned PE.
    This is string interpretation only; it performs no URL access or game call.
    """
    first_trimmed = first.rstrip("\\/:") if first else ""
    second_trimmed = second.lstrip("\\/:") if second else ""
    if first_trimmed and second_trimmed:
        return first + "/" + second
    return first_trimmed or second_trimmed


def image_inputs(path, on_s3, cdn):
    if type(on_s3) is not bool:
        raise ValueError("Exact native on-S3 boolean required")
    validate_image_text(path)
    prefix = interpret_image(cdn, prefix=True)
    native_image = native_uri_combine(cdn, path) if on_s3 else path
    interpreted = interpret_image(native_image, resource_if_relative=not on_s3)
    return {"path": path, "onS3": on_s3, "cdn": cdn, "cdnKind": prefix["kind"],
            "nativeImage": native_image, "nativeImageKind": interpreted["kind"],
            "directIcon": interpreted["icon"], "fetchablePublicUrl": interpreted["fetchablePublicUrl"],
            "nativeRule": "EB.Uri.Combine" if on_s3 else "ImagePath passthrough",
            "proofSha256": URL_PROOF_SHA256}


class DefinitionReader:
    """Only exact public fields; unmatched dictionary value pointers are unread."""
    def __init__(self, memory):
        self.memory = memory

    def identity(self, pointer, expected):
        if pointer and self.memory.klass_name(pointer) != expected:
            raise ValueError("Public definition type mismatch: " + expected)
        return pointer

    def field(self, pointer, kind, name):
        field_type, offset = FIELDS[kind][name]  # Unknown fields fail before reading.
        if field_type == "bool":
            raw = self.memory.read(pointer + offset, 1)
            if raw not in (b"\x00", b"\x01"):
                raise ValueError("Invalid native boolean")
            return raw == b"\x01"
        value = self.memory.ptr(pointer + offset)
        return self.memory.string(value) if field_type == "string" else value

    def selected(self, dictionary, ids):
        if not dictionary:
            return {}
        self.identity(dictionary, "Dictionary`2")
        m = self.memory
        entries = m.ptr(dictionary + 24)
        count, free, version = m.i32(dictionary + 32), m.i32(dictionary + 40), m.i32(dictionary + 44)
        if not 0 <= free <= count <= LIMITS["maxRegistryEntries"]:
            raise ValueError("Public registry exceeds bounded layout contract")
        if not count:
            return {}
        if not entries or not count <= m.ptr(entries + 24) <= LIMITS["maxRegistryEntries"]:
            raise ValueError("Public registry array capacity mismatch")
        result = {}
        for i in range(count):
            entry = entries + 32 + i * 24
            if m.i32(entry) < 0:
                continue
            key = m.string(m.ptr(entry + 8))
            if key in ids:
                if key in result:
                    raise ValueError("Duplicate public registry identity")
                result[key] = m.ptr(entry + 16)
        if (m.i32(dictionary + 32), m.i32(dictionary + 44)) != (count, version):
            raise ValueError("Public registry mutated during bounded read")
        return result

    def strings(self, pointer, kind, names):
        return {output: self.field(pointer, kind, native) for output, native in names.items()}


def read_definitions(memory, module_base, targets):
    reader = DefinitionReader(memory)
    def instance(rva, name):
        klass = memory.ptr(module_base + rva)
        if not klass:
            return 0
        static = memory.ptr(klass + 184)
        return reader.identity(memory.ptr(static + 8), name) if static else 0

    hub = instance(BOOTSTRAPS["HubTypeInfoRva"], "SparxHub")
    if not hub:
        raise ValueError("Public Hub instance is not resident")
    result = {key: [] for key in targets}
    # Core selectors and badges run first. No fallback to Active or owned objects.
    for kind, hub_field, manager_class, manager_field, data_class in [
        ("sra", "<SelectableRewardsManager>k__BackingField", "EB.Sparx.SelectableRewardsManager",
         "_state", "EB.Sparx.SelectableRewardSet"),
        ("profilebadge", "<ProfileBadgesManager>k__BackingField", "EB.Sparx.ProfileBadgesManager",
         "<ProfileBadgeDefinitions>k__BackingField", "EB.Sparx.ProfileBadge"),
        ("utitle", "<UserTitleManager>k__BackingField", "EB.Sparx.UserTitleManager",
         "<TitleData>k__BackingField", "EB.Sparx.UserTitleData")]:
        manager = reader.identity(reader.field(hub, "EB.Sparx.Hub", hub_field), manager_class.split(".")[-1])
        if not manager:
            continue
        registry = reader.field(manager, manager_class, manager_field)
        if kind == "sra":
            if not reader.identity(registry, "SelectableRewardsState"):
                continue
            registry = reader.field(registry, "EB.Sparx.SelectableRewardsState", "<Available>k__BackingField")
        for key, pointer in sorted(reader.selected(registry, targets[kind]).items()):
            if not reader.identity(pointer, data_class.split(".")[-1]):
                raise ValueError("Null matched public definition")
            if kind in ("sra", "profilebadge"):
                native_id = "<SRId>k__BackingField" if kind == "sra" else "<Id>k__BackingField"
                if reader.field(pointer, data_class, native_id) != key:
                    raise ValueError("Public reward identity mismatch")
            if kind == "sra":
                row = reader.strings(pointer, data_class, {"name": "<Name>k__BackingField",
                    "description": "<ActivateRedeemerTooltip>k__BackingField",
                    "sraIconPath": "<SRAIconPath>k__BackingField", "srcIconPath": "<SRCIconPath>k__BackingField",
                    "questIconPath": "<QuestIconPath>k__BackingField"})
                row["imageInterpretations"] = {role: interpret_image(row[role + "IconPath"], resource_if_relative=True)
                                               for role in ("sra", "src", "quest")}
                row["icons"] = {role: value["icon"] for role, value in row["imageInterpretations"].items()}
            elif kind == "profilebadge":
                row = reader.strings(pointer, data_class, {"name": "<Title>k__BackingField",
                    "description": "<Description>k__BackingField", "imagePath": "ImagePath"})
                row["imageOnS3"] = reader.field(pointer, data_class, "ImageOnS3")
                row["cdn"] = reader.field(manager, manager_class, "<CDN>k__BackingField")
                row["nativeImageInputs"] = image_inputs(row["imagePath"], row["imageOnS3"], row["cdn"])
            else:
                row = reader.strings(pointer, data_class, {"name": "<title>k__BackingField",
                    "description": "<description>k__BackingField", "iconImage": "<IconImage>k__BackingField"})
                row["definitionImageInterpretation"] = interpret_image(row["iconImage"], resource_if_relative=True)
                row["definitionIcon"] = row["definitionImageInterpretation"]["icon"]
            result[kind].append({"id": key, **row})
    emotes = instance(BOOTSTRAPS["EmotesManagerTypeInfoRva"], "EmotesManager")
    if emotes:
        registry = reader.field(emotes, "EmotesManager", "_emotes")
        for key, pointer in sorted(reader.selected(registry, targets["emote"]).items()):
            if not reader.identity(pointer, "Emote") or reader.field(pointer, "Emote", "<Id>k__BackingField") != key:
                raise ValueError("Public emote identity mismatch")
            row = reader.strings(pointer, "Emote", {"name": "<Title>k__BackingField", "imagePath": "_imagePath"})
            row["imageOnS3"] = reader.field(pointer, "Emote", "_imageOnS3")
            row["cdn"] = reader.field(emotes, "EmotesManager", "<CDN>k__BackingField")
            row["nativeImageInputs"] = image_inputs(row["imagePath"], row["imageOnS3"], row["cdn"])
            result["emote"].append({"id": key, **row})
    # The native title reward mapping returns this single fixed managed literal.
    # Do not initialize it or substitute per-title artwork if not resident.
    title_constant = memory.ptr(module_base + NATIVE_CONSTANTS["utitle.GetTexture"])
    title_icon = None
    if 0x10000 <= title_constant <= 0x7FFFFFFFFFFF and title_constant % 8 == 0:
        try:
            if memory.klass_name(title_constant) == "String":
                title_icon = interpret_image(memory.string(title_constant), resource_if_relative=True)["icon"]
        except OSError:
            pass  # An uninitialized optional literal is never synthesized.
    for row in result["utitle"]:
        row["nativeRedeemerIcon"] = title_icon
    return result


def process_identity(helper, handle, lease):
    """Validate creation time on the same read handle before any memory read."""
    c, w, kernel = helper.C, helper.W, helper.K
    kernel.GetProcessTimes.argtypes = [w.HANDLE] + [c.POINTER(w.FILETIME)] * 4
    kernel.GetProcessTimes.restype = w.BOOL
    values = [w.FILETIME() for _ in range(4)]
    if not kernel.GetProcessTimes(handle, *(c.byref(v) for v in values)):
        raise c.WinError(c.get_last_error())
    created = values[0].dwLowDateTime | (values[0].dwHighDateTime << 32)
    if str(created) != str(lease["processCreationFileTime"]):
        raise ValueError("PID was reused or creation FILETIME differs")
    kernel.QueryFullProcessImageNameW.argtypes = [w.HANDLE, w.DWORD, w.LPWSTR, c.POINTER(w.DWORD)]
    kernel.QueryFullProcessImageNameW.restype = w.BOOL
    buffer, length = c.create_unicode_buffer(32768), w.DWORD(32768)
    if not kernel.QueryFullProcessImageNameW(handle, 0, buffer, c.byref(length)):
        raise c.WinError(c.get_last_error())
    if Path(buffer.value).name.lower() != "champions.exe":
        raise ValueError("Leased process is not Champions.exe")


def process_module(helper, pid):
    # Only modules of the leased PID. Never find_game/process enumeration.
    c, kernel = helper.C, helper.K
    snapshot = kernel.CreateToolhelp32Snapshot(0x18, pid)
    if snapshot == c.c_void_p(-1).value:
        raise c.WinError(c.get_last_error())
    row = helper.MODULE()
    row.dwSize = c.sizeof(row)
    found = []
    try:
        ok = kernel.Module32FirstW(snapshot, c.byref(row))
        while ok:
            if row.szModule.lower() == "gameassembly.dll":
                found.append({"base": row.modBaseAddr, "path": row.szExePath})
            ok = kernel.Module32NextW(snapshot, c.byref(row))
    finally:
        kernel.CloseHandle(snapshot)
    if len(found) != 1 or sha(found[0]["path"]) != GAME_SHA256:
        raise ValueError("Pinned game binary is absent or changed; no memory read performed")
    return found[0]


def check_read_budget(calls, byte_count, size, started, expires_at):
    if (time.monotonic() - started >= LIMITS["maxSeconds"] or calls >= LIMITS["maxReads"]
            or byte_count + size > LIMITS["maxBytes"]
            or datetime.now(timezone.utc) >= datetime.fromisoformat(expires_at)):
        raise ValueError("Public definition read budget exhausted")


def capture(lease_path, output):
    output = within_artifact(output)
    if output.exists():
        raise ValueError("Refusing to overwrite a retained capture")
    targets = load_targets()
    expected = contract(targets, validate_inputs())
    lease = validate_lease(lease_path, expected)  # Must pass before importing Windows support.
    spec = importlib.util.spec_from_file_location("_reward_definition_memory", SUPPORT)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    start = time.monotonic()

    class BoundedMemory(helper.Memory):
        def read(self, address, size):
            check_read_budget(self.reads, self.bytes, size, start, lease["expiresAt"])
            if self.reads % 128 == 0:
                if validate_lease(lease_path, expected) != lease:
                    raise ValueError("Root lease changed during read")
            return super().read(address, size)

        def string(self, pointer):
            if not pointer:
                return None
            # Confirm string class before reading UTF-16; no object graph descent.
            if self.klass_name(pointer) != "String":
                raise ValueError("Expected public managed string")
            length = self.i32(pointer + 16)
            if not 0 <= length <= LIMITS["maxStringChars"]:
                raise ValueError("Public managed string length exceeds limit")
            return self.read(pointer + 20, length * 2).decode("utf-16-le") if length else ""

    memory = BoundedMemory(lease["processId"])
    try:
        process_identity(helper, memory.h, lease)
        module = process_module(helper, lease["processId"])
        if validate_lease(lease_path, expected) != lease:
            raise ValueError("Root lease changed before first memory read")
        rows = read_definitions(memory, module["base"], targets)
        if validate_lease(lease_path, expected) != lease:
            raise ValueError("Root lease changed before capture completion")
        document = {"format": "cerebro.public-reward-definitions.v2",
                    "capturedAt": datetime.now(timezone.utc).isoformat(),
                    "source": {"captureMethod": "bounded-public-definition-registries",
                               "readerSha256": expected["readerSha256"], "scopeSha256": expected["scopeSha256"],
                               "allowlistSha256": expected["allowlistSha256"], "supportPins": expected["supportPins"]},
                    "definitions": rows,
                    "missingIds": {kind: sorted(set(ids) - {r["id"] for r in rows[kind]}) for kind, ids in targets.items()},
                    "resourceStatus": "No proven public non-account runtime registry; no resource read attempted",
                    "readMetrics": {"calls": memory.reads, "bytes": memory.bytes,
                                    "seconds": round(time.monotonic() - start, 3)}}
    finally:
        memory.close()
    write_new(output, document)
    return {"captured": {k: len(v) for k, v in rows.items()}, "output": str(output)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--capture", action="store_true", help="requires a separate explicit root grant")
    parser.add_argument("--preflight", action="store_true", help="offline only (also the default)")
    parser.add_argument("--lease", type=Path)
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    if args.capture:
        if args.preflight or not args.lease or not args.out:
            parser.error("Capture requires --lease and --out, without --preflight")
        result = capture(args.lease, args.out)
    else:
        if args.lease:
            parser.error("Offline preflight does not consume a lease")
        result = contract(load_targets(), validate_inputs())
        if args.out:
            write_new(args.out, result)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
