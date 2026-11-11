"""Opt-in capture of already loaded, public Class Tower block/floor definitions.

Opening a Tower can automatically advance progression and grant rewards; do not
treat that navigation as passive. This reader only reads already resident data.
It never invokes game code, starts fights, changes a lineup, or sends requests.
No account/user-floor data is exported.
"""
import argparse
import datetime
import hashlib
import json
import sys
from pathlib import Path

from capture_source_art import PINS, REPO, clean, sha, validate_support

OWNER = "quest-public-towers"
LAYOUT_SHA = "9c948d4c0f965cdac354d7cffff112c1f1797c076648dc182d6a30eb63f0bdaf"
PUBLIC_TOWERS = frozenset("class_skill class_mutant class_tech class_cosmic class_mystic class_science".split())
MAX_READS = 100000
MAX_BYTES = 16 * 1024 * 1024
ALLOW = {
    "Tower.TowerData": set("Id FriendlyName Category NumBlocks NumFloors TowerPanelTexture TowerVisualDataId".split()),
    "Tower.TowerBlockData": set("Id TowerId NumFloors TimeLimit Hash TopBuffs Buffs EntryCost Rewards RatingRewards HeroRestrictionsList".split()),
    "Tower.TowerFloorData": set("TowerId BlockId BossData AIDifficultyId Hash TotalLocalBuffCount TopBuffs Buffs Rewards".split()),
    # These objects are reached ONLY from a public floor's BossData, never a roster.
    "HeroData": {"mBlueprint", "mUserHero"},
    "BCGUserHero": set("Blueprint Rank Level SigLvl AscensionTier".split()),
    "BCGBlueprintBase": set("Blueprint Character Rarity _imgID _heroClass".split()),
    "EB.Sparx.Buff": set("id localizedName localizedDesc localizedShortFormat glyphIcon scope value displayValue valueStr valueType quantity".split()),
    "EB.Sparx.RedeemerItem": set("Type Data Quantity MinQuantity MaxQuantity Action Header Footer".split()),
}
POINTER_FIELDS = {
    "EB.Sparx.TowerManager": {"TowersData", "BlocksData", "FloorsData"},
    "Tower.TowerBlockData": {"Floors"},
    "Tower.TowerFloorData": {"ParentBlockData"},
}


def scope_hash():
    value = {"towers": sorted(PUBLIC_TOWERS), "fields": {k: sorted(v) for k, v in sorted(ALLOW.items())},
             "pointerFields": {k: sorted(v) for k, v in sorted(POINTER_FIELDS.items())},
             "maxReads": MAX_READS, "maxBytes": MAX_BYTES, "layoutSha256": LAYOUT_SHA}
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def validate_lease(path, pid=None, now=None):
    if not path or not path.resolve().is_relative_to((REPO / "temp").resolve()):
        raise ValueError("A new root Tower lease inside ignored quest temp is required")
    lease = json.loads(path.read_text(encoding="utf-8"))
    if (lease.get("format") != "cerebro.public-tower-lease.v1" or lease.get("owner") != OWNER
            or lease.get("grantedByRoot") is not True):
        raise ValueError("Tower lease is not granted")
    if (lease.get("userReadyConfirmed") is not True or not isinstance(lease.get("readinessEvidence"), str)
            or not lease["readinessEvidence"].strip()):
        raise ValueError("Actual Tower-selection readiness is required")
    process_id = lease.get("processId")
    if type(process_id) is not int or process_id <= 0 or (pid is not None and process_id != pid):
        raise ValueError("Tower lease process mismatch")
    if (lease.get("readerSha256") != sha(Path(__file__)) or lease.get("scopeSha256") != scope_hash()
            or lease.get("supportPins") != PINS or lease.get("layoutSha256") != LAYOUT_SHA
            or lease.get("allowedTowerIds") != sorted(PUBLIC_TOWERS)):
        raise ValueError("Tower lease reader/scope/source mismatch")
    try:
        start = datetime.datetime.fromisoformat(lease["grantedAt"])
        end = datetime.datetime.fromisoformat(lease["expiresAt"])
        current = now or datetime.datetime.now(datetime.timezone.utc)
        if (start.utcoffset() is None or end.utcoffset() is None or not start <= current < end
                or not datetime.timedelta(0) < end - start <= datetime.timedelta(minutes=30)):
            raise ValueError("Tower lease expired or outside its time window")
    except (KeyError, TypeError) as error:
        raise ValueError("Invalid Tower lease time window") from error
    return lease


def field_specs(layout):
    result = {}
    for kind in sorted(ALLOW.keys() | POINTER_FIELDS.keys()):
        result[kind] = {}
        for name in sorted(ALLOW.get(kind, set()) | POINTER_FIELDS.get(kind, set())):
            found = [f for f in layout["types"][kind]["fields"] if clean(f["name"]) == name and not f["static"]]
            if len(found) != 1 or found[0]["offset"] is None:
                raise ValueError("Unbound Tower field: " + kind + "." + name)
            result[kind][name] = {k: found[0][k] for k in ("name", "type", "offset")}
    return result


