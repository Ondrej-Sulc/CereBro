"""Quest-only additive native glyph bindings from frozen, read-only v3 proofs."""
import argparse,functools,json,math,xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from build_application_icons import REPO,read,sha,digest
from build_native_icons_v2 import NODE_ROOT,ORIGINAL,INDEX_SHA as V2_INDEX_SHA,BASE_OLD_SHA,BASE_EXPANDED_SHA,safe_path,pointer,require,load_context as load_v2,match as match_v2,native_shape

INDEX='src/data/game-node-modifiers/v3-native-icons/source-index.json'
INDEX_SHA='72947e3803b19069ade45728333e9cd92ecbdbd66d4cec91d3f1ccd89b61eb9f'
BASE_V2_SHA='5ec667a2447e8541433dc75f2839b7971ce861d3e6c76d8923170ebab36f0861'
RUNTIME={
 'src/domain/node-modifiers/native-game-icon-registry.ts':'ca228e4c9fe0ab27b4101d7a3eae6326190d4c92cb2c89887d27f86d19e5ea7d',
 'src/domain/node-modifiers/native-game-icons.ts':'e0aec203313070cbe4670f41e27dde2922de79f5db94e31547c57b7128983b69',
 'web/src/components/nodes/GameNodeModifierIcon.tsx':'59d579a0d5b5154ab933c4a37cc3e586940a9bc9fb4610d7e5e87856d241edfd',
}

def load_sources(node_root=NODE_ROOT):
 path=safe_path(node_root,INDEX);require(sha(path)==INDEX_SHA,'Frozen v3 source-index drift');index=read(path)
 require(index['contract']=='cerebro.node-game-icon-extension-sources/v3','V3 source contract drift')
 require(digest({k:v for k,v in index.items() if k!='contentHash'})==index['contentHash'],'V3 index content drift')
 pins={}
 for row in index['artifacts']+index['assets']+index['exporters']+[index['baseSourceIndex'],index['registry']]:
  path=safe_path(node_root,row['path']);require(sha(path)==row['sha256'],'V3 pinned input drift: '+row['path']);pins[row['path']]=row['sha256']
 require(index['baseSourceIndex']['sha256']==V2_INDEX_SHA,'V2 base index drift')
 for relative,expected in RUNTIME.items():
  require(sha(safe_path(node_root,relative))==expected and sha(safe_path(REPO,relative))==expected,'Approved runtime copy drift')
 documents={Path(row['path']).name:read(safe_path(node_root,row['path'])) for row in index['artifacts']}
 for doc in documents.values():
  require(digest({k:v for k,v in doc.items() if k!='contentHash'})==doc['contentHash'],'V3 proof content drift')
  require(doc['baseSourceIndexSha256']==V2_INDEX_SHA and doc['catalogHash']==index['catalogHash'],'V3 proof identity drift')
 glyphs,bindings,applications,overlay=[documents[n] for n in ['glyphs.json','icon-bindings.json','application-proofs.json','overlay.json']]
 require(glyphs['contract']=='cerebro.node-native-glyphs/v3' and bindings['contract']=='cerebro.node-game-icon-bindings/v3' and applications['contract']=='cerebro.node-game-icon-applications/v3' and overlay['contract']=='cerebro.node-game-icon-overlay/v3','V3 proof contract drift')
 require(bindings['glyphArtifactHash']==glyphs['contentHash'] and applications['bindingArtifactHash']==overlay['bindingArtifactHash']==bindings['contentHash'],'V3 proof linkage drift')
 require(glyphs['fontSha256']==index['fontSha256'],'Native font identity drift')
 assets={row['glyph']:row for row in index['assets']};require(len(assets)==len(glyphs['glyphs'])==204,'Finite glyph count drift')
 for glyph in glyphs['glyphs']:
  asset=assets.get(glyph['glyph']);require(asset and glyph['status']=='verified' and len(glyph['glyph'])==1,'Native glyph identity drift')
  require(glyph['codepoint']==f"U+{ord(glyph['glyph']):04X}" and glyph['glyphIndex']>0 and glyph['outlineSha256'],'Native cmap/outline drift')
  require(asset['path']=='web/public'+glyph['src'] and asset['sha256']==glyph['sha256'] and asset['iconKey']==glyph['iconKey']=='node-game-glyph-'+glyph['sha256'][:16],'Native glyph asset/key drift')
  require(sha(safe_path(REPO,asset['path']))==asset['sha256'],'Local native SVG drift')
  x0,y0,x1,y1=glyph['pathBounds'];pad=glyph['padding'];expected=[x0-pad,y0-pad,x1-x0+2*pad,y1-y0+2*pad]
  require(x1>x0 and y1>y0 and all(math.isclose(a,b,abs_tol=.0011) for a,b in zip(expected,glyph['viewBox'])),'Native glyph frame drift')
  svg=ET.fromstring(safe_path(node_root,asset['path']).read_text(encoding='utf-8'))
  require([float(v) for v in svg.attrib['viewBox'].split()]==glyph['viewBox'],'SVG frame mismatch')
  require(any(e.tag.endswith('path') and e.attrib.get('d') for e in svg.iter()),'Empty native outline')
 return dict(index=index,pins=pins,assets=assets,glyphs={g['glyph']:g for g in glyphs['glyphs']},documents=documents)

