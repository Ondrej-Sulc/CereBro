"""Windows read-only process access. No injection, remote calls, writes or scans."""
import ctypes as C,struct
from ctypes import wintypes as W
K=C.WinDLL('kernel32',use_last_error=True)
K.CreateToolhelp32Snapshot.argtypes=[W.DWORD,W.DWORD];K.CreateToolhelp32Snapshot.restype=W.HANDLE
K.CloseHandle.argtypes=[W.HANDLE];K.CloseHandle.restype=W.BOOL
K.OpenProcess.argtypes=[W.DWORD,W.BOOL,W.DWORD];K.OpenProcess.restype=W.HANDLE
K.ReadProcessMemory.argtypes=[W.HANDLE,C.c_void_p,C.c_void_p,C.c_size_t,C.POINTER(C.c_size_t)];K.ReadProcessMemory.restype=W.BOOL
class PROCESS(C.Structure):
 _fields_=[('dwSize',W.DWORD),('cntUsage',W.DWORD),('th32ProcessID',W.DWORD),('th32DefaultHeapID',C.c_size_t),('th32ModuleID',W.DWORD),('cntThreads',W.DWORD),('th32ParentProcessID',W.DWORD),('pcPriClassBase',W.LONG),('dwFlags',W.DWORD),('szExeFile',W.WCHAR*260)]
class MODULE(C.Structure):
 _fields_=[('dwSize',W.DWORD),('th32ModuleID',W.DWORD),('th32ProcessID',W.DWORD),('GlblcntUsage',W.DWORD),('ProccntUsage',W.DWORD),('modBaseAddr',C.c_void_p),('modBaseSize',W.DWORD),('hModule',W.HMODULE),('szModule',W.WCHAR*256),('szExePath',W.WCHAR*260)]
for n,typ in [('Process32FirstW',PROCESS),('Process32NextW',PROCESS),('Module32FirstW',MODULE),('Module32NextW',MODULE)]:getattr(K,n).argtypes=[W.HANDLE,C.POINTER(typ)];getattr(K,n).restype=W.BOOL

def find_game():
 h=K.CreateToolhelp32Snapshot(2,0);r=PROCESS();r.dwSize=C.sizeof(r);pids=[]
 try:
  ok=K.Process32FirstW(h,C.byref(r))
  while ok:
   if r.szExeFile.lower()=='champions.exe':pids.append(r.th32ProcessID)
   ok=K.Process32NextW(h,C.byref(r))
 finally:K.CloseHandle(h)
 if len(pids)!=1:raise RuntimeError(f'Expected one Champions.exe process, found {len(pids)}')
 pid=pids[0];h=K.CreateToolhelp32Snapshot(0x18,pid);r=MODULE();r.dwSize=C.sizeof(r);mods=[]
 try:
  ok=K.Module32FirstW(h,C.byref(r))
  while ok:
   if r.szModule.lower()=='gameassembly.dll':mods.append(dict(base=r.modBaseAddr,size=r.modBaseSize,path=r.szExePath))
   ok=K.Module32NextW(h,C.byref(r))
 finally:K.CloseHandle(h)
 if len(mods)!=1:raise RuntimeError('GameAssembly.dll is not loaded')
 return pid,mods[0]
class Memory:
 def __init__(self,pid):
  # PROCESS_QUERY_INFORMATION | PROCESS_VM_READ; no write/operation/create-thread rights.
  self.h=K.OpenProcess(0x410,False,pid);self.reads=0;self.bytes=0
  if not self.h:raise C.WinError(C.get_last_error())
 def close(self):
  if self.h:K.CloseHandle(self.h);self.h=None
 def read(self,addr,size):
  if not isinstance(addr,int) or addr<0x10000 or addr>0x7fffffffffff:raise ValueError('Invalid user-space pointer')
  if not 0<size<=1024*1024:raise ValueError('Read size outside bounded limit')
  b=C.create_string_buffer(size);n=C.c_size_t()
  if not K.ReadProcessMemory(self.h,C.c_void_p(addr),b,size,C.byref(n)) or n.value!=size:raise C.WinError(C.get_last_error())
  self.reads+=1;self.bytes+=size;return b.raw
 def unpack(self,addr,fmt):return struct.unpack(fmt,self.read(addr,struct.calcsize(fmt)))[0]
 def ptr(self,a):return self.unpack(a,'<Q')
 def i32(self,a):return self.unpack(a,'<i')
 def string(self,p):
  if p==0:return None
  n=self.i32(p+16)
  if not 0<=n<=32768:raise ValueError('Invalid managed string length')
  return self.read(p+20,n*2).decode('utf-16-le') if n else ''
 def klass_name(self,p):
  k=self.ptr(p);name=self.ptr(k+16);b=self.read(name,160);return b.split(b'\0',1)[0].decode('utf-8')
 def list_ptrs(self,p,limit=10000):
  if not p:return []
  array=self.ptr(p+16);n=self.i32(p+24)
  if not 0<=n<=limit:raise ValueError('Invalid managed list count')
  if not n:return []
  cap=self.ptr(array+24)
  if cap<n or cap>100000:raise ValueError('Invalid managed list capacity')
  before=self.i32(p+28);vals=list(struct.unpack('<'+'Q'*n,self.read(array+32,n*8)))
  if self.i32(p+24)!=n or self.i32(p+28)!=before:raise RuntimeError('Managed list changed during read; retry when UI settles')
  return vals
 def dict_ptrs(self,p,limit=10000):
  if not p:return []
  entries=self.ptr(p+24);n=self.i32(p+32);free=self.i32(p+40);version=self.i32(p+44)
  if not 0<=n<=limit or not 0<=free<=n:raise ValueError('Invalid managed dictionary count')
  if not n:return []
  cap=self.ptr(entries+24)
  if cap<n or cap>100000:raise ValueError('Invalid dictionary entry capacity')
  data=self.read(entries+32,n*24);rows=[]
  for i in range(n):
   h,nxt,k,v=struct.unpack_from('<iiQQ',data,i*24)
   if h>=0:rows.append((k,v))
  if self.i32(p+32)!=n or self.i32(p+44)!=version:raise RuntimeError('Dictionary changed during read; retry when UI settles')
  if len(rows)!=n-free:raise RuntimeError('Dictionary entry count mismatch')
  return rows
