"""Read only public Tower definitions and native art filesystem mounts; opt-in."""
import json,sys,datetime,hashlib
from pathlib import Path
from capture_source_art import validate_support,PINS,sha
root=Path('temp/quest-explorer-review/permanent-20261109')
support=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only')
validate_support(support);sys.dont_write_bytecode=True;sys.path.insert(0,str(support))
from read_memory import Memory,find_game
from capture_quests import QuestReader
layout=json.loads((root/'layouts.json').read_text())
for x in layout['sources']:assert sha(Path(x['path']))==x['sha256']
pid,mod=find_game();assert sha(Path(mod['path']))==PINS['GameAssembly.dll']
class Bounded(Memory):
 def read(self,a,s):
  if self.reads>20000 or self.bytes+s>2*1024*1024:raise ValueError('Public support budget')
  return super().read(a,s)
m=Bounded(pid)
try:
 r=QuestReader(m);r.types=layout['types']
 def field(p,k,n):return r.field(p,k,n)
 tm=m.ptr(m.ptr(m.ptr(mod['base']+0x61c63b0)+0xb8)+8);assert m.klass_name(tm)=='TowerManager'
 towers=[]
 for key,p in m.dict_ptrs(m.ptr(tm+r.spec('EB.Sparx.TowerManager','TowersData')['offset'])):
  d={n:field(p,'Tower.TowerData',n) for n in ['Id','FriendlyName','Category','NumBlocks','NumFloors','TowerPanelTexture','TowerVisualDataId','EndTime']};assert m.string(key)==d['Id'];towers.append(d)
 fm=m.ptr(m.ptr(m.ptr(mod['base']+0x610d368)+0xb8));assert m.klass_name(fm)=='Manager'
 mounts=[]
 for key,p in m.dict_ptrs(m.ptr(fm+r.spec('EB.FileSystem.Manager','_drivers')['offset'])):
  kind=m.klass_name(p)
  if kind=='FileDriver':mounts.append(dict(driver=m.string(key),kind=kind,paths=field(p,'EB.FileSystem.FileDriver','_paths')))
 d=dict(format='cerebro.public-tower-art-support.v1',capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),gameAssemblySha256=PINS['GameAssembly.dll'],layoutSha256=sha(root/'layouts.json'),readerSha256=sha(Path(__file__)),towers=towers,towerCDN=field(tm,'EB.Sparx.TowerManager','CDN'),archiveImage=field(tm,'EB.Sparx.TowerManager','PanelArchiveImage'),nativeSearchOrder=field(fm,'EB.FileSystem.Manager','_search'),fileMounts=mounts,privacy='Public Tower definitions/art mounts only. No user/rank/access/match/profile objects.',metrics=dict(reads=m.reads,bytes=m.bytes))
 target=root/'public-support.json';assert not target.exists();target.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(d,ensure_ascii=False))
finally:m.close()
