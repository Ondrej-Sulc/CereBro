"""Offline/native asset supplement. Optional fetches use only exact captured public artwork URLs."""
import argparse,json,shutil
from pathlib import Path
from build_source_art import build as menu_build
from build_progressed import REPO,read,sha,write,validate_sources

def build(args):
    validate_sources(args.source)
    catalog=read(REPO/'src/data/game-quests/catalog.json')+read(args.data/'progressed-catalog.json')
    combined=args.source/'combined-art-catalog.json';write(combined,catalog)
    args.fetched.mkdir(parents=True,exist_ok=True)
    for path in args.previous_fetched.iterdir():
        target=args.fetched/path.name
        if path.is_file() and not target.exists():shutil.copyfile(path,target)
    menu_build(args.source/'source-art.json',combined,args.cache,args.fetched,args.fetch_missing,args.data/'progressed-menu-art.json',args.assets,args.resources)
    menu=read(args.data/'progressed-menu-art.json')
    menu.update(id='public-progressed-quest-menu-art-20261109-v1',supplementExporterSha256=sha(Path(__file__)),previousManifestSha256=sha(REPO/'src/data/game-quests/menu-art.json'))
    write(args.data/'progressed-menu-art.json',menu)
    original=read(REPO/'src/data/game-quests/artwork.json');capture=read(args.source/'initial-catalog.json')
    summaries={q['qid']:(q,si) for si,s in enumerate(capture['pveSets']) for q in s['QuestSummarys'].values()}
    source_hash=sha(args.source/'initial-catalog.json');public=set(read(args.data/'progressed.json')['publicQuestIds']);bindings={}
    for q in catalog:
        if q['id'] not in public:continue
        native,si=summaries[q['id']]
        if native['mapId']!=q['mapId'] or native['setId']!=q['summarySetId']:raise ValueError('Terrain quest identity drift')
        theme=native['theme']
        if theme not in original['themes']:raise ValueError('Unverified native terrain theme: '+theme)
        texture=original['textures'][original['themes'][theme]['image']]
        if sha(REPO/'web/public'/texture['url'].lstrip('/'))!=texture['sha256']:raise ValueError('Terrain texture drift')
        bindings[q['id']]=dict(theme=theme,sourceHash=q['sourceHash'],mapId=q['mapId'],containerSetId=q['containerSetId'],definitionSourceHash=source_hash,sourcePointer=f"/pveSets/{si}/QuestSummarys/{q['id']}/theme")
    write(args.data/'progressed-terrain.json',dict(version=1,policy='Exact refreshed QuestSummary.theme reference to the unchanged verified native terrain chain. Menu artwork is separate.',exporterSha256=sha(Path(__file__)),originalTerrainManifestSha256=sha(REPO/'src/data/game-quests/artwork.json'),quests=bindings))

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,required=True);p.add_argument('--data',type=Path,default=REPO/'src/data/game-quests')
    p.add_argument('--assets',type=Path,default=REPO/'web/public/game-quests/menu-art')
    p.add_argument('--cache',type=Path,default=Path('C:/Users/ossul/AppData/LocalLow/Kabam/Champions/asset_cache/files'))
    p.add_argument('--resources',type=Path,default=Path('C:/Games/Marvel Contest of Champions/default/game/Champions_Data/Resources/Data'))
    p.add_argument('--fetched',type=Path,required=True);p.add_argument('--previous-fetched',type=Path,default=REPO/'temp/quest-explorer-review/authored-art/fetched')
    p.add_argument('--fetch-missing',action='store_true');build(p.parse_args())
