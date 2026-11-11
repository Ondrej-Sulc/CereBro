"""Additive quest icon projection from frozen node v2 build inputs; never imports sibling runtime code."""
import argparse,json,sys
from collections import Counter
from pathlib import Path
from build_application_icons import REPO,read,sha,digest

NODE_ROOT=Path('C:/Users/ossul/.t3/worktrees/CereBro/t3-42693f98')
INDEX='src/data/game-node-modifiers/v2/source-index.json'
INDEX_SHA='9fc9209fbd623aa9ceb0500362cd51d2524c177279c1e2a57ee41bc7afb7a793'
BCG=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only/sources/bcg-E95E28EECECC04D6A358C8FD8089D01305D0FB73.bin')
SCHEMA=Path('C:/Code/CereBro/temp/crystals/schema.json')
ORIGINAL=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only')
BASE_EXPANDED_SHA='98eafca53228033fe30e2c9ab13b9a3fc575c304f3eee8773e4758a35cf2db2d'
BASE_OLD_SHA='7e31a16f13fcd6f9ab57cf0b3097cfe6afea719f88ae2c0fa2cae345ffd58e35'

def safe_path(root,relative):
 if not isinstance(relative,str) or not relative or '\\' in relative or ':' in relative or '..' in relative.split('/') or Path(relative).is_absolute():raise ValueError('Unsafe source path')
 path=(root/relative).resolve()
 if not path.is_relative_to(root.resolve()):raise ValueError('Source path escaped root')
 return path

def pointer(value,path):
 for part in path.split('/')[1:]:value=value[int(part)] if isinstance(value,list) else value[part]
 return value

def require(condition,message):
 if not condition:raise ValueError(message)

def version(raw,components,bcg):
 ids=(raw.get('buffStatMods') or raw.get('valueStr') or []) if raw.get('buffType') in ('statMods','statModsWithAuth') else []
 require(isinstance(ids,list) and all(isinstance(i,str) for i in ids),'Invalid native component list')
 linked=[dict(id=i,hash=digest(components[i]),raw=components[i]) for i in ids if i in components]
 missing=[i for i in ids if i not in components]
 return dict(hash=digest(dict(raw=raw,components=linked,missingComponentIds=missing,sourceBcgSha256=bcg)),definitionHash=digest(raw),components=linked,missingComponentIds=missing)

def native_shape(raw,v,glyph,appearances):
 if raw.get('iconTexture') or raw.get('glyphIcon'):return None
 if raw.get('buffType') in ('statMods','statModsWithAuth'):
  ids=raw.get('valueStr') or []
  first=next((c for c in v['components'] if ids and c['id']==ids[0]),None)
  if not first:return None
  appearance_id=first['raw'].get('AppearanceID');appearance=appearances.get(appearance_id)
  if not appearance or appearance.get('IconTexture','')!=glyph:return None
  return dict(kind='first-component-appearance-glyph',componentId=first['id'],appearanceId=appearance_id,appearanceHash=digest(appearance))
 if raw.get('buffType')=='bcg' and glyph in ('H','k','\u00a2'):
  return dict(kind='captured-bcg-glyph',componentId=None,appearanceId=None)
 return None

