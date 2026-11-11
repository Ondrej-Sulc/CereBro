"""Read-only offline full-definition/glyph agreement audit. Never loosens a join."""
import json,argparse
from collections import Counter
from pathlib import Path
from build_application_icons import read,sha,digest,bind,REPO
def audit(output):
 pins=read(Path('C:/Code/CereBro/temp/parallel-reference-20261109/quest-icon-source-inputs.json'));inputs={}
 for s in pins['read_only_source_inputs']:
  p=Path(s['path']);assert sha(p)==s['sha256'];inputs[p.name]=read(p)
 cat,binding,art=[inputs[n] for n in ['catalog.json','icon-bindings.json','artwork.json']];bcg=cat['profile']['bcgSha256'];versions={v['definitionHash']:v for d in cat['definitions'] for v in d['versions']};counts=Counter();matches={};cache={}
 source=REPO/'temp/quest-explorer-review/progressed-20261109';ledger=read(source/'capture-manifest.json')
 context=read(REPO/'src/data/game-quests/progressed.json');assert context['bcgSha256']==bcg and sha(Path('C:/Code/CereBro/temp/quest-data-investigation/game-only/sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin'))==bcg
 previous=REPO/'temp/quest-explorer-review/permanent-20261109';previous_ledger=read(previous/'capture-manifest.json')
 for p in sorted((source/'maps').glob('*.json'))+sorted((previous/'maps').glob('*.json')):
  hashes=ledger['files'] if p.parent.parent==source else previous_ledger['sourceFiles']
  assert sha(p)==hashes['maps/'+p.name];d=read(p);apps={};status=Counter()
  for tile_index,t in enumerate(d['map']['walkableTiles']):
   for side in ['attacker','defender']:
    for i,a in enumerate(t[side+'Buffs'] or []):
     h=digest(a['buff']);k=(h,a['buffAppearance'])
     if k not in cache:
      hit=bind(a['buff'],a['buffAppearance'],cat,binding,art,bcg)
      cache[k]=(hit,'exactFullDefinitionAndGlyph' if hit else 'fullDefinitionVersionAbsent' if h not in versions else 'glyphOrSvgUnproved')
     hit,reason=cache[k];counts[reason]+=1;status[reason]+=1
     if hit:apps[f"{t['x']},{t['y']}:{side}:{i}"]=dict(hit,definitionHash=h,nativeGlyph=a['buffAppearance'],sourcePointer=f'/map/walkableTiles/{tile_index}/{side}Buffs/{i}')
  matches[d['quest']['qid']]=dict(mapId=d['quest']['mapId'],sourceHash=sha(p),applications=apps,coverage=dict(status))
 out=dict(version=1,exporterSha256=sha(Path(__file__)),captureManifestSha256=sha(source/'capture-manifest.json'),previousCaptureManifestSha256=sha(previous/'capture-manifest.json'),questProjectionBcgSha256=context['bcgSha256'],policy='Exact complete serialized native Buff hash, approved component-inclusive version/BCG source, captured glyph and immutable SVG agreement. No names or partial definition matching.',sourceInputs={s['path'].replace('\\','/').split('/')[-1]:s['sha256'] for s in pins['read_only_source_inputs']},bcgSha256=bcg,counts=dict(counts),maps=matches)
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(out,separators=(',',':'))+'\n',encoding='utf-8');print(dict(counts))
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/application-icons-expanded.json');audit(p.parse_args().output)
