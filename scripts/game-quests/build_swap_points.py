"""Reproduce public champion-swap overlays from frozen, hash-pinned evidence.

Offline only. No game reader, HTTP, process, session or database imports.
"""
import argparse
import hashlib
import json
from pathlib import Path
from swap_projection import public_response, SWAP_IDS

REPO=Path(__file__).resolve().parents[2]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_bytes())
def encoded(value):return (json.dumps(value,ensure_ascii=False,allow_nan=False,separators=(',',':'))+'\n').encode('utf-8')
def require(value,message):
 if not value:raise ValueError(message)
def pinned(root,path,digest):
 absolute=(root/path).resolve();require(absolute.is_relative_to(root.resolve()),'Evidence path outside root')
 require(sha(absolute)==digest,'Evidence hash mismatch');return read(absolute)

def validate_projected(record,expected):
 require((record['questId'],record['mapId'])==(expected['questId'],expected['mapId']),'Projected definition identity mismatch')
 require(expected['nativeMapHash'] is None or record['nativeMapHash']==expected['nativeMapHash'],'Projected native map hash mismatch')
 for key in ('sourceHash','publicMapSha256'):
  require(key not in record or record[key]==expected[key],'Projected base source mismatch')
 if 'coordinates' in record:
  require(sorted(record['coordinates'])==sorted(expected['coordinates']),'Projected coordinate mismatch')
  require({tuple(e) for e in record['edges']+record['portals']}=={tuple(e) for e in expected['edges']+expected['portals']},'Projected graph mismatch')
  require(sorted(record['portals'])==expected['portals'],'Projected portal mismatch')
 choices=record['choices'];seen=set()
 for choice in choices:
  key=tuple(choice['coordinate']);require(key in {tuple(c) for c in expected['coordinates']} and key not in seen,'Invalid projected choice position');seen.add(key)
  for option in choice['swaps']:
   require(set(option)=={'choiceId','swapCount','minSwaps','nativeDefaultsApplied'} and option['choiceId'] in SWAP_IDS,'Invalid projected swap identity')
   require(all(type(option[k]) is int and 0<=option[k]<=100 for k in ['swapCount','minSwaps']),'Invalid projected swap count')
   require(option['swapCount']==0 or option['minSwaps']<=option['swapCount'],'Invalid projected count range')
   defaults=set()
   for applied in option['nativeDefaultsApplied']:
    require(applied['field'] in ('swapCount','minSwaps') and applied['field'] not in defaults,'Invalid default field');defaults.add(applied['field'])
    default=1 if applied['field']=='swapCount' else 0
    require(applied==dict(field=applied['field'],value=default,basis='native-constructor') and option[applied['field']]==default,'Invalid default provenance')
 return choices

