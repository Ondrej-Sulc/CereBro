"""Collect real read-only game odds for exact source IDs, with resumable coverage.

Uses the user's existing local session only. Never opens/buys crystals, signs in,
prints request URLs, or stores credentials, headers or account state. A successful
response is persisted only after validating the narrowly reviewed odds contract.
"""
from __future__ import annotations

import argparse
import base64
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import hmac
import json
from pathlib import Path
import re
import secrets
import struct
import time
import urllib.error
import urllib.parse
import urllib.request


class OddsContractError(ValueError):
    pass


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def fields(value, allowed, required=()):
    if not isinstance(value, dict) or set(value)-set(allowed) or set(required)-set(value):
        raise OddsContractError('Unreviewed or missing odds fields')


def text_field(value, limit=2000):
    if not isinstance(value, str) or len(value)>limit or any(ord(c)<32 and c not in '\n\r\t' for c in value):
        raise OddsContractError('Invalid odds text')


def sanitize_odds_response(body):
    """Validate, without dropping unknown fields or serializing unreviewed data."""
    if len(body)>5_000_000:
        raise OddsContractError('Odds response exceeds reviewed size limit')
    try:
        value=json.loads(body,parse_float=Decimal,parse_constant=lambda _:None)
    except (ValueError,UnicodeDecodeError) as error:
        raise OddsContractError('Non-JSON odds response') from error
    fields(value,{'ts','result'},{'result'})
    if 'ts' in value and (type(value['ts']) is not int or value['ts']<0):
        raise OddsContractError('Invalid server timestamp')
    result=value['result'];fields(result,{'n','kinds'})
    # Real historical definitions can return result:{} with no odds at all.
    # Preserve that observed absence; it supplies neither zero rates nor a cause.
    if not result:return value
    if 'kinds' not in result:raise OddsContractError('Nonempty result has no odds groups')
    if 'n' in result:text_field(result['n'],512)
    if not isinstance(result['kinds'],list) or len(result['kinds'])>1000:
        raise OddsContractError('Invalid odds group collection')
    for group in result['kinds']:
        fields(group,{'n','f','k'},{'k'})
        if 'n' in group:text_field(group['n'])
        if 'f' in group and type(group['f']) is not bool:raise OddsContractError('Invalid featured flag')
        if not isinstance(group['k'],list) or len(group['k'])>10000:raise OddsContractError('Invalid rate rows')
        for row in group['k']:
            fields(row,{'n','v','p','s','t','d','br','dri'},{'v'})
            rate=row['v']
            if isinstance(rate,bool) or not isinstance(rate,(int,Decimal)) or not Decimal(rate).is_finite() or not 0<=rate<=100:
                raise OddsContractError('Invalid disclosed percentage')
            for key in ['n','p','t','d','br']:
                if key in row:text_field(row[key],16 if key=='p' else 2000)
            for key in ['s','dri']:
                if key in row and type(row[key]) is not int:raise OddsContractError('Invalid source row index')
    return value


def normalize_odds(crystal_id,payload,observed_at):
    groups=[]
    mapping={'n':'label','p':'prefix','s':'kindInfoIndex','t':'rewardType','d':'rewardData','br':'bonusRewardId','dri':'displayRarityIndex'}
    for index,group in enumerate(payload['result'].get('kinds',[])):
        rows=[]
        for row_index,source in enumerate(group['k']):
            row={'sourceIndex':row_index,'percentValue':str(source['v']),'rateBasis':'server-disclosed-category'}
            row.update({target:source[key] for key,target in mapping.items() if key in source})
            rows.append(row)
        groups.append(dict(sourceIndex=index,name=group.get('n'),isFeatured=group.get('f'),rows=rows,
                           sumValidation='not-inferred-across-source-groups'))
    return dict(version=1,sourceCrystalId=crystal_id,observedAt=observed_at,serverTimestamp=payload.get('ts'),
                reportedName=payload['result'].get('n'),captureMethod='authenticated-read-only-game-api',
                endpointPath='/gacha/getOdds',groups=groups,individualChampionOddsInferred=False,
                exactUnderlyingSamplingAlgorithmKnown=False)


@dataclass
class HttpResult:
    status: int | None
    body: bytes = field(repr=False)
    observed_at: str
    retry_after: float | None


def atomic_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_suffix(path.suffix+'.tmp')
    temporary.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    # Windows readers/antivirus can briefly hold a file without delete sharing.
    # Keep the old complete manifest intact and retry the atomic replacement.
    for retry in range(20):
        try:
            temporary.replace(path)
            break
        except PermissionError:
            if retry==19:raise
            time.sleep(min(.05*(retry+1),.5))