def preflight(support, layout_path):
    validate_support(support)
    if sha(layout_path) != LAYOUT_SHA:
        raise ValueError("Tower named layout drift; no handle opened")
    layout = json.loads(layout_path.read_text(encoding="utf-8"))
    for source in layout["sources"]:
        if sha(Path(source["path"])) != source["sha256"]:
            raise ValueError("Tower metadata binary drift; no handle opened")
    return layout, field_specs(layout)


def registry_state(memory, pointer):
    if not pointer or not memory.klass_name(pointer).startswith("Dictionary`2"):
        raise ValueError("Tower registry is not a named dictionary")
    array, count, free, version = (memory.ptr(pointer + 24), memory.i32(pointer + 32),
                                   memory.i32(pointer + 40), memory.i32(pointer + 44))
    if not 0 <= free <= count <= 10000 or (count and (not array or memory.ptr(array + 24) < count)):
        raise ValueError("Invalid Tower registry bounds")
    return array, count, free, version


def read_registry(memory, pointer, dimensions):
    """Only string/TowerId + optional BlockId/FloorNumber keys and definition pointers."""
    if dimensions not in (1, 2, 3):
        raise ValueError("Unsupported Tower registry key")
    before = registry_state(memory, pointer)
    array, count, free, _ = before
    stride = 24 if dimensions == 1 else 32
    value_offset = 16 if dimensions == 1 else 24
    result = []
    seen = set()
    live = 0
    for i in range(count):
        entry = array + 32 + i * stride
        if memory.i32(entry) < 0:
            continue
        live += 1
        tower_id = memory.string(memory.ptr(entry + 8))
        if tower_id not in PUBLIC_TOWERS:
            continue
        key = (tower_id,) + tuple(memory.i32(entry + 16 + j * 4) for j in range(dimensions - 1))
        if key in seen:
            raise ValueError("Duplicate Tower definition identity")
        seen.add(key)
        value = memory.ptr(entry + value_offset)
        if not value:
            raise ValueError("Null Tower definition")
        result.append((key, value))
    if live != count - free or registry_state(memory, pointer) != before:
        raise ValueError("Tower registry changed during capture")
    return result, before


def verify_floor(memory, reader, key, pointer, floor, block_pointers):
    tower_id, block_id, floor_number = key
    if floor["TowerId"] != tower_id or floor["BlockId"] != block_id or floor_number < 1:
        raise ValueError("Tower floor key/definition mismatch")
    parent = block_pointers.get((tower_id, block_id))
    if not parent:
        raise ValueError("Floor has no captured public parent block")
    if memory.ptr(pointer + reader.spec("Tower.TowerFloorData", "ParentBlockData")["offset"]) != parent:
        raise ValueError("Tower floor parent pointer mismatch")
    array = memory.ptr(parent + reader.spec("Tower.TowerBlockData", "Floors")["offset"])
    if not array or not floor_number < memory.ptr(array + 24) <= 10001:
        raise ValueError("Tower floor index outside native block membership")
    if memory.ptr(array + 32 + floor_number * 8) != pointer:
        raise ValueError("Tower floor does not match its native block array")


def select_block_rows(rows, selection):
    if selection is None:
        return rows
    tower_id, block_id = selection
    if tower_id not in PUBLIC_TOWERS or type(block_id) is not int or block_id < 1:
        raise ValueError("Invalid public Tower/block selection")
    towers, blocks, floors = rows
    selected_blocks = [(key, pointer) for key, pointer in blocks if key == selection]
    if not selected_blocks:
        raise ValueError("Requested public Tower block is not loaded")
    return [towers, selected_blocks, [(key, pointer) for key, pointer in floors if key[:2] == selection]]


