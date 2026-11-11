"""Prepared opt-in public parent reward reader. Requires a NEW root game lease and user-ready selection.
Never launched by exporters/tests. No maps, account fields, gameplay or process writes.
"""
import argparse,datetime,hashlib,json,sys
from pathlib import Path
from capture_source_art import validate_support,PINS,REPO,sha,clean
from build_progressed import NEW_SETS
SCOPES={'firstCompletionRewards','masteryCompletionRewards','potentialCompletionRewards'}
ALLOW={'QuestSet':{'setId','setName','Acts'},'Act':{'actId','groupIndex','displayIndex','Chapters'}|SCOPES,'Chapter':{'chapterId','Quests'}|SCOPES,'QuestSummary':{'qid','setId','mapId'},'EB.Sparx.RedeemerItem':{'Type','Data','Quantity','MinQuantity','MaxQuantity','Action','Header','Footer'}}
OWNER='quest-public-parent-rewards'

def scope_hash():
 payload={'sets':sorted(NEW_SETS),'fields':{kind:sorted(names) for kind,names in sorted(ALLOW.items())},'maxReads':100000,'maxBytes':16*1024*1024}
 return hashlib.sha256(json.dumps(payload,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def validate_lease(path,pid=None,now=None):
 if not path or not path.resolve().is_relative_to((REPO/'temp').resolve()):raise ValueError('A root lease inside ignored quest temp is required')
 lease=json.loads(path.read_text(encoding='utf-8'))
 if lease.get('format')!='cerebro.quest-public-rewards-lease.v1' or lease.get('owner')!=OWNER or lease.get('grantedByRoot') is not True:raise ValueError('Public reward lease is not granted')
 if lease.get('userReadyConfirmed') is not True or not isinstance(lease.get('readinessEvidence'),str) or not lease['readinessEvidence'].strip():raise ValueError('Actual user-ready confirmation is required')
 leased_pid=lease.get('processId')
 if type(leased_pid) is not int or leased_pid<=0 or (pid is not None and leased_pid!=pid):raise ValueError('Public reward lease process mismatch')
 if lease.get('readerSha256')!=sha(Path(__file__)) or lease.get('scopeSha256')!=scope_hash() or lease.get('supportPins')!=PINS:raise ValueError('Public reward lease reader/scope/pins mismatch')
 if lease.get('allowedSetIds')!=sorted(NEW_SETS):raise ValueError('Public reward lease set allowlist mismatch')
 try:
  start=datetime.datetime.fromisoformat(lease['grantedAt']);end=datetime.datetime.fromisoformat(lease['expiresAt'])
  if start.utcoffset() is None or end.utcoffset() is None:raise ValueError('Lease timestamps require timezones')
  current=now or datetime.datetime.now(datetime.timezone.utc)
  if not start<=current<end or not datetime.timedelta(0)<end-start<=datetime.timedelta(minutes=30):raise ValueError('Public reward lease is expired or outside its time window')
 except (KeyError,TypeError) as error:raise ValueError('Invalid public reward lease time window') from error
 return lease
def bindings(layout):
 out={}
 for kind,names in ALLOW.items():
  out[kind]={}
  for name in sorted(names):
   matches=[f for f in layout['types'][kind]['fields'] if clean(f['name'])==name and not f['static']]
   if len(matches)!=1 or matches[0]['offset'] is None:raise ValueError('Unbound public reward field '+kind+'.'+name)
   out[kind][name]={k:matches[0][k] for k in ['name','type','offset']}
 return out
def capture(support,out,lease_path):
 if out.exists() or not out.resolve().is_relative_to((REPO/'temp').resolve()):raise ValueError('Use a new ignored capture path')
 validate_lease(lease_path)
 layout=validate_support(support);specs=bindings(layout)
 sys.dont_write_bytecode=True;sys.path.insert(0,str(support));import capture_quests as original
 from read_memory import Memory,find_game
 original.RULES.update(ALLOW)
 class Bounded(Memory):
  def read(self,address,size):
   if self.reads>=100000 or self.bytes+size>16*1024*1024:raise ValueError('Public reward budget exceeded')
   if self.reads%256==0:validate_lease(lease_path,pid)
   return super().read(address,size)
 pid,module=find_game()
 validate_lease(lease_path,pid)
 if sha(Path(module['path']))!=PINS['GameAssembly.dll']:raise ValueError('Binary drift; no handle opened')
 memory=Bounded(pid)
 try:
  instance=memory.ptr(memory.ptr(memory.ptr(module['base']+0x60ba5b8)+0xb8)+8)
  if memory.klass_name(instance)!='QuestsManager':raise ValueError('Bootstrap mismatch')
  db=memory.ptr(instance+0x88)
  if memory.klass_name(db)!='QuestDB':raise ValueError('QuestDB mismatch')
  reader=original.QuestReader(memory);sets=[]
  for ptr in memory.list_ptrs(memory.ptr(db+0x10),limit=100):
   if reader.field(ptr,'QuestSet','setId') in NEW_SETS:sets.append(reader.obj(ptr,'QuestSet'))
  if reader.issues:raise ValueError(str(reader.issues))
  document=dict(format='cerebro.public-parent-rewards.v1',capturedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),gameAssemblySha256=PINS['GameAssembly.dll'],layoutSha256=PINS['layouts.json'],readerSha256=sha(Path(__file__)),fieldBindings=specs,allowedContainingSets=sorted(NEW_SETS),pveSets=sets,issues=[],readMetrics=dict(calls=memory.reads,bytes=memory.bytes))
 finally:memory.close()
 out.parent.mkdir(parents=True,exist_ok=True)
 with out.open('x',encoding='utf-8') as stream:stream.write(json.dumps(document,ensure_ascii=False,indent=2)+'\n')
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--support-root',type=Path,required=True);p.add_argument('--out',type=Path);p.add_argument('--lease',type=Path);p.add_argument('--preflight',action='store_true');a=p.parse_args()
 if a.preflight:
  specs=bindings(validate_support(a.support_root));print(json.dumps({'preflight':'passed','types':len(specs),'fieldCount':sum(map(len,specs.values())),'setCount':len(NEW_SETS),'scopeSha256':scope_hash(),'readerSha256':sha(Path(__file__)),'gameAccess':False}))
 else:
  if not a.out or not a.lease:p.error('--out and --lease are required for capture')
  capture(a.support_root,a.out,a.lease)