def verify_binding(binding,base,sources,source_document):
 full=binding['fullDefinition'];v=base['versions'].get(full['definitionHash']);require(v is not None,'Complete raw definition absent')
 require(binding['status']=='verified' and v['raw']['id']==binding['effectId']==full['effectId'] and v['hash']==binding['versionHash']==full['versionHash'],'Full native version drift')
 require(full['sourceBcgSha256']==base['bcg'] and full['componentHashes']==[dict(id=c['id'],hash=c['hash']) for c in v['components']] and full['missingComponentIds']==v['missingComponentIds'],'Native component/missing-component drift')
 raw_source=pointer(source_document(full['source']),full['source']['pointer'])
 require(raw_source['raw']==v['raw'] and raw_source['hash']==v['hash'] and raw_source['definitionHash']==full['definitionHash'],'Definition source pointer drift')
 shape=native_shape(v['raw'],v,binding['glyph'],base['appearances'])
 require(shape and all(binding.get(k)==value for k,value in shape.items()),'Captured glyph/native appearance drift')
 glyph=sources['glyphs'].get(binding['glyph']);asset=sources['assets'].get(binding['glyph'])
 require(glyph and asset and binding['fontSha256']==sources['index']['fontSha256'] and binding['glyphIndex']==glyph['glyphIndex'],'Native font/cmap binding drift')
 require(binding['iconKey']==asset['iconKey'] and binding['svgPath']==asset['path'] and binding['svgSha256']==asset['sha256'],'Native SVG binding drift')
 require(set(binding['applicationHashes'])<=base['applicationHashes'].get((v['hash'],binding['glyph']),set()),'Observed native application absent')
 return v,shape