def collect(memory, module, layout, reader_class, selection=None):
    manager = memory.ptr(memory.ptr(memory.ptr(module["base"] + 0x61C63B0) + 0xB8) + 8)
    if memory.klass_name(manager) != "TowerManager":
        raise ValueError("TowerManager bootstrap mismatch")

    class PublicReader(reader_class):
        def obj(self, pointer, kind, depth=0):
            if not pointer:
                return None
            if kind == "string" or kind.endswith("[]") or kind.startswith("System.Collections.Generic."):
                return super().obj(pointer, kind, depth)
            if depth > 16 or kind not in ALLOW:
                raise ValueError("Type outside public Tower allowlist: " + kind)
            if memory.klass_name(pointer) != kind.split(".")[-1]:
                raise ValueError("Tower definition runtime type mismatch: " + kind)
            cache_key = (pointer, kind)
            if cache_key not in self.cache:
                self.cache[cache_key] = {name: self.field(pointer, kind, name, depth) for name in sorted(ALLOW[kind])}
            return self.cache[cache_key]

    reader = PublicReader(memory)
    reader.types = layout["types"]
    registries = []
    rows = []
    for field, dimensions in [("TowersData", 1), ("BlocksData", 2), ("FloorsData", 3)]:
        pointer = memory.ptr(manager + reader.spec("EB.Sparx.TowerManager", field)["offset"])
        entries, stamp = read_registry(memory, pointer, dimensions)
        registries.append((pointer, stamp))
        rows.append(entries)
    tower_pointers, blocks, floors = select_block_rows(rows, selection)
    block_pointers = dict(blocks)
    tower_ids = {key[0] for key, _ in tower_pointers}
    if any(key[0] not in tower_ids for key, _ in blocks + floors):
        raise ValueError("Tower membership lacks a captured Tower identity")
    tower_rows = [reader.obj(pointer, "Tower.TowerData") for _, pointer in tower_pointers]
    if any(row["Id"] != key[0] for row, (key, _) in zip(tower_rows, tower_pointers)):
        raise ValueError("Tower key/definition mismatch")
    block_rows = []
    for key, pointer in blocks:
        block = reader.obj(pointer, "Tower.TowerBlockData")
        if (block["TowerId"], block["Id"]) != key:
            raise ValueError("Tower block key/definition mismatch")
        block_rows.append(block)
    floor_rows = []
    for key, pointer in floors:
        floor = dict(reader.obj(pointer, "Tower.TowerFloorData"))
        verify_floor(memory, reader, key, pointer, floor, block_pointers)
        floor["FloorNumber"] = key[2]
        floor_rows.append(floor)
    if any(registry_state(memory, pointer) != stamp for pointer, stamp in registries):
        raise ValueError("Tower registry changed before capture completed")
    if reader.issues:
        raise ValueError("Public Tower field read failed")
    return {"towers": tower_rows, "blocks": block_rows, "floors": floor_rows,
            "coverage": {"capturedBlocks": len(block_rows), "capturedFloors": len(floor_rows),
                         "reportedTotalsAreNotCoverage": True, "missingFloorsAreNotEmptyFloors": True}}


def capture(support, layout_path, output, lease_path, selection=None):
    if output.exists() or not output.resolve().is_relative_to((REPO / "temp").resolve()):
        raise ValueError("Use a new ignored Tower capture path")
    validate_lease(lease_path)
    layout, specs = preflight(support, layout_path)
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(support))
    from read_memory import Memory, find_game
    from capture_quests import QuestReader
    pid, module = find_game()
    validate_lease(lease_path, pid)
    if sha(Path(module["path"])) != PINS["GameAssembly.dll"]:
        raise ValueError("Tower game binary drift; no handle opened")

    class BoundedMemory(Memory):
        def read(self, address, size):
            if size < 0 or self.reads >= MAX_READS or self.bytes + size > MAX_BYTES:
                raise ValueError("Public Tower read budget exceeded")
            if self.reads % 256 == 0:
                validate_lease(lease_path, pid)
            return super().read(address, size)

        def string(self, address):
            if address and not 0 <= self.i32(address + 16) <= 8192:
                raise ValueError("Public Tower string limit exceeded")
            return super().string(address)

    memory = BoundedMemory(pid)
    try:
        document = collect(memory, module, layout, QuestReader, selection)
        validate_lease(lease_path, pid)
        document.update(format="cerebro.public-tower-definitions.v1",
                        capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        gameAssemblySha256=PINS["GameAssembly.dll"], layoutSha256=LAYOUT_SHA,
                        readerSha256=sha(Path(__file__)), scopeSha256=scope_hash(), fieldBindings=specs,
                        requestedBlock={"towerId": selection[0], "blockId": selection[1]} if selection else None,
                        readMetrics={"calls": memory.reads, "bytes": memory.bytes},
                        privacy="Public Class Tower definitions only. No account, lineup, user-floor, rankings or active-match objects.")
    finally:
        memory.close()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        stream.write(json.dumps(document, ensure_ascii=False, allow_nan=False, indent=2) + "\n")
    return document["coverage"]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--support-root", type=Path, required=True)
    parser.add_argument("--layout", type=Path, required=True)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--lease", type=Path)
    parser.add_argument("--preflight", action="store_true")
    parser.add_argument("--tower", choices=sorted(PUBLIC_TOWERS))
    parser.add_argument("--block", type=int)
    args = parser.parse_args()
    if args.preflight:
        _, fields = preflight(args.support_root, args.layout)
        print(json.dumps({"preflight": "passed", "fieldCount": sum(map(len, fields.values())),
                          "scopeSha256": scope_hash(), "readerSha256": sha(Path(__file__)), "gameAccess": False}))
    else:
        if not args.out or not args.lease:
            parser.error("--out and --lease are required")
        if (args.tower is None) != (args.block is None) or (args.block is not None and args.block < 1):
            parser.error("--tower and positive --block must be provided together")
        selection = (args.tower, args.block) if args.tower else None
        print(json.dumps(capture(args.support_root, args.layout, args.out, args.lease, selection)))