def classify_response(response):
    if response.status in (401,403):return 'authentication_failed',None
    try:
        payload=json.loads(response.body)
    except (ValueError,UnicodeDecodeError):payload=None
    if isinstance(payload,dict) and payload.get('err') in ('invalid_session','invalid_signature','^ID_SPARX_ERROR_INVALID_SESSION'):
        return 'authentication_failed',None
    if response.status==429:return 'rate_limited',None
    if response.status==404:return 'http_not_found',None
    if response.status is None or response.status>=500:return 'transient_error',None
    if response.status!=200:return 'http_error',None
    if isinstance(payload,dict) and payload.get('err'):return 'server_error',None
    try:
        clean=sanitize_odds_response(response.body)
    except OddsContractError:
        return 'schema_unreviewed',None
    count=sum(len(group['k']) for group in clean['result'].get('kinds',[]))
    return ('captured' if count else 'empty_disclosure'),clean


def collect(ids,source_sha256,endpoint_host,fetch,root,interval=1,sleep=time.sleep,limit=None,progress=None,retry_statuses=()):
    ids=list(ids)
    if len(set(ids))!=len(ids) or not ids:raise ValueError('Expected unique exact source crystal IDs')
    root=Path(root);manifest_path=root/'coverage.json'
    if manifest_path.exists():
        manifest=json.loads(manifest_path.read_text(encoding='utf8'))
        if manifest.get('sourceGachaSha256')!=source_sha256 or manifest.get('endpointHost')!=endpoint_host or set(manifest.get('entries',{}))!=set(ids):
            raise ValueError('Resume manifest does not match this exact source snapshot and host')
        for entry in manifest['entries'].values():
            if entry['status']=='captured':
                path=root/entry['responseFile']
                if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=entry['responseSha256']:
                    raise ValueError('Captured response integrity check failed')
    else:
        manifest=dict(version=1,sourceGachaSha256=source_sha256,endpointHost=endpoint_host,
                      endpointPath='/gacha/getOdds',startedAt=utc_now(),updatedAt=utc_now(),
                      credentialsPersisted=False,entries={name:dict(status='unattempted',attempts=[]) for name in ids})
    attempted=0
    for name in ids:
        entry=manifest['entries'][name]
        if entry['status'] in ('captured','empty_disclosure','http_not_found','server_error','schema_unreviewed','http_error') and entry['status'] not in retry_statuses:continue
        if limit is not None and attempted>=limit:break
        attempted+=1
        for retry in range(3):
            if attempted>1 or retry:sleep(interval)
            response=fetch(name)
            status,clean=classify_response(response)
            attempt=dict(observedAt=response.observed_at,status=status,httpStatus=response.status,
                         responseBytes=len(response.body),responseSha256=hashlib.sha256(response.body).hexdigest())
            entry['attempts'].append(attempt);entry['status']=status
            if clean is not None:
                filename=hashlib.sha256(name.encode()).hexdigest()+'.json'
                response_path=Path('responses')/filename
                (root/'responses').mkdir(parents=True,exist_ok=True)
                (root/response_path).write_bytes(response.body)
                normalized=normalize_odds(name,clean,response.observed_at)
                normalized['sourceGachaSha256']=source_sha256
                normalized['responseSha256']=attempt['responseSha256']
                normalized_path=Path('normalized')/filename
                atomic_json(root/normalized_path,normalized)
                entry.update(responseFile=response_path.as_posix(),normalizedFile=normalized_path.as_posix(),
                             responseSha256=attempt['responseSha256'],groupCount=len(normalized['groups']),
                             rowCount=sum(len(group['rows']) for group in normalized['groups']))
            manifest['updatedAt']=utc_now()
            manifest['counts']=dict(Counter(item['status'] for item in manifest['entries'].values()))
            atomic_json(manifest_path,manifest)
            if progress:progress(name,status,manifest['counts'])
            if status=='authentication_failed':return manifest
            if status not in ('rate_limited','transient_error') or retry==2:break
            sleep(max(response.retry_after or 0,2**retry if interval==0 else 10*2**retry))
    return manifest


def rc4(data,key):
    state=list(range(256));j=0
    for i in range(256):
        j=(j+state[i]+key[i%len(key)])%256;state[i],state[j]=state[j],state[i]
    i=j=0;output=bytearray()
    for byte in data:
        i=(i+1)%256;j=(j+state[i])%256;state[i],state[j]=state[j],state[i]
        output.append(byte^state[(state[i]+state[j])%256])
    return bytes(output)


