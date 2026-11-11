"""Opt-in bounded external public definition capture after normal menu loading.

No game writes, invocations, endpoints, profile/progression/team data or scans.
Earlier captures are immutable. Named metadata and original reader bytes are pinned.
"""
import argparse
import datetime
import hashlib
import json
import sys
from pathlib import Path
from capture_source_art import validate_support, PINS, REPO, ALLOW, sha


def capture(support, out, maps):
    if out.exists() or not out.resolve().is_relative_to((REPO / 'temp').resolve()):
        raise ValueError('Capture must be a new ignored worktree artifact')
    validate_support(support)
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(support))
    import capture_quests as original
    from read_memory import Memory, find_game
    original.RULES['QuestSet'] |= ALLOW['QuestSet']
    original.RULES['Act'] |= ALLOW['Act']
    original.RULES['Chapter'] |= ALLOW['Chapter']
    original.RULES['QuestSummary'] |= ALLOW['QuestSummary']
    original.RULES['QuestMapTile'] |= {'attackerBuffs', 'defenderBuffs'}
    # Catalog operation intentionally excludes maps, restrictions, reward matrices and combat rows.
    catalog_rules = {
        'QuestSet': ALLOW['QuestSet'] | set('hash groupTag beginTime expiryTime timeLimit difficulties difficulty difficultyLabel'.split()),
        'Act': ALLOW['Act'], 'Chapter': ALLOW['Chapter'],
        'QuestSummary': ALLOW['QuestSummary'] | set('setName rootQid begin end reoccurInterval theme isDetailed difficulty scaleBosses bosses finalBosses miniBosses'.split()),
        'QuestBoss': set('bossId blueprint potentialCharacters isFinalBoss isMetaDataFinalBoss'.split()),
        'Difficulty': original.RULES['Difficulty'],
    }
    class Bounded(Memory):
        def read(self, address, size):
            if self.reads >= 2_000_000 or self.bytes + size > 64 * 1024 * 1024:
                raise ValueError('Public definition read budget exceeded')
            return super().read(address, size)
    class Reader(original.QuestReader):
        def __init__(self, m): super().__init__(m); self.specs = {}
        def spec(self, kind, name):
            key = (kind,name)
            if key not in self.specs: self.specs[key] = super().spec(kind,name)
            return self.specs[key]
    pid, module = find_game()
    if sha(Path(module['path'])) != PINS['GameAssembly.dll']:
        raise ValueError('Unsupported binary; no handle opened')
    if not maps: original.RULES.update(catalog_rules)
    known = {q['id'] for q in json.loads((REPO/'src/data/game-quests/catalog.json').read_text(encoding='utf-8')) if q['coverage']=='full-map'}
    memory = Bounded(pid)
    try:
        instance = memory.ptr(memory.ptr(memory.ptr(module['base'] + 0x60ba5b8) + 0xb8) + 8)
        if memory.klass_name(instance) != 'QuestsManager': raise ValueError('Bootstrap mismatch')
        db = memory.ptr(instance + 0x88)
        if memory.klass_name(db) != 'QuestDB': raise ValueError('QuestDB mismatch')
        reader, sets, saved = Reader(memory), [], []
        for ptr in memory.list_ptrs(memory.ptr(db+16),limit=100):
            category = reader.field(ptr,'QuestSet','category')
            if category['name'] not in {'Story','Event','StoryEvent','Daily','Tutorial','Secret','Unrestricted','Progression'}: continue
            if not maps:
                sets.append(reader.obj(ptr,'QuestSet'))
                continue
            # Only maps already resident from normal preview, never trigger a fetch.
            resident = {memory.string(k):v for k,v in memory.dict_ptrs(memory.ptr(ptr+reader.spec('QuestSet','QuestMaps')['offset']))}
            summaries = {memory.string(k):v for k,v in memory.dict_ptrs(memory.ptr(ptr+reader.spec('QuestSet','QuestSummarys')['offset']))}
            for qid, mp in resident.items():
                if (out.parent/'maps'/f'{qid}.json').exists(): continue
                if qid in known: continue
                q = reader.obj(summaries[qid],'QuestSummary')
                if category['name'] not in {'Story','Event','StoryEvent'}: continue
                document = dict(format='cerebro.game-only.quest-map.v1',quest=q,map=reader.obj(mp,'QuestMap'),container=dict(setId=reader.field(ptr,'QuestSet','setId'),setName=reader.field(ptr,'QuestSet','setName')))
                saved.append((qid,document))
        if reader.issues: raise ValueError(json.dumps(reader.issues))
        common = dict(capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),gameAssemblySha256=PINS['GameAssembly.dll'],layoutSha256=PINS['layouts.json'],readerSha256=sha(Path(__file__)),origin='normal-menu-preview/external-read-only-public-definitions',privacy='No account, progression, teams, inventory, credentials, tokens, process IDs or addresses',issues=[],readMetrics=dict(calls=memory.reads,bytes=memory.bytes))
        out.parent.mkdir(parents=True,exist_ok=True)
        for qid, d in saved:
            target=out.parent/'maps'/f'{qid}.json';target.parent.mkdir(exist_ok=True)
            target.write_text(json.dumps(dict(**d,**common),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        out.write_text(json.dumps(dict(format='cerebro.public-permanent-candidates.v1',pveSets=sets,maps=[q for q,_ in saved],**common),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(dict(sets=len(sets),summaries=sum(len(s['QuestSummarys'] or {}) for s in sets),maps=[q for q,_ in saved],reads=memory.reads,bytes=memory.bytes)))
    finally: memory.close()


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--support-root',type=Path,required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--maps',action='store_true');a=p.parse_args();capture(a.support_root,a.out,a.maps)
