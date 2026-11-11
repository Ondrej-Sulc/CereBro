"""Deterministic, offline metadata projection. Never writes the extraction catalog.

Inputs are named explicitly; no game directory, network, model or image decoder.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import re
import sqlite3
from urllib.parse import unquote

VERSION = 1
FAMILIES = {
    'portraits': 'Champions & portraits', 'crystals': 'Crystals & banners',
    'items': 'Items & rewards', 'currencies': 'Currencies', 'catalysts': 'Catalysts & ISO',
    'combat': 'Effects & node UI', 'quests': 'Quest & Tower', 'backgrounds': 'Backgrounds',
    'interface': 'UI elements', 'materials': 'Textures & VFX', 'unclassified': 'Unclassified',
}

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def normalized_path(value):
    return unquote(value).replace('\\', '/').strip('/').lower()

def words(value):
    value = re.sub(r'([a-z0-9])([A-Z])', r'\1 \2', value)
    return re.sub(r'[^a-z0-9]+', ' ', value.lower()).strip()

def build(catalog, repo, champion_snapshot=None, effects=None, quest_snapshot=None):
    inputs = {'catalog.sqlite': sha(catalog), 'builder': sha(__file__)}
    def load(relative):
        file = repo / relative
        inputs[relative] = sha(file)
        return json.loads(file.read_text(encoding='utf-8'))
    crystal_catalog = load('src/data/game-crystals/catalog.json')
    crystal_art = load('src/data/game-crystals/artwork.json')
    reward_art = load('src/data/game-reward-artwork/manifest.json')
    openings = load('src/data/game-crystal-openings/catalog.json')
    ascension = load('src/data/game-ascension/catalog.json')
    champions = {r['id']: r['name'] for r in crystal_catalog['champions']}
    champion_labels = {key:'src/data/game-crystals/catalog.json' for key in champions}
    if champion_snapshot:
        inputs['canonical-champions-snapshot'] = sha(champion_snapshot)
        for row in json.loads(Path(champion_snapshot).read_text(encoding='utf-8')):
            if row.get('gameId'):
                champions[row['gameId']]=row['name']; champion_labels[row['gameId']]='canonical-champions-snapshot'
    audit = {}
    if effects:
        inputs['canonical-effects-snapshot'] = sha(effects)
        effect_rows = json.loads(Path(effects).read_text(encoding='utf-8'))['abilities']
        audit['effects'] = {'records': len(effect_rows), 'exactRasterBindings': 0, 'reason': 'Canonical effect glossary has no native raster reference/hash. No glyph-to-PNG guesses.'}
    if quest_snapshot:
        inputs['canonical-quest-snapshot'] = sha(quest_snapshot)
        # Audit the existing offline public projection only. No runtime/game reads.
        snapshot = json.loads(Path(quest_snapshot).read_text(encoding='utf-8'))
        audit['quests'] = {'sets': len(snapshot.get('pveSets', [])), 'exactPosterBindings': 0, 'reason': 'Inspected quest projection has no poster/image reference fields; native Quest/Tower paths remain usage hints.'}
    db = sqlite3.connect(Path(catalog).resolve().as_uri() + '?mode=ro', uri=True)
    db.row_factory = sqlite3.Row
    rows = db.execute("""SELECT a.*,l.id alias_id,l.name,l.path,l.category,l.evidence,
        s.root,s.path source_path,o.id object_id,o.provenance FROM assets a
        JOIN objects o ON o.asset_id=a.id JOIN aliases l ON l.object_id=o.id
        JOIN sources s ON s.id=o.source_id WHERE s.status IN ('done','done-with-errors')
        ORDER BY a.id,l.id""").fetchall()
    docs = {}
    byte_assets, reference_assets = defaultdict(set), defaultdict(set)
    for row in rows:
        aid = row['id']
        if aid not in docs:
            docs[aid] = {k: row[k] for k in ['id','kind','width','height','format']}
            docs[aid].update(transparent=row['alpha_min'] is not None and row['alpha_min'] < 255,
                aliasIds=set(), names=set(), paths=set(), locations=set(), families=set(), identities={}, hints={})
        d = docs[aid]
        d['aliasIds'].add(row['alias_id']); d['names'].add(row['name'])
        d['paths'].update([row['path'], row['source_path']]); d['locations'].add((row['root'],row['category']))
        original = json.loads(row['provenance']).get('originalBlobSha256')
        if original:
            byte_assets[original].add(aid)
        # Catalog-owned byte hashes, never published WebP hashes or visual similarity.
        byte_assets[row['blob_sha256']].add(aid)
        for field in [row['path']]:
            reference_assets[normalized_path(field)].add(aid)
        native = row['source_path'].replace('\\','/')
        # Shipped Resources/Data/<resource-group>/<logical-path> convention.
        if row['root'] == 'installed' and row['kind'] == 'loose' and native.startswith('Resources/Data/'):
            logical = '/'.join(native.split('/')[3:])
            reference_assets[normalized_path(str(Path(logical).with_suffix('')))].add(aid)
        # Only the name itself defines a portrait ID; containing character bundles
        # are not proof that every texture depicts that champion.
        match = re.fullmatch(r'(?:GachaChasePrize_256x256_|portrait_)(.+)\.png', row['name'])
        if match and match[1] in champions:
            key = match[1]
            identity = {'id': key, 'label': champions[key], 'domain': 'champion', 'basis': 'native-id',
                'reference': row['name'], 'source': 'src/data/game-crystals/catalog.json', 'labelSource':champion_labels[key], 'note': 'Exact native portrait identifier equals canonical champion gameId.'}
            d['identities'][('champion',key,'native-id')] = identity
            d['families'].add('portraits')

    # Public TOCs already resolved by the extractor supply exact logical aliases.
    for row in db.execute("""SELECT r.logical_path,r.native_path,o.asset_id FROM references_catalog r
        JOIN objects o ON o.id=r.object_id WHERE r.status='resolved' AND o.asset_id IS NOT NULL ORDER BY r.id"""):
        if row['asset_id'] in docs:
            for key in ['logical_path','native_path']:
                reference_assets[normalized_path(row[key])].add(row['asset_id'])
                docs[row['asset_id']]['paths'].add(row[key])
    # Friendly item names come from recorded reward definitions, never from artwork.
    reward_names = defaultdict(set)
    reward_label_sources = {}
    def collect_rewards(value):
        if isinstance(value, dict):
            if value.get('type') and value.get('data') and value.get('displayName'):
                reward_names[(value['type'], value['data'])].add(value['displayName'])
                reward_label_sources[(value['type'],value['data'],value['displayName'])]='src/data/game-crystal-openings/catalog.json'
            for child in value.values(): collect_rewards(child)
        elif isinstance(value,list):
            for child in value: collect_rewards(child)
    collect_rewards(openings)
    for row in ascension['resources']:
        if row.get('name'):
            reward_names[(row['type'], row['id'])].add(row['name'])
            reward_label_sources[(row['type'],row['id'],row['name'])]='src/data/game-ascension/catalog.json'
    # Reuse only literal resource identities from CereBro's canonical display map.
    display_file=repo/'src/domain/reward-display.ts'; inputs['src/domain/reward-display.ts']=sha(display_file)
    display_map=re.search(r'const resourceNames[^=]*=\s*\{([^}]+)\}',display_file.read_text(encoding='utf-8'))
    if display_map:
        for key,label in re.findall(r'(\w+)\s*:\s*"([^"]+)"',display_map[1]):
            reward_names[('res',key)].add(label); reward_label_sources[('res',key,label)]='src/domain/reward-display.ts'
    crystal_uses = defaultdict(list)
    for row in crystal_catalog['crystals']:
        for field, role in [('artwork','Crystal artwork'),('bannerArtwork','Crystal banner')]:
            if row.get(field): crystal_uses[(row[field]['source'],row[field]['reference'])].append((row['id'],row['name'],role))
    stats = defaultdict(set)
    def targets(record):
        exact_bytes = byte_assets.get(record.get('inputSha256'), set())
        if exact_bytes: return exact_bytes, 'Encoded input SHA-256 matches retained original bytes.'
        exact_reference = reference_assets.get(normalized_path(record.get('reference','')),set())
        return exact_reference, 'Exact resource/TOC logical reference.'
    for record in crystal_art['assets']:
        ids, proof = targets(record)
        for aid in ids:
            d = docs[aid]; d['families'].add('crystals'); stats['crystalRegistry'].add(aid)
            d['paths'].add(record['reference'])
            for key,label,role in crystal_uses[(record['source'],record['reference'])]:
                d['identities'][('crystal',key,role)] = {'id': key, 'label': label, 'domain': 'crystal', 'basis': 'registry',
                    'reference': record['reference'], 'source': 'src/data/game-crystals/artwork.json', 'labelSource':'src/data/game-crystals/catalog.json', 'role': 'full' if role == 'Crystal artwork' else 'banner', 'note': f'{role}. {proof}'}
    for record in reward_art['assets']:
        ids, proof = targets(record)
        key = (record['type'],record['data'])
        # Require the exact (type,data) key. Similar blueprint IDs are not joins.
        labels = reward_names.get(key,set())
        for aid in ids:
            d = docs[aid]; d['families'].add('items'); stats['rewardRegistry'].add(aid)
            d['paths'].add(record['reference'])
            for label in sorted(labels) or [record['data'].replace('_',' ')]:
                note = f'{record["role"]} artwork. {proof} Registry use of native base artwork; not the tinted/composited output.' if record.get('tintApplied') else f'{record["role"]} artwork. {proof}'
                d['identities'][('item',record['data'],label)] = {'id': record['data'], 'label': label, 'domain': 'item',
                    'basis': 'registry', 'reference': record['reference'], 'source': 'src/data/game-reward-artwork/manifest.json', 'labelSource':reward_label_sources.get((*key,label),'registry ID'), 'role':record['role'], 'note': note}
                clean = words(label)
                if 'catalyst' in clean or 'iso8' in clean: d['families'].add('catalysts')
                if key[0] == 'res' or any(x in clean for x in ['gold','units','currency','loyalty','battlechips']): d['families'].add('currencies')
    # Conservative, overlapping families. Evidence is retained and visibly labelled
    # as a usage hint, not upgraded to identity. Search uses original names too.
    rules = [
        ('portraits',r'\b(?:portrait|portraits)\b','portrait path/name'),
        ('crystals',r'\b(?:crystal|crystals|gatchacrystal\w*|uigacha banners)\b','native crystal/model name or crystal-banner directory'),
        ('catalysts',r'\b(?:catalyst\w*|iso8|iso 8)\b','catalyst/ISO path/name'),
        ('currencies',r'\b(?:currenc(?:y|ies)|resource (?:hc|sc|gold|loyalty|battlechips)|(?:gold|loyalty|battlechips) (?:icon|token))\b','native currency/resource name'),
        ('items',r'\b(?:inventory|gamestore|reward\w*|prize\w*|potion\w*|revive\w*|boost\w*|catalyst\w*)\b','item/reward path/name'),
        ('combat',r'\b(?:bufficon\w*|buff icon|buff node|ability (?:rune|socket|header|rectangle|callout)|passive ability plate|rune|runes|node|nodes|mastery|masteries|fight backing)\b','combat/node UI component path/name'),
        ('quests',r'\b(?:quest|quests|towers|background tower|icon tower|fightlanding|fight landing|questboard|quest board)\b','quest/tower path/name'),
        ('backgrounds',r'\b(?:background\w*|backdrop\w*|wallpaper\w*|loading screen|splash (?:background|foreground|screen)|resources data splash|ui loading|ui splash)\b','background name or native loading/splash UI context'),
        ('interface',r'\b(?:ui|button\w*|icon\w*|panel\w*|tray\w*|frame\w*|border\w*|backing\w*|overlay\w*|mask\w*|widget\w*|atlas\w*)\b','UI component path/name'),
        ('materials',r'\b(?:diff|diffuse|norm|normal|spec|specular|emiss|emission|roughness|metallic|albedo|fx|particles?)\b','material/VFX texture name'),
    ]
    output=[]
    for aid,d in sorted(docs.items()):
        # Native filenames/TOC logical paths are useful; serialized CAB hashes and
        # containing character bundle names are low-ranked path search only.
        native = ' '.join(sorted(d['names']) + [p for p in d['paths'] if not ('#CAB-' in p or '.assetbundle' in p)])
        text = words(native)
        for family,pattern,rule in rules:
            if re.search(pattern,text):
                d['families'].add(family); d['hints'][family]={'family':family,'rule':rule}
        if not d['families']: d['families'].add('unclassified')
        identities=sorted(d['identities'].values(),key=lambda x:(x['basis']!='registry',x['domain'],x['label'],x['id']))
        names=sorted(d['names'],key=lambda name:(not bool(name),bool(re.match(r'^[a-fA-F0-9]{40}',name)),len(name),name))
        name=names[0] or 'Unnamed native image'
        champion=[i for i in identities if i['domain']=='champion']
        display=(champion[0]['label']+' · portrait') if champion else identities[0]['label'] if len({i['label'] for i in identities})==1 else name
        output.append({**{k:d[k] for k in ['id','kind','width','height','format','transparent']},'name':name,'displayName':display,
            'aliasCount':len(d['aliasIds']),'names':names,'paths':sorted(d['paths']),'locations':sorted(d['locations']),
            'families':[f for f in FAMILIES if f in d['families']], 'identities':identities,'hints':sorted(d['hints'].values(),key=lambda x:x['family'])})
    db.close()
    family_counts=Counter(f for d in output for f in d['families'])
    registry={d['id'] for d in output if any(i['basis']=='registry' for i in d['identities'])}
    native={d['id'] for d in output if any(i['basis']=='native-id' for i in d['identities'])}
    anonymous={d['id'] for d in output if all(re.match(r'^[a-fA-F0-9]{40}',name) for name in d['names'] if name)}
    return {'version':VERSION,'inputs':inputs,'families':[{'id':f,'label':label,'count':family_counts[f]} for f,label in FAMILIES.items()],
        'coverage':{'total':len(output),'registry':len(registry),'nativeId':len(native),'anonymousRegistry':len(registry&anonymous),
            'unclassified':family_counts['unclassified'],'familyCountsOverlap':True,'audits':audit},'assets':output}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--catalog',required=True,type=Path); parser.add_argument('--repo',type=Path,default=Path(__file__).resolve().parents[5])
    parser.add_argument('--output',required=True,type=Path); parser.add_argument('--champion-snapshot',type=Path)
    parser.add_argument('--effects',type=Path); parser.add_argument('--quest-snapshot',type=Path)
    args=parser.parse_args()
    result=build(args.catalog,args.repo,args.champion_snapshot,args.effects,args.quest_snapshot)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({'coverage':result['coverage'],'families':result['families'],'bytes':args.output.stat().st_size},indent=2))
if __name__=='__main__': main()
