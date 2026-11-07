"""Verify raw API-v percentage units against the same crystal's genuine game UI."""
import argparse
from decimal import Decimal
import json
from pathlib import Path

from collect_mcoc_crystal_odds import atomic_json, utc_now
from publish_mcoc_crystal_odds import publish_catalog


def calibrate(ui,api):
    source_hash=ui['source']['gachaSha256']
    if api['source']['gachaSha256']!=source_hash:raise ValueError('Calibration source snapshots differ')
    comparisons=[]
    for disclosure in ui['disclosures']:
        identity=disclosure['sourceCrystalId'];opening=api['openings'].get(identity)
        if not disclosure['captureComplete'] or opening is None or opening['status']!='captured' or len(opening['groups'])!=1:
            raise ValueError('Calibration needs one complete, exact-source UI/API group')
        rows=opening['groups'][0]['rows']
        indexed={row.get('label'):row for row in rows}
        if len(indexed)!=len(rows) or set(indexed)!={row['label'] for row in disclosure['rows']}:
            raise ValueError('Calibration labels or row coverage differ')
        for row in disclosure['rows']:
            actual=indexed[row['label']]
            if row['comparison']!='displayed' or actual.get('prefix',''):
                raise ValueError('Bounded disclosure cannot prove an exact display scale')
            difference=abs(Decimal(actual['percentValue'])-Decimal(row['percentValue']))
            rounding=Decimal(5).scaleb(-row['decimalPlaces']-1)
            if difference>rounding:raise ValueError('Unscaled API percentage disagrees with genuine UI')
            comparisons.append(dict(sourceCrystalId=identity,label=row['label'],uiDisplayedPercent=row['displayedPercent'],
                                    apiPercentValue=actual['percentValue'],uiObservedAt=disclosure['observedAt'],
                                    apiObservedAt=opening['observedAt'],responseSha256=opening['responseSha256'],
                                    uiEvidence=[dict(file=e['file'],sha256=e['sha256']) for e in disclosure['evidence']],
                                    withinDisplayRounding=True))
    if not comparisons:raise ValueError('No real calibration rows supplied')
    return dict(version=1,sourceGachaSha256=source_hash,validatedAt=utc_now(),apiValueScale='percentage-points',
                comparisonMethod='unscaled-raw-api-v-against-reviewed-ui',allPassed=True,comparisons=comparisons)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ui',type=Path,required=True)
    parser.add_argument('--captures',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    receipt=calibrate(json.loads(args.ui.read_text(encoding='utf8')),publish_catalog(args.captures))
    atomic_json(args.out,receipt)
    print(json.dumps(dict(allPassed=receipt['allPassed'],comparedRows=len(receipt['comparisons']),apiValueScale=receipt['apiValueScale'])))