def load_context(node_root=NODE_ROOT):
 sources=load_sources(node_root);base=load_v2(node_root);index=sources['index'];documents=sources['documents']
 require(index['bcgSha256']==base['bcg'] and index['catalogHash']==base['index']['catalogHash'],'BCG/catalog version drift')
 require(documents['glyphs.json']['rendererProfile']==read(safe_path(node_root,'src/data/game-node-modifiers/artwork.json'))['profile'],'Frozen native renderer drift')
 @functools.lru_cache(maxsize=8)
 def pinned_document(relative,expected):
  require(base['pins'].get(relative)==expected,'Unlisted v2 proof reference');path=safe_path(node_root,relative);require(sha(path)==expected,'V2 proof reference drift');return read(path)
 def source_document(ref):return pinned_document(ref['path'],ref['sha256'])
 bindings={};proofs=[];allowed={}
 for bi,b in enumerate(documents['icon-bindings.json']['bindings']):
  v,shape=verify_binding(b,base,sources,source_document);h=v['definitionHash'];key=(h,b['glyph']);require(key not in bindings,'Duplicate native version/glyph binding')
  bindings[key]=len(proofs);allowed[key]=set(b['applicationHashes'])
  proofs.append(dict(effectId=b['effectId'],definitionHash=h,versionHash=v['hash'],glyph=b['glyph'],iconKey=b['iconKey'],svgSha256=b['svgSha256'],fontSha256=b['fontSha256'],glyphIndex=b['glyphIndex'],componentHashes=b['fullDefinition']['componentHashes'],missingComponentIds=v['missingComponentIds'],definitionSource=b['fullDefinition']['source'],bindingSource=dict(path='src/data/game-node-modifiers/v3-native-icons/icon-bindings.json',sha256=sources['pins']['src/data/game-node-modifiers/v3-native-icons/icon-bindings.json'],pointer=f'/bindings/{bi}'),**shape))
 require(len(bindings)==1089,'V3 binding count drift')
 observed=set()
 for app in documents['application-proofs.json']['applications']:
  raw_source=pointer(source_document(app['source']),app['source']['pointer']);v2_proof=pointer(source_document(app['sourceV2Proof']),app['sourceV2Proof']['pointer'])
  require(raw_source['hash']==digest(raw_source['raw'])==app['applicationHash'] and raw_source['raw'].get('buffAppearance')==app['glyph'],'Application source hash/glyph drift')
  require(v2_proof['effectId']==app['effectId'] and v2_proof['versionHash']==app['versionHash'] and v2_proof['applicationHash']==app['applicationHash'] and v2_proof['glyph']==app['glyph'],'V2 application proof identity drift')
  key=next((k for k,pi in bindings.items() if proofs[pi]['effectId']==app['effectId'] and proofs[pi]['versionHash']==app['versionHash'] and k[1]==app['glyph']),None)
  require(key is not None and app['applicationHash'] in allowed[key] and app['iconKey']==proofs[bindings[key]]['iconKey'] and app['svgSha256']==proofs[bindings[key]]['svgSha256'],'V3 application binding drift')
  require(app['status']=='verified' and all(app.get(k)==proofs[bindings[key]].get(k) for k in ['fontSha256','glyphIndex','kind','componentId','appearanceId','appearanceHash']),'V3 application renderer proof drift')
  observed.add((key,app['applicationHash']))
 require(len(observed)==3894 and len(documents['application-proofs.json']['unresolved'])==5,'Observed application count drift')
 require(all((key,h) in observed for key,hashes in allowed.items() for h in hashes),'Partial observed application proof')
 return dict(base=base,sources=sources,proofs=proofs,bindings=bindings,allowed=allowed,sourceDocument=source_document)

def match(app,context):
 raw=app['buff'];h=digest(raw);glyph=app.get('buffAppearance');v=context['base']['versions'].get(h)
 if not v:return None,'definitionVersionAbsent'
 ahash=digest({k:value for k,value in app.items() if k not in ('buff','sourceCoordinate')})
 if ahash not in context['base']['applicationHashes'].get((v['hash'],glyph),set()):return None,'applicationContextAbsent'
 key=(h,glyph);pi=context['bindings'].get(key)
 if pi is None:return None,match_v2(app,context['base'])[1]
 if ahash not in context['allowed'][key]:return None,'applicationProofAbsent'
 return pi,'verifiedV3'