def build(evidence,public_root):
 index=read(evidence/'source-index.json')
 scope=pinned(evidence,'scope.json',index['scopeSha256'])['maps']
 frozen=pinned(evidence,'frozen-choice-locations.json',index['frozenChoiceLocationsSha256'])['maps']
 sets=pinned(evidence,'response-set-ids.json',index['responseSetIdsSha256'])['maps']
 maps={};counts=dict(maps=0,swapMaps=0,swapPoints=0,unverifiedMaps=0,unresolvedChoiceNodes=0)
 for qid,expected in sorted(scope.items()):
  public_path=public_root/expected['publicFile'];require(sha(public_path)==expected['publicMapSha256'],'Published map drift')
  public=read(public_path);require((public['questId'],public['mapId'],public['sourceHash'])==(qid,expected['mapId'],expected['sourceHash']),'Published identity mismatch')
  record=index['records'].get(qid);points=[];sources={};unresolved=[]
  if record:
   receipt=pinned(evidence,record['receiptFile'],record['receiptSha256']);require(receipt['qid']==qid and receipt['status']==200 and receipt['rawResponseSaved'] is False,'Invalid response receipt')
   document=pinned(evidence,record['file'],record['sha256'])
   if record['role']=='public-fields':
    require(receipt['publicFieldsSha256']==record['sha256'],'Public field receipt mismatch')
    clean=public_response(document,qid,200,dict(expected,definitionSetId=sets[qid]))
   elif record['role']=='geometry-diagnostic':
    require(receipt.get('saved') is False and receipt.get('stopCode')=='map_geometry','Invalid diagnostic role')
    clean=receipt['publicGeometry'];require(clean==document['publicGeometry'],'Diagnostic mismatch')
   elif record['role']=='accepted-projection':
    require(receipt.get('saved') is True and receipt['publicShardSha256']==record['sha256'],'Invalid accepted source')
    clean=document
   else:raise ValueError('Unknown public source role')
   choices=validate_projected(clean,expected)
   normalized=dict(version=1,questId=qid,mapId=expected['mapId'],sourceHash=expected['sourceHash'],publicMapSha256=expected['publicMapSha256'],choices=choices,
                   observedAt=receipt['receivedAt'],responseSha256=receipt['responseSha256'],responseBytes=receipt['responseBytes'],
                   sourceProjectionSha256=record['sha256'],sourceReceiptSha256=record['receiptSha256'],projectionSha256=sha(Path(__file__).with_name('swap_projection.py')))
   output=evidence/'verified-definitions'/f'{qid}.json';output.parent.mkdir(exist_ok=True)
   raw=encoded(normalized)
   if output.exists():require(output.read_bytes()==raw,'Verified source drift')
   else:output.write_bytes(raw)
   source_file=f'public-choice-previews/{qid}.json';source_hash=hashlib.sha256(raw).hexdigest();sources[source_file]=source_hash
   for i,choice in enumerate(choices):
    if choice['swaps']:
     coordinate=choice['coordinate'];points.append(dict(id=f'{qid}:swap:{coordinate[0]},{coordinate[1]}',coordinate=coordinate,
       pathIndices=[p['index'] for p in public['paths'] if coordinate in p['coordinates']],options=choice['swaps'],
       source=dict(file=source_file,sha256=source_hash,pointer=f'/choices/{i}',capturedAt=receipt['receivedAt'])))
    elif not choice['previewCaptured']:unresolved.append(choice['coordinate'])
   coverage='partial' if unresolved and points else 'uncaptured' if unresolved else 'captured'
  else:
   unresolved=frozen[qid]['coordinates']
   coverage='captured' if frozen[qid]['coverage']=='captured' and not unresolved else 'uncaptured'
  maps[qid]=dict(questId=qid,mapId=expected['mapId'],sourceHash=expected['sourceHash'],publicMapSha256=expected['publicMapSha256'],coverage=coverage,
                  points=points,unresolvedChoiceCoordinates=unresolved,definitionSources=sources)
  counts['maps']+=1;counts['swapMaps']+=bool(points);counts['swapPoints']+=len(points);counts['unverifiedMaps']+=coverage!='captured';counts['unresolvedChoiceNodes']+=len(unresolved)
 return dict(version=1,maps=maps,counts=counts,sourceIndexSha256=sha(evidence/'source-index.json'),
             projectionSha256=sha(Path(__file__).with_name('swap_projection.py')),exporterSha256=sha(Path(__file__)),nativeSemanticsSources=index['nativeSemanticsSources'])

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--evidence-root',type=Path,default=REPO/'temp/quest-swaps-20261118');p.add_argument('--public-root',type=Path,default=REPO/'src/data/game-quests');p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/swap-points.json');p.add_argument('--verify',action='store_true');a=p.parse_args()
 result=build(a.evidence_root,a.public_root);raw=encoded(result)
 if a.verify:require(a.output.read_bytes()==raw,'Swap overlay drift')
 else:a.output.write_bytes(raw)
 print(json.dumps(dict(verified=a.verify,sha256=hashlib.sha256(raw).hexdigest(),counts=result['counts'])))
if __name__=='__main__':main()