@dataclass(repr=False)
class LocalSession:
    endpoint: str
    token: str
    signing_key: bytes
    nonce_instance: int=field(default_factory=lambda:secrets.randbits(32))
    nonce_seed: int=field(default_factory=lambda:secrets.randbelow(32767)+1)
    nonce_counter: int=0
    transport: object=field(default=None,repr=False)

    def fetch(self,name):
        nonce=struct.pack('>IIHH',int(time.time()),self.nonce_instance,self.nonce_seed,self.nonce_counter%65536).hex()
        self.nonce_counter+=1
        query={'sver':'3','stoken':self.token,'ts':str(int(time.time())),'name':name,'nonce':nonce}
        def stringify(value):return urllib.parse.urlencode(sorted(value.items()),quote_via=urllib.parse.quote,safe="!'()*-._~")
        path='/gacha/getOdds'
        host=urllib.parse.urlsplit(self.endpoint).hostname
        message=('GET\n'+host+'\n'+path+'\n'+stringify(query)+'\n').encode()
        query['sig']=base64.b64encode(hmac.new(self.signing_key,message,hashlib.sha1).digest()).decode()
        # Keep one verified-TLS connection pool; redirect following is disabled so
        # a signed session URL is never forwarded to another endpoint.
        import requests
        if self.transport is None:self.transport=requests.Session()
        observed=utc_now()
        try:
            response=self.transport.get(self.endpoint+path+'?'+stringify(query),timeout=30,allow_redirects=False)
            retry_after=response.headers.get('Retry-After','')
            return HttpResult(response.status_code,response.content[:5_000_001],observed,float(retry_after) if retry_after.isdigit() else None)
        except requests.RequestException:
            # Exception text can contain the signed URL. Never log or persist it.
            return HttpResult(None,b'',observed,None)


def load_local_session(resources,crypto_metadata):
    """Read normal client resources/preferences; no game execution or memory access."""
    import dnfile
    import UnityPy
    import winreg
    pe=dnfile.dnPE(str(crypto_metadata),clr_lazy_load=True)
    layouts={row.Parent.row_index:row.ClassSize for row in pe.net.mdtables.ClassLayout.rows}
    candidates=[]
    for row in pe.net.mdtables.FieldRva.rows:
        signature=bytes(row.Field.row.Signature.value)
        if len(signature)==3 and signature[:2]==b'\x06\x11' and signature[2]&3==0 and layouts.get(signature[2]>>2)==32:
            candidates.append(row)
    if len(candidates)!=1:raise ValueError('Unreviewed signing-config metadata layout')
    key=pe.get_data(candidates[0].Rva,32)
    env=UnityPy.load(str(resources))
    assets={d.m_Name:d.m_Script for obj in env.objects if obj.type.name=='TextAsset' for d in [obj.read()] if d.m_Name in ('config','endpointconfig')}
    signing_key=rc4(assets['config'].encode('utf8','surrogateescape'),key)
    if len(signing_key)!=64:raise ValueError('Unreviewed signing-config length')
    endpoint=json.loads(assets['endpointconfig'])['Default']['Prod'].rstrip('/')
    url=urllib.parse.urlsplit(endpoint)
    if url.scheme!='https' or url.path or url.query or url.username or not url.hostname.endswith('.sparxcdn.net'):
        raise ValueError('Unexpected production endpoint configuration')
    with winreg.OpenKey(winreg.HKEY_CURRENT_USER,'Software\\Kabam\\Champions') as registry:
        token=winreg.QueryValueEx(registry,'__BugSnagDataCompatibility__SessionId___h3822409571')[0]
    if isinstance(token,bytes):token=token.rstrip(b'\0').decode('utf8')
    if not isinstance(token,str) or not 20<len(token)<1024 or not token.isprintable():
        raise ValueError('No usable existing local game session')
    return LocalSession(endpoint,token,signing_key)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gacha',type=Path,required=True)
    parser.add_argument('--schema',type=Path,required=True)
    parser.add_argument('--resources',type=Path,required=True)
    parser.add_argument('--crypto-metadata',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--interval',type=float,default=1)
    parser.add_argument('--limit',type=int)
    parser.add_argument('--retry-status',action='append',default=[],choices=['schema_unreviewed','server_error','http_error','http_not_found','transient_error','rate_limited','empty_disclosure'])
    args=parser.parse_args()
    if args.interval<0.25:parser.error('Minimum interval is 0.25 seconds')
    from mcoc_protobuf import Decoder
    from extract_mcoc_crystal_rules import validate_contracts
    schema=json.loads(args.schema.read_text(encoding='utf8'));validate_contracts(schema)
    raw=args.gacha.read_bytes();decoder=Decoder(schema)
    data=decoder.message(raw,'EB.Sparx.GachaDataBuffer')
    if decoder.unknown:raise ValueError('Unreviewed source protobuf fields')
    ids=[box['Name'] for group in data['groups'] for box in group.get('Set',{}).get('Boxes',[])]
    session=load_local_session(args.resources,args.crypto_metadata)
    events=0
    def progress(name,status,counts):
        nonlocal events
        events+=1
        if events==1 or events%25==0 or status=='authentication_failed':
            print(json.dumps(dict(completedEvents=events,counts=counts)),flush=True)
    result=collect(ids,hashlib.sha256(raw).hexdigest(),urllib.parse.urlsplit(session.endpoint).hostname,
                   session.fetch,args.out,args.interval,limit=args.limit,progress=progress,retry_statuses=args.retry_status)
    print(json.dumps(dict(sourceIds=len(ids),counts=result['counts'])),flush=True)


if __name__=='__main__':
    main()