def load_context(node_root=NODE_ROOT):
 path=safe_path(node_root,INDEX);require(sha(path)==INDEX_SHA,'Frozen source-index drift');index=read(path)
 require(index['contract']=='cerebro.node-modifier-build-sources/v2','Source contract drift')
 require(digest({k:v for k,v in index.items() if k!='contentHash'})==index['contentHash'],'Source content hash drift')
 pins={};values={}
 for row in index['artifacts']+index['definitions']+index['glyphAssets']+index['sharedRendererSources']:
  p=safe_path(node_root,row['path']);require(sha(p)==row['sha256'],'Pinned input drift: '+row['path']);pins[row['path']]=row['sha256']
 for row in index['artifacts']:values[Path(row['path']).name]=read(safe_path(node_root,row['path']))
 native_index,profile,art,bindings=[values[n] for n in ['index.json','source-profile.json','artwork.json','icon-bindings.json']]
 require(index['catalogHash']==native_index['catalogHash']==art['catalogHash']==bindings['catalogHash'],'Catalog identity drift')
 require(bindings['artworkHash']==art['contentHash'],'Artwork identity drift')
 for doc in [art,bindings]:require(digest({k:v for k,v in doc.items() if k!='contentHash'})==doc['contentHash'],'Proof content hash drift')
 bcg=profile['bcgSha256'];require(bcg==art['bcgSha256']==bindings['bcgSha256']==native_index['profile']['bcgSha256']==sha(BCG),'BCG source drift')
 require(sha(SCHEMA)==profile['schemaSha256']==art['schemaSha256'],'Schema source drift')
 # Decode the retained native registry ourselves, without a sibling Python/runtime import.
 sys.path.insert(0,str(REPO/'scripts'));from mcoc_protobuf import Decoder,fields
 decoder=Decoder(read(SCHEMA));tables={1:{},2:{}}
 for tag,wire,value,_ in fields(BCG.read_bytes()):
  if tag not in tables:continue
  row=decoder.message(value,'BCGStatModifier' if tag==1 else 'BCGStatModifierAppearance')
  require(row['ID'] not in tables[tag],'Duplicate native component/appearance');tables[tag][row['ID']]=row
 require(not decoder.unknown,'Unknown native schema field')
 components,appearances=tables[1],tables[2]
 assets={row['glyph']:row for row in index['glyphAssets']}
 require(len(assets)==24,'Frozen glyph asset count drift')
 for row in index['glyphAssets']+index['sharedRendererSources']:require(sha(safe_path(REPO,row['path']))==row['sha256'],'Local shared asset/renderer drift')
 for name,expected in index['immutableBaseline'].items():require(sha(safe_path(node_root,'src/data/game-node-modifiers/'+name))==expected,'Original node input drift')
 old_art=read(safe_path(node_root,'src/data/game-node-modifiers/artwork.json'))
 require(art['rendererProfile']==old_art['profile'],'Native renderer proof drift')
 for evidence in art['rendererProfile']['evidence']:require(sha(Path(evidence['path']))==evidence['sha256'],'Native renderer source drift')
 versions={};app_hashes={};details={}
 for row in index['definitions']:
  detail=read(safe_path(node_root,row['path']));require(detail['catalogHash']==index['catalogHash'],'Detail catalog drift')
  for vi,v in enumerate(detail['definition']['versions']):
   recomputed=version(v['raw'],components,bcg)
   require(v['sourceBcgSha256']==bcg and v['definitionHash']==recomputed['definitionHash'] and v['hash']==recomputed['hash'] and v['components']==recomputed['components'] and v['missingComponentIds']==recomputed['missingComponentIds'],'Full definition/component version drift')
   require(detail['definition']['id']==v['raw']['id'],'Detail identity drift')
   h=v['definitionHash'];require(h not in versions,'Duplicate raw definition version');versions[h]=dict(recomputed,raw=v['raw']);details[h]=dict(path=row['path'],sha256=row['sha256'],pointer=f'/definition/versions/{vi}')
   for app in v['applications']:
    require(digest(app['raw'])==app['hash'],'Native application hash drift')
    app_hashes.setdefault((v['hash'],app['raw'].get('buffAppearance')),set()).add(app['hash'])
 verified={};proofs=[]
 for bi,b in enumerate(bindings['bindings']):
  require(b['status']=='verified','Unverified binding in frozen bindings');matches=[(h,v) for h,v in versions.items() if v['raw']['id']==b['effectId'] and v['hash']==b['versionHash']]
  require(len(matches)==1,'Binding definition/version absent');h,v=matches[0];shape=native_shape(v['raw'],v,b['glyph'],appearances)
  require(shape and all(b.get(k)==value for k,value in shape.items()),'Native component/appearance/glyph drift')
  asset=assets.get(b['glyph']);require(asset and asset['path']==b['svgPath'] and asset['sha256']==b['svgSha256'] and asset['iconKey']==b['iconKey']=='node-glyph-'+b['svgSha256'][:16],'Native SVG/key drift')
  require(set(b['applicationHashes'])<=app_hashes.get((v['hash'],b['glyph']),set()),'Bound application source absent')
  proof=dict(effectId=b['effectId'],definitionHash=h,versionHash=v['hash'],glyph=b['glyph'],iconKey=b['iconKey'],svgSha256=b['svgSha256'],componentHashes=[dict(id=c['id'],hash=c['hash']) for c in v['components']],missingComponentIds=v['missingComponentIds'],definitionSource=details[h],bindingSource=dict(path='src/data/game-node-modifiers/v2/icon-bindings.json',sha256=pins['src/data/game-node-modifiers/v2/icon-bindings.json'],pointer=f'/bindings/{bi}'),**shape)
  key=(h,b['glyph']);require(key not in verified,'Ambiguous definition/glyph binding');verified[key]=len(proofs);proofs.append(proof)
 require(len(proofs)==596,'Frozen binding count drift')
 return dict(index=index,pins=pins,profile=profile,bcg=bcg,components=components,appearances=appearances,assets=assets,versions=versions,bindings=verified,proofs=proofs,applicationHashes=app_hashes)

