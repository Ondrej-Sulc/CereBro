"""Publish an account-free exact-opening odds sidecar from validated real captures."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

from collect_mcoc_crystal_odds import atomic_json, normalize_odds, sanitize_odds_response


def publish_catalog(root,supplemental=()):
    root=Path(root).resolve()
    manifest=json.loads((root/'coverage.json').read_text(encoding='utf8'))
    source_hash=manifest['sourceGachaSha256']
    roots={identity:root for identity in manifest['entries']}
    for directory in supplemental:
        directory=Path(directory).resolve()
        other=json.loads((directory/'coverage.json').read_text(encoding='utf8'))
        if other['sourceGachaSha256']!=source_hash or other['endpointHost']!=manifest['endpointHost'] or not set(other['entries'])<=set(manifest['entries']):
            raise ValueError('Supplemental capture has a different source snapshot, host or identity set')
        for identity,entry in other['entries'].items():
            previous=manifest['entries'][identity]
            if not entry['attempts']:continue
            if not previous['attempts'] or entry['attempts'][-1]['observedAt']>previous['attempts'][-1]['observedAt']:
                chosen=dict(entry);roots[identity]=directory
            else:chosen=dict(previous)
            attempts={json.dumps(attempt,sort_keys=True):attempt for attempt in previous['attempts']+entry['attempts']}
            chosen['attempts']=sorted(attempts.values(),key=lambda attempt:attempt['observedAt'])
            manifest['entries'][identity]=chosen
        manifest['updatedAt']=max(manifest['updatedAt'],other['updatedAt'])
    openings={}
    statuses={'unattempted','captured','empty_disclosure','http_not_found','server_error','schema_unreviewed',
              'http_error','authentication_failed','transient_error','rate_limited'}
    for identity,entry in manifest['entries'].items():
        if entry['status'] not in statuses:raise ValueError('Unreviewed collection status')
        attempts=[]
        for attempt in entry['attempts']:
            # Explicit projection: no request URL, headers, response error values,
            # credential fields or other unreviewed manifest fields are copied.
            attempts.append({key:attempt[key] for key in ['observedAt','status','httpStatus','responseBytes','responseSha256']})
        opening=dict(status=entry['status'],attempts=attempts)
        if entry['status'] in ('captured','empty_disclosure'):
            capture_root=roots[identity]
            path=(capture_root/entry['responseFile']).resolve()
            if not path.is_relative_to(capture_root):raise ValueError('Response path escapes capture directory')
            body=path.read_bytes()
            if hashlib.sha256(body).hexdigest()!=entry['responseSha256']:raise ValueError('Captured response hash mismatch')
            clean=sanitize_odds_response(body)
            successful=next(attempt for attempt in reversed(attempts) if attempt['status']==entry['status'])
            normalized=normalize_odds(identity,clean,successful['observedAt'])
            opening.update({key:normalized[key] for key in ['observedAt','serverTimestamp','reportedName','groups',
                                                          'individualChampionOddsInferred','exactUnderlyingSamplingAlgorithmKnown']})
            opening['responseSha256']=entry['responseSha256']
        openings[identity]=opening
    return dict(version=1,source=dict(gachaSha256=source_hash,endpointHost=manifest['endpointHost'],
                                     endpointPath='/gacha/getOdds',updatedAt=manifest['updatedAt'],
                                     sourceCrystalCount=len(openings),attemptedSourceCount=sum(bool(o['attempts']) for o in openings.values()),
                                     captureMethod='authenticated-read-only-game-api'),
                counts=dict(Counter(o['status'] for o in openings.values())),openings=openings)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--captures',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--supplemental-captures',type=Path,action='append',default=[])
    args=parser.parse_args()
    result=publish_catalog(args.captures,args.supplemental_captures)
    atomic_json(args.out,result)
    print(json.dumps(dict(sourceIds=len(result['openings']),counts=result['counts'])))
