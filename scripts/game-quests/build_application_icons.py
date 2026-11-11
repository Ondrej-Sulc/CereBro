"""Offline exact-definition/version/glyph join to approved tiny icon registry."""
import argparse
import hashlib
import json
from pathlib import Path

REPO=Path(__file__).resolve().parents[2]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def digest(d):return hashlib.sha256(json.dumps(d,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()).hexdigest()

def bind(raw, appearance, catalog, bindings, artwork, bcg_hash):
    matches=[v for d in catalog['definitions'] if d['id']==raw['id'] for v in d['versions'] if v['definitionHash']==digest(raw) and v['sourceBcgSha256']==bcg_hash]
    if len(matches)!=1:return None
    version=matches[0]
    # Recompute complete version identity; referenced components remain independently versioned.
    if digest(dict(raw=raw,components=version['components'],missingComponentIds=version['missingComponentIds'],sourceBcgSha256=bcg_hash))!=version['hash']:return None
    icon=next((i for i in artwork['icons'] if i['effectId']==raw['id'] and i['versionHash']==version['hash'] and i['status']=='verified' and i.get('glyph')==appearance),None)
    binding=next((i for i in bindings['bindings'] if i['effectId']==raw['id'] and i['versionHash']==version['hash']),None)
    if not icon or not binding:return None
    asset=REPO/'web/public'/icon['src'].lstrip('/')
    if not asset.exists() or sha(asset)!=icon['sha256'] or binding['iconKey']!='node-glyph-'+icon['sha256'][:16]:return None
    return dict(effectId=raw['id'],iconKey=binding['iconKey'],versionHash=version['hash'])

def build(args):
    sources=read(args.inputs)['read_only_source_inputs'];values={};ledger={}
    for s in sources:
        p=Path(s['path']);assert sha(p)==s['sha256'] and p.stat().st_size==s['bytes'];d=read(p);assert d['contract']==s['contract'];values[p.name]=d;ledger[p.name]=s['sha256']
    catalog,bindings,artwork=[values[k] for k in ['catalog.json','icon-bindings.json','artwork.json']]
    assert catalog['contentHash']==bindings['modifierCatalogHash']==artwork['modifierCatalogHash'] and bindings['artworkHash']==artwork['contentHash']
    bcg=REPO/'src/data/game-quests/manifest.json';bcg_hash=read(bcg)['labelEvidence']['sha256'];assert bcg_hash==catalog['profile']['bcgSha256']
    permanent=read(REPO/'src/data/game-quests/permanent.json');public=set(permanent['publicQuestIds']);rows={};count=0;total=0
    # These original source files already pin the same BCG. Refreshed maps without that version evidence stay unbound.
    for p in sorted((REPO/'src/data/game-quests/maps').glob('*.json')):
        projected=read(p)
        if projected['questId'] not in public:continue
        path=args.evidence/projected['sourceFile'];assert sha(path)==projected['sourceHash'];source=read(path)
        native=source['map'] if 'map' in source else next(s['QuestMaps'][projected['questId']] for s in source['pveSets'] if projected['questId'] in (s['QuestMaps'] or {}))
        applications={}
        for t in native['walkableTiles']:
            for side in ['attacker','defender']:
                for i,a in enumerate(t[side+'Buffs'] or []):
                    total+=1;bound=bind(a['buff'],a['buffAppearance'],catalog,bindings,artwork,bcg_hash)
                    if bound:applications[f"{t['x']},{t['y']}:{side}:{i}"]=bound;count+=1
        rows[projected['questId']]=dict(mapId=projected['mapId'],sourceHash=projected['sourceHash'],applications=applications)
    result=dict(version=1,exporterSha256=sha(Path(__file__)),modifierCatalogHash=catalog['contentHash'],artworkHash=artwork['contentHash'],bcgSha256=bcg_hash,sourceFileHashes=ledger,maps=rows,policy='Exact full raw definition, recomputed version hash, BCG, captured application glyph and content-addressed native SVG. New capture versions without BCG binding stay unbound.')
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,separators=(',',':'))+'\n',encoding='utf-8');print(dict(bound=count,originalApplications=total,maps=len(rows)))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--inputs',type=Path,default=Path('C:/Code/CereBro/temp/parallel-reference-20261109/quest-icon-source-inputs.json'));p.add_argument('--evidence',type=Path,default=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only'));p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/application-icons.json');build(p.parse_args())