def match(app,context):
 raw=app['buff'];h=digest(raw);glyph=app.get('buffAppearance');v=context['versions'].get(h)
 if not v:return None,'definitionVersionAbsent'
 # The stored version was independently recomputed from this complete raw hash and native BCG.
 if raw.get('id')!=v['raw']['id']:return None,'definitionIdentityDrift'
 ahash=digest({k:value for k,value in app.items() if k not in ('buff','sourceCoordinate')})
 if ahash not in context['applicationHashes'].get((v['hash'],glyph),set()):return None,'applicationContextAbsent'
 proof=context['bindings'].get((h,glyph))
 if proof is None:
  ids=raw.get('valueStr') or []
  if raw.get('buffType') in ('statMods','statModsWithAuth') and not any(ids and c['id']==ids[0] for c in v['components']):return None,'nativeFirstComponentUnresolved'
  if not glyph or len(glyph)!=1:return None,'nativeGlyphMissing'
  shape=native_shape(raw,v,glyph,context['appearances'])
  if shape and glyph not in context['assets']:return None,'nativeGlyphShapeNotExported'
  return None,'nativeRendererBindingUnproved'
 return proof,'verifiedV2'

def build(output,node_root=NODE_ROOT):
 require(output.resolve().is_relative_to(REPO.resolve()) and output.resolve() not in {(REPO/'src/data/game-quests'/n).resolve() for n in ['application-icons.json','application-icons-expanded.json']},'Output must remain in this checkout and preserve immutable baselines')
 context=load_context(node_root);public=read(REPO/'src/data/game-quests/progressed.json')
 require(public['bcgSha256']==context['bcg'],'Quest projection BCG drift')
 base_path=REPO/'src/data/game-quests/application-icons-expanded.json';require(sha(base_path)==BASE_EXPANDED_SHA,'Immutable169-map baseline drift')
 old_path=REPO/'src/data/game-quests/application-icons.json';require(sha(old_path)==BASE_OLD_SHA,'Immutable original49-map baseline drift');baseline={**read(old_path)['maps'],**read(base_path)['maps']};public_ids=set(public['publicQuestIds'])
 require(len(baseline)==218 and sum(len(m['applications']) for m in baseline.values())==51718,'Baseline coverage drift')
 maps={};counts=Counter();source_hashes={};source_cache={};used=set();unbound_shapes=Counter()
 for source in context['profile']['maps']:
  qid=source['questId']
  if qid not in public_ids:continue
  require(qid not in maps,'Repeated current quest source');base=baseline[qid]
  root=REPO if source['root']=='quest' else ORIGINAL if source['root']=='original' else None;require(root is not None,'Unknown source root')
  path=safe_path(root,source['path']);require(sha(path)==source['sha256']==base['sourceHash'],'Quest source hash drift')
  doc=source_cache.get(path)
  if doc is None:
   doc=read(path)
   if source['pointer']!='/map':source_cache[path]=doc
  require(doc['gameAssemblySha256']==context['profile']['gameAssemblySha256'],'Quest binary version drift')
  native=pointer(doc,source['pointer']);summary=pointer(doc,source['summaryPointer']);require(summary['qid']==qid and summary['mapId']==base['mapId'],'Quest map identity drift')
  apps={};coverage=Counter()
  for ti,tile in enumerate(native['walkableTiles']):
   for side in ['attacker','defender']:
    for ai,app in enumerate(tile[side+'Buffs'] or []):
     identity=f"{tile['x']},{tile['y']}:{side}:{ai}";pi,reason=match(app,context);coverage[reason]+=1;counts[reason]+=1
     if reason=='nativeGlyphShapeNotExported':unbound_shapes[app['buffAppearance']]+=1
     previous=base['applications'].get(identity)
     if pi is not None:
      proof=context['proofs'][pi]
      if previous:require(previous['effectId']==proof['effectId'] and previous['versionHash']==proof['versionHash'] and previous['iconKey']==proof['iconKey'],'Frozen baseline binding disagreement')
      else:apps[identity]=pi;used.add(pi);counts['addedBindings']+=1
     if previous:counts['baselineBindings']+=1
  maps[qid]=dict(mapId=base['mapId'],sourceHash=base['sourceHash'],sourcePointer=source['pointer'],applications=apps,coverage=dict(coverage));source_hashes[source['root']+':'+source['path']]=source['sha256']
 require(set(maps)==set(baseline) and counts['baselineBindings']==51718,'Current map/application join drift')
 total=sum(counts[k] for k in ['verifiedV2','definitionVersionAbsent','nativeGlyphShapeNotExported','nativeGlyphMissing','nativeFirstComponentUnresolved','nativeRendererBindingUnproved','applicationContextAbsent','definitionIdentityDrift']);require(total==212720,'Assignment total drift')
 counts['totalApplications']=total;counts['mergedBindings']=counts['baselineBindings']+counts['addedBindings'];counts['remainingUnbound']=total-counts['mergedBindings']
 # Only used proof metadata and newly proved assignment references; no copied detail/raw catalogs.
 order=sorted(used);remap={old:new for new,old in enumerate(order)}
 for row in maps.values():row['applications']={k:remap[v] for k,v in row['applications'].items()}
 result=dict(contract='cerebro.quest-native-icons/v2',sourceIndexSha256=INDEX_SHA,sourceCatalogHash=context['index']['catalogHash'],bcgSha256=context['bcg'],schemaSha256=context['profile']['schemaSha256'],exporterSha256=sha(Path(__file__)),baselines={'application-icons.json':sha(old_path),'application-icons-expanded.json':sha(base_path)},sourceArtifacts={row['path']:row['sha256'] for row in context['index']['artifacts']},sourceMaps=source_hashes,verifiedInputFiles=len(context['pins']),counts=dict(counts),unboundShapeCounts=dict(sorted(unbound_shapes.items())),proofs=[context['proofs'][i] for i in order],maps=maps,policy='Additive exact complete raw definition/component version/BCG/captured application context/glyph/native SVG join. Only new source-map/application references; client receives nullable finite iconKey. No curated associations.')
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');print(dict(counts))
 coverage=dict(contract='cerebro.quest-native-icon-coverage/v2',sourceIndexSha256=INDEX_SHA,artifactSha256=sha(output),inputDefinitionGlyphBindings=596,additiveProofs=len(order),unboundNativeShapes=len(unbound_shapes),maps=len(maps),curatedAssociations=0,**dict(counts))
 output.with_name('application-icon-coverage-v2.json').write_text(json.dumps(coverage,separators=(',',':'))+'\n',encoding='utf-8')

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--node-root',type=Path,default=NODE_ROOT);p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/application-icons-v2.json');args=p.parse_args();build(args.output,args.node_root)
