"""Bounded named Tower block/floor definition joins, excluding all user data."""
import json,sys,datetime
from pathlib import Path
from capture_source_art import validate_support,PINS,sha
root=Path('temp/quest-explorer-review/permanent-20261109');support=Path('C:/Code/CereBro/temp/quest-data-investigation/game-only');validate_support(support)
sys.dont_write_bytecode=True;sys.path.insert(0,str(support))
from read_memory import Memory,find_game
from capture_quests import QuestReader
layout=json.loads((root/'layouts.json').read_text())
for s in layout['sources']:assert sha(Path(s['path']))==s['sha256']
pid,mod=find_game();assert sha(Path(mod['path']))==PINS['GameAssembly.dll']
class Limited(Memory):
 def read(self,a,s):
  if self.reads>100000 or self.bytes+s>4*1024*1024:raise ValueError('Tower definition budget exceeded')
  return super().read(a,s)
m=Limited(pid)
try:
 r=QuestReader(m);r.types=layout['types'];tm=m.ptr(m.ptr(m.ptr(mod['base']+0x61c63b0)+0xb8)+8);assert m.klass_name(tm)=='TowerManager'
 def rows(field,kind,fields,triplet=False):
  ptr=m.ptr(tm+r.spec('EB.Sparx.TowerManager',field)['offset']);arr=m.ptr(ptr+24);n=m.i32(ptr+32);free=m.i32(ptr+40);ver=m.i32(ptr+44)
  assert 0<=n<=10000 and 0<=free<=n
  result=[]
  for i in range(n):
   entry=arr+32+i*32
   if m.i32(entry)<0:continue
   keyTower=m.string(m.ptr(entry+8));keyBlock=m.i32(entry+16);obj=m.ptr(entry+24);assert m.klass_name(obj)==kind.split('.')[-1]
   d={f:r.field(obj,kind,f) for f in fields};assert d['TowerId']==keyTower and (d.get('Id',d.get('BlockId'))==keyBlock)
   if triplet:d['FloorIndex']=m.i32(entry+20)
   result.append(d)
  assert len(result)==n-free and m.i32(ptr+44)==ver
  return result
 blocks=rows('BlocksData','Tower.TowerBlockData',['Id','TowerId','NumFloors','Hash'])
 floors=rows('FloorsData','Tower.TowerFloorData',['TowerId','BlockId','Hash','TotalLocalBuffCount'],True)
 d=dict(format='cerebro.public-tower-membership.v1',capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),gameAssemblySha256=PINS['GameAssembly.dll'],layoutSha256=sha(root/'layouts.json'),readerSha256=sha(Path(__file__)),blocks=blocks,floors=floors,privacy='Only definition identity/count/hash fields. No user-floor, rankings, roster, active-match or access objects.',metrics=dict(reads=m.reads,bytes=m.bytes))
 out=root/'tower-membership.json';assert not out.exists();out.write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8');print(json.dumps(dict(blocks=len(blocks),floors=len(floors),blockTowerIds=sorted(set(x['TowerId'] for x in blocks)),floorTowerIds=sorted(set(x['TowerId'] for x in floors)))))
finally:m.close()
