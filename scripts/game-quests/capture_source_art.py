"""Opt-in bounded read-only public quest artwork capture; user opens the client.

Never launches/controls the game or exports account/progression/session objects.
The proven external reader is imported only after its bytes and metadata pass.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PINS = {
    "GameAssembly.dll": "01f46bb2e36c2160a8df939bbb080bcf2ee89ca15427692a10334efc90fd4abb",
    "layouts.json": "d222efe9fd9334aa8095236abd990078470801237dd60897b04798a5b817befa",
    "read_memory.py": "edd46c2014f0e35bf819e992411dface976195fb7ec70eb3181bc08cc063ddac",
    "capture_quests.py": "0615e88f306dd19e8914fd1b69c2ba546f746eac8953fc00366149c4737de4c8",
}
ALLOW = {
    "QuestSet": "category setId setName cdn panelType Acts QuestSummarys",
    "Act": "actId groupIndex displayIndex friendlyName image imageSmall imageLarge Chapters",
    "Chapter": "chapterId friendlyName image Quests",
    "QuestSummary": "qid setId mapId category panelType actIndex chapterIndex questIndex friendlyName difficultyId actImage bgImage bgImageUsesCDN rewardImage",
}
ALLOW = {kind: set(names.split()) for kind, names in ALLOW.items()}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_support(root):
    for name in ("layouts.json", "read_memory.py", "capture_quests.py"):
        if sha(root / name) != PINS[name]:
            raise ValueError(f"Unsupported {name} bytes; establish updated named metadata before reading")
    layout = json.loads((root / "layouts.json").read_text(encoding="utf-8"))
    for source in layout["sources"]:
        if sha(Path(source["path"])) != source["sha256"]:
            raise ValueError("Named metadata binary mismatch; no process handle opened")
    return layout


def clean(name):
    match = re.fullmatch(r"<(.+)>k__BackingField", name)
    return match[1] if match else name


def public_field_specs(layout):
    result = {}
    for kind, names in ALLOW.items():
        result[kind] = {}
        for name in sorted(names):
            fields = [f for f in layout["types"][kind]["fields"] if clean(f["name"]) == name and not f["static"]]
            if len(fields) != 1 or fields[0]["offset"] is None:
                raise ValueError(f"No exact named field binding: {kind}.{name}")
            result[kind][name] = {k: fields[0][k] for k in ("name", "type", "offset")}
    return result


def capture(support, output):
    if not output.resolve().is_relative_to((REPO / "temp").resolve()):
        raise ValueError("Raw art capture must stay in this worktree's ignored temp research directory")
    if output.exists():
        raise ValueError("Refusing to overwrite an existing source capture")
    layout = validate_support(support)
    specs = public_field_specs(layout)
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(support))
    # Both helpers are hash-pinned. Their broad capture entry point is never called.
    import read_memory
    import capture_quests
    pid, module = read_memory.find_game()
    if sha(Path(module["path"])) != PINS["GameAssembly.dll"]:
        raise ValueError("Unsupported game binary; no process handle opened")

    class BoundedMemory(read_memory.Memory):
        def read(self, address, size):
            if self.reads >= 50000 or self.bytes + size > 16 * 1024 * 1024:
                raise ValueError("Public artwork read budget exceeded")
            return super().read(address, size)

        def string(self, address):
            if address and not 0 <= self.i32(address + 16) <= 8192:
                raise ValueError("Public artwork string length exceeded")
            return super().string(address)

    class ArtReader(capture_quests.QuestReader):
        def obj(self, address, kind, depth=0):
            if not address:
                return None
            if kind == "string" or kind.endswith("[]") or kind.startswith("System.Collections.Generic."):
                return super().obj(address, kind, depth)
            if depth > 16 or kind not in ALLOW:
                raise ValueError("Type outside narrow public artwork allowlist")
            key = (address, kind)
            if key in self.cache:
                return self.cache[key]
            result = {}
            self.cache[key] = result
            for name in sorted(ALLOW[kind]):
                result[name] = self.field(address, kind, name, depth)
            return result

    memory = BoundedMemory(pid)
    try:
        # Same exact hash-pinned bootstrap used by the proven external definition reader.
        klass = memory.ptr(module["base"] + 0x60BA5B8)
        static = memory.ptr(klass + 0xB8)
        instance = memory.ptr(static + 8)
        if memory.klass_name(instance) != "QuestsManager":
            raise ValueError("QuestsManager bootstrap identity mismatch")
        db = memory.ptr(instance + 0x88)
        if memory.klass_name(db) != "QuestDB":
            raise ValueError("QuestDB identity mismatch")
        reader = ArtReader(memory)
        sets = []
        for address in memory.list_ptrs(memory.ptr(db + 0x10), limit=100):
            category = reader.field(address, "QuestSet", "category")
            if category["name"] in {"Story", "Daily", "Event", "StoryEvent", "Tutorial", "Secret", "Unrestricted", "Progression"}:
                sets.append(reader.obj(address, "QuestSet"))
        if not sets:
            raise ValueError("No resident public PvE definitions; client must be idle at normal quest selection")
        document = dict(format="cerebro.public-quest-art.v1", capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            origin="user-ready-client/external-read-only-public-managed-definitions", gameAssemblySha256=PINS["GameAssembly.dll"],
            layoutSha256=PINS["layouts.json"], readerSha256=sha(Path(__file__)), helperHashes={k: PINS[k] for k in ("read_memory.py", "capture_quests.py")},
            fieldBindings=specs, pveSets=sets,
            localization="Native resolved image strings and friendly labels; original wire localization/CDN booleans are not retained by all native objects",
            policy="Public artwork/definition identities only; no account, progression, owned teams, inventory, credentials, session IDs, process IDs, addresses, maps or gameplay data",
            readMetrics=dict(calls=memory.reads, bytes=memory.bytes))
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(document, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(json.dumps(dict(output=str(output), sets=len(sets), summaries=sum(len(s["QuestSummarys"] or {}) for s in sets), calls=memory.reads, bytes=memory.bytes)))
    finally:
        memory.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--support-root", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    capture(args.support_root, args.out)
