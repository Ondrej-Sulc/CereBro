"""Export additional exact native character portraits from installed static files.

No name matching, downloads, game/server access or sibling runtime dependency.
Existing v1 portrait/artwork bytes stay immutable.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
from PIL import Image
from extract_mcoc_node_modifiers import digest_json, pinned
from extract_mcoc_node_artwork import public_bindings
from mcoc_protobuf import Decoder, fields


def export(root, bcg, schema, champions, resources, output, assets):
    inputs = [bcg, schema, champions] + [root/'src/data/game-node-modifiers'/name for name in ('catalog.json','icon-bindings.json','artwork.json','v2/index.json','v2/portrait-ids.json')]
    if output.resolve() in {path.resolve() for path in inputs}:
        raise ValueError('Output must not overwrite an input')
    if any(path.resolve().is_relative_to(resources.resolve()) for path in (output, assets)):
        raise ValueError('Outputs must not write into installed resources')
    old = json.loads((root/'src/data/game-node-modifiers/artwork.json').read_text(encoding='utf-8'))
    index = json.loads((root/'src/data/game-node-modifiers/v2/index.json').read_text(encoding='utf-8'))
    ids = json.loads((root/'src/data/game-node-modifiers/v2/portrait-ids.json').read_text(encoding='utf-8'))
    profile = old['profile']
    # Re-check the named native portrait getter evidence independently of filenames.
    evidence = [row for row in profile['evidence'] if row['path'].endswith('/BCGCharacterData.txt') or row['path'].endswith('/BCGBlueprintBase.txt')]
    if len(evidence)!=2: raise ValueError('Missing reviewed native portrait renderer evidence')
    for row in evidence: pinned(Path(row['path']),row['sha256'])
    decoder=Decoder(json.loads(pinned(schema,index['profile']['schemaSha256'])))
    characters={}
    for tag,wire,value,_ in fields(pinned(bcg,index['profile']['bcgSha256'])):
        if tag==4:
            row=decoder.message(value,'BCGCharacterData');characters[row['Character']]=row
    if decoder.unknown: raise ValueError('Unknown native character fields')
    public=public_bindings(json.loads(pinned(champions,profile['championsSha256'])))
    previous={row['gameId']:row for row in old['portraits']}
    rows={};assets.mkdir(parents=True,exist_ok=True)
    for game_id in ids:
        if game_id in previous:
            rows[game_id]=previous[game_id];continue
        native=characters.get(game_id)
        row=dict(gameId=game_id,status='unresolved-character',public=public.get(game_id))
        if native:
            row.update(characterHash=digest_json(native),imageId=native.get('_imgID'),remote=bool(native.get('_s3ImgID')))
            if native.get('_s3ImgID'):row['status']='remote-portrait-not-read'
            elif native.get('_imgID'):
                ref='portraits/portrait_'+native['_imgID'];matches=sorted(resources.glob('ui_portraits*/'+ref+'.png'))
                hashes={hashlib.sha256(p.read_bytes()).hexdigest() for p in matches}
                if len(hashes)>1:raise ValueError('Conflicting exact portrait resource')
                row.update(textureRef=ref,status='missing-local-portrait')
                if matches:
                    image=Image.open(matches[0]).convert('RGBA');buffer=io.BytesIO();image.save(buffer,'WEBP',lossless=True,exact=True,method=6)
                    body=buffer.getvalue();sha=hashlib.sha256(body).hexdigest();(assets/(sha+'.webp')).write_bytes(body)
                    row.update(status='verified',src='/node-modifiers/v2/portraits/'+sha+'.webp',sha256=sha,sourceSha256=next(iter(hashes)),
                        sourcePath=matches[0].relative_to(resources).as_posix(),width=image.width,height=image.height)
        rows[game_id]=row
    result=dict(contract='cerebro.node-modifier-portraits/v2',catalogHash=index['catalogHash'],bcgSha256=index['profile']['bcgSha256'],
        championsSha256=profile['championsSha256'],rendererEvidence=evidence,bindings=rows)
    result['contentHash']=digest_json(result);output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps(dict(bindings=len(rows),statuses={s:sum(r['status']==s for r in rows.values()) for s in sorted({r['status'] for r in rows.values()})},publicLinks=sum(bool(r.get('public')) for r in rows.values()))))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['root','bcg','schema','champions','resources','output','assets']:parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args();export(args.root,args.bcg,args.schema,args.champions,args.resources,args.output,args.assets)
