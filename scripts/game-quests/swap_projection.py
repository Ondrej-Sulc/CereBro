"""Pure public quest choice projection; no transport or game-reader imports.

Wire grids may include empty padding rows and numeric-string portal coordinates.
Only exact map identity, walkable positions, connection endpoints and portal targets
establish a binding. Duplicate ordinary encodings of portal edges are equivalent.
"""
import re
SWAP_IDS={'teamswap','swapteamselect','swapteamselect_alt1'}
class Stop(ValueError):pass
def xy(p):
 if type(p) is not dict:raise Stop('coordinate_shape')
 out=[]
 for key in ('x','y'):
  value=p.get(key)
  if type(value) is str and re.fullmatch('-?(?:0|[1-9][0-9]{0,4})',value):value=int(value)
  if type(value) not in (int,float) or not -10000<=value<=10000 or value!=int(value):raise Stop('coordinate_shape')
  out.append(int(value))
 return out
def swap(option):
 if type(option) is not dict or option.get('choiceId') not in SWAP_IDS:raise Stop('swap_identity')
 out={'choiceId':option['choiceId'],'nativeDefaultsApplied':[]}
 for key,default in [('swapCount',1),('minSwaps',0)]:
  if key in option:
   value=option[key]
   if type(value) is not int or not 0<=value<=100:raise Stop('swap_count_shape')
  else:
   value=default;out['nativeDefaultsApplied'].append({'field':key,'value':default,'basis':'native-constructor'})
  out[key]=value
 if out['swapCount']>0 and out['minSwaps']>out['swapCount']:raise Stop('swap_range')
 return out
def public_response(packet,qid,status,expected=None,target=None):
 if status!=200:raise Stop('http_status_stop')
 if type(packet) is not dict or packet.get('err') or packet.get('error'):raise Stop('server_error_stop')
 result=packet.get('result')
 if type(result) is not dict or type(result.get('data')) is not dict or type(result.get('map')) is not dict:raise Stop('response_shape')
 if expected is None:raise Stop('binding_required')
 data,m=result['data'],result['map']
 if (data.get('qid'),data.get('mapId'),data.get('setId'))!=(qid,expected['mapId'],expected['definitionSetId']):raise Stop('map_identity')
 if expected['nativeMapHash'] is not None and (m.get('hash') or '')!=expected['nativeMapHash']:raise Stop('native_map_hash')
 dimension=m.get('gridDimension');grid=m.get('grid')
 if type(dimension) is not int or not 0<dimension<=256 or type(grid) is not list or len(grid)>256 or any(type(row) is not list or len(row)>256 for row in grid):raise Stop('map_grid')
 coords=[];edges=[];portals=[];choices=[]
 for row in grid:
  for tile in row:
   if not tile or not tile.get('walkable'):continue
   coordinate=xy(tile);coords.append(coordinate)
   for key,output in [('links',edges),('pt',portals)]:
    links=tile.get(key) or []
    if type(links) is not list:raise Stop('link_shape')
    output.extend([*coordinate,*xy(to)] for to in links)
   flag=tile.get('choice',False)
   if type(flag) is not bool:raise Stop('choice_flag_shape')
   if not flag:continue
   options=tile.get('choices')
   if options is None:options=[]
   if type(options) is not list or len(options)>100:raise Stop('choice_list_shape')
   swaps=[];other=[]
   for option in options:
    if type(option) is not dict or type(option.get('choiceId')) is not str or not re.fullmatch('[A-Za-z0-9_-]{1,160}',option['choiceId']):raise Stop('choice_identity_shape')
    if option['choiceId'] in SWAP_IDS:swaps.append(swap(option))
    else:other.append(option['choiceId'])
   choices.append({'coordinate':coordinate,'previewCaptured':bool(options),'swaps':swaps,'otherChoiceIds':other})
 if len(coords)!=len({tuple(c) for c in coords}) or sorted(coords)!=sorted(expected['coordinates']) or {tuple(e) for e in edges+portals}!={tuple(e) for e in expected['edges']+expected['portals']} or sorted(portals)!=expected['portals']:
  error=Stop('map_geometry');error.publicGeometry={'coordinates':coords,'edges':edges,'portals':portals,'choices':choices,'questId':qid,'mapId':expected['mapId'],'nativeMapHash':m.get('hash') or ''};raise error
 return {'questId':qid,'mapId':expected['mapId'],'sourceHash':expected['sourceHash'],'publicMapSha256':expected['publicMapSha256'],'nativeMapHash':m.get('hash') or '', 'choices':choices}