def build(output,node_root=NODE_ROOT):
 require(output.resolve().is_relative_to(REPO.resolve()) and output.name=='application-icons-v3.json','Output must be a new named v3 artifact in this checkout')
 context=load_context(node_root);base=context['base'];public=read(REPO/'src/data/game-quests/progressed.json')
 require(public['bcgSha256']==base['bcg'],'Quest source BCG drift')
 names={'application-icons.json':BASE_OLD_SHA,'application-icons-expanded.json':BASE_EXPANDED_SHA,'application-icons-v2.json':BASE_V2_SHA}
 for name,expected in names.items():require(sha(REPO/'src/data/game-quests'/name)==expected,'Frozen quest baseline drift: '+name)
 original=read(REPO/'src/data/game-quests/application-icons.json');expanded=read(REPO/'src/data/game-quests/application-icons-expanded.json');v2=read(REPO/'src/data/game-quests/application-icons-v2.json')
 baseline={**original['maps'],**expanded['maps']};maps={};counts=Counter();used=set();samples=[];cached={};public_ids=set(public['publicQuestIds'])
 for source in base['profile']['maps']:
  qid=source['questId']
  if qid not in public_ids:continue
  require(qid not in maps,'Duplicate public map');old=baseline[qid];middle=v2['maps'][qid]
  require(old['sourceHash']==middle['sourceHash']==source['sha256'] and old['mapId']==middle['mapId'],'Baseline map identity drift')
  root=REPO if source['root']=='quest' else ORIGINAL if source['root']=='original' else None;require(root is not None,'Unknown source root');path=safe_path(root,source['path']);require(sha(path)==source['sha256'],'Current map source drift')
  document=cached.get(path)
  if document is None:
   document=read(path)
   if source['pointer']!='/map':cached[path]=document
  require(document['gameAssemblySha256']==base['profile']['gameAssemblySha256'],'Current native build drift')
  native=pointer(document,source['pointer']);summary=pointer(document,source['summaryPointer']);require(summary['qid']==qid and summary['mapId']==old['mapId'],'Current map/quest join drift')
  added={};coverage=Counter()
  for tile in native['walkableTiles']:
   for side in ['attacker','defender']:
    for ai,app in enumerate(tile[side+'Buffs'] or []):
     identity=f"{tile['x']},{tile['y']}:{side}:{ai}";previous=old['applications'].get(identity);mi=middle['applications'].get(identity)
     if mi is not None:require(previous is None,'Frozen baseline overlap');previous=v2['proofs'][mi]
     pi,reason=match(app,context);counts['totalApplications']+=1
     if previous:
      old_pi,old_reason=match_v2(app,base);require(old_pi is not None,'Frozen baseline no longer verifies');proof=base['proofs'][old_pi]
      require(all(previous[k]==proof[k] for k in ['effectId','versionHash','iconKey']),'Frozen baseline disagreement');counts['baselineBindings']+=1;coverage['baselineBindings']+=1
      if pi is not None:require(context['proofs'][pi]['iconKey']==previous['iconKey'],'Additive binding conflicts with baseline')
     elif pi is not None:added[identity]=pi;used.add(pi);counts['addedBindings']+=1;coverage['addedBindings']+=1
     else:
      counts[reason]+=1;coverage[reason]+=1
      samples.append(dict(questId=qid,mapId=old['mapId'],sourceHash=old['sourceHash'],applicationId=identity,effectId=app['buff']['id'],reason=reason))
  maps[qid]=dict(mapId=old['mapId'],sourceHash=old['sourceHash'],sourcePointer=source['pointer'],applications=added,coverage=dict(coverage))
 require(set(maps)==set(baseline) and len(maps)==218 and counts['baselineBindings']==149998 and counts['totalApplications']==212720,'Current assignment join drift')
 counts['mergedBindings']=counts['baselineBindings']+counts['addedBindings'];counts['remainingUnbound']=counts['totalApplications']-counts['mergedBindings']
 order=sorted(used);remap={old:new for new,old in enumerate(order)}
 for row in maps.values():row['applications']={key:remap[value] for key,value in row['applications'].items()}
 result=dict(contract='cerebro.quest-native-icons/v3',sourceIndexSha256=INDEX_SHA,baseSourceIndexSha256=V2_INDEX_SHA,catalogHash=base['index']['catalogHash'],bcgSha256=base['bcg'],schemaSha256=base['profile']['schemaSha256'],fontSha256=context['sources']['index']['fontSha256'],exporterSha256=sha(Path(__file__)),baselines=names,sourceArtifacts={row['path']:row['sha256'] for row in context['sources']['index']['artifacts']},verifiedV3InputFiles=len(context['sources']['pins']),counts=dict(counts),proofs=[context['proofs'][pi] for pi in order],maps=maps,unresolved=samples,policy='Additive exact raw/component/missing-component/BCG version, captured application/glyph and native SVG/key. Previous ledgers immutable. Finite iconKey only in clients; no curated association.')
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
 coverage=dict(contract='cerebro.quest-native-icon-coverage/v3',sourceIndexSha256=INDEX_SHA,artifactSha256=sha(output),inputBindings=1089,inputApplicationIdentities=3894,additiveProofs=len(order),nativeShapeAssets=204,totalFiniteShapes=228,maps=len(maps),curatedAssociations=0,**dict(counts))
 output.with_name('application-icon-coverage-v3.json').write_text(json.dumps(coverage,separators=(',',':'))+'\n',encoding='utf-8');print(dict(counts))

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--node-root',type=Path,default=NODE_ROOT);p.add_argument('--output',type=Path,default=REPO/'src/data/game-quests/application-icons-v3.json');args=p.parse_args();build(args.output,args.node_root)
