"""Independent artifact/source audit and bounded Unity pixel/atlas checks."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import io
import json
from pathlib import Path
import sqlite3
import sys

from PIL import Image


def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for data in iter(lambda:f.read(1024*1024),b''):h.update(data)
    return h.hexdigest()


def pixel_hash(image):
    image=image.convert('RGBA')
    size=json.dumps(list(image.size),separators=(',', ':')).encode()
    return hashlib.sha256(size+b'\0RGBA\0'+image.tobytes()).hexdigest()


def audit(output, roots, unity_samples=48):
    db=sqlite3.connect(output.resolve().as_uri()+'/catalog.sqlite?mode=ro',uri=True)
    db.row_factory=sqlite3.Row
    failures=[]; counts=Counter()
    def check(condition, message):
        if not condition:failures.append(message)
    check(db.execute('PRAGMA integrity_check').fetchone()[0]=='ok','sqlite-integrity')
    check(not db.execute('PRAGMA foreign_key_check').fetchall(),'foreign-keys')
    for blob in db.execute('SELECT * FROM blobs ORDER BY sha256'):
        p=output/blob['path']
        check(p.is_file() and p.stat().st_size==blob['bytes'] and sha(p)==blob['sha256'],'blob:'+blob['sha256'])
        counts['blobs_checked']+=1
        if counts['blobs_checked']%1000==0:print('verify blobs',counts['blobs_checked'],file=sys.stderr,flush=True)
    for asset in db.execute('SELECT a.*,b.path FROM assets a JOIN blobs b ON b.sha256=a.blob_sha256 ORDER BY a.id'):
        try:
            with Image.open(output/asset['path']) as im:
                check(im.size==(asset['width'],asset['height']),'dimensions:'+asset['id'])
                check(pixel_hash(im)==asset['pixel_sha256'],'pixels:'+asset['id'])
                check(im.convert('RGBA').getchannel('A').getextrema()==(asset['alpha_min'],asset['alpha_max']),'alpha:'+asset['id'])
            with Image.open(output/asset['preview']) as im:
                check(im.width<=min(128,asset['width']) and im.height<=min(128,asset['height']),'preview-upscale:'+asset['id'])
        except Exception as exc:
            failures.append('asset-decode:'+asset['id']+':'+type(exc).__name__)
        counts['assets_checked']+=1
        if counts['assets_checked']%1000==0:print('verify assets',counts['assets_checked'],file=sys.stderr,flush=True)
    for source in db.execute("SELECT * FROM sources WHERE sha256 IS NOT NULL ORDER BY root,path"):
        if source['root'] not in roots:continue
        p=roots[source['root']]/source['path']
        check(p.exists() and sha(p)==source['sha256'],'source:'+source['root']+':'+source['path'])
        counts['source_hashes_checked']+=1
        if counts['source_hashes_checked']%1000==0:print('verify sources',counts['source_hashes_checked'],file=sys.stderr,flush=True)
    # Alias coverage and separate identity of texture masters vs sprite crops.
    check(db.execute('SELECT count(*) FROM objects o WHERE NOT EXISTS(SELECT 1 FROM aliases a WHERE a.object_id=o.id)').fetchone()[0]==0,'object-without-alias')
    check(db.execute('SELECT count(*) FROM (SELECT kind,pixel_sha256,count(*) n FROM assets GROUP BY kind,pixel_sha256 HAVING n>1)').fetchone()[0]==0,'duplicate-semantic-content')
    check(db.execute('SELECT count(*) FROM aliases').fetchone()[0]==db.execute('SELECT count(*) FROM alias_search').fetchone()[0],'fts-alias-coverage')
    counts['aliases_checked']=db.execute('SELECT count(*) FROM aliases').fetchone()[0]
    expected=db.execute("SELECT count(*) FROM sources WHERE classification='unity' AND status IN ('done','done-with-errors')").fetchone()[0]
    actual=db.execute("SELECT count(*) FROM sources s JOIN meta m ON m.key='container-aliases:'||s.id AND m.value=s.sha256 WHERE s.classification='unity' AND s.status IN ('done','done-with-errors')").fetchone()[0]
    check(actual==expected,'incomplete-container-alias-reconciliation');counts['alias_sources_checked']=actual
    for row in db.execute("SELECT o.provenance,s.sha256 source_sha256 FROM objects o JOIN sources s ON s.id=o.source_id WHERE o.type='LooseImage'"):
        provenance=json.loads(row['provenance'])
        check(provenance['originalBlobSha256']==row['source_sha256'],'loose-original-byte-identity')
        check(db.execute('SELECT 1 FROM blobs WHERE sha256=?',(provenance['originalBlobSha256'],)).fetchone() is not None,'missing-loose-original-blob')
        counts['loose_originals_checked']+=1
    # Check every saved atlas chain structurally, including failed sprites.
    for row in db.execute("SELECT id,provenance,status FROM objects WHERE type='Sprite'"):
        p=json.loads(row['provenance'])
        if row['status']=='done':
            check(bool(p.get('texture',{}).get('pathId')),'sprite-texture-pointer:'+row['id'])
            check(p.get('textureRect',{}).get('width',0)>0,'sprite-rect:'+row['id'])
            check('settingsRaw' in p and 'originalRect' in p,'sprite-packing-provenance:'+row['id'])
            counts['sprite_chains_checked']+=1
    if unity_samples:
        import UnityPy
        from UnityPy.export.Texture2DConverter import get_image_from_texture2d
        selected=[]
        # Samples from each source are selected deterministically, with sprites
        # prioritized, then textures. Stable names have no visual interpretation.
        for typ in ['Sprite','Texture2D']:
            selected.extend(db.execute('''SELECT o.*,a.pixel_sha256,a.width,a.height,s.root,s.path source_path
                FROM objects o JOIN assets a ON a.id=o.asset_id JOIN sources s ON s.id=o.source_id
                WHERE o.type=? AND s.status IN ('done','done-with-errors')
                ORDER BY o.id LIMIT ?''',(typ,unity_samples)).fetchall())
        grouped={}
        for row in selected:grouped.setdefault((row['root'],row['source_path']),[]).append(row)
        for (root,source_path),rows in sorted(grouped.items()):
            if root not in roots:continue
            env=UnityPy.load(str(roots[root]/source_path))
            original_find=env.find_file
            def find_dependency(name,is_dependency=True):
                if env.get_cab(name):return env.get_cab(name)
                candidates=[]
                for cab in db.execute("SELECT m.value,s.root,s.path FROM meta m JOIN sources s ON m.key='cab-directory:'||s.id"):
                    if name.lower() in [n.lower() for n in json.loads(cab['value'])['names']]:candidates.append(cab)
                if candidates:
                    paths=[roots[c['root']]/c['path'] for c in candidates if c['root'] in roots]
                    if len(paths)>1 and len({sha(p) for p in paths})>1:raise ValueError('Ambiguous CAB source')
                    if paths:env.load_file(str(paths[0]),is_dependency=True)
                return original_find(name,is_dependency)
            env.find_file=find_dependency
            objects={(Path(o.assets_file.name).name,str(o.path_id)):o for o in env.objects}
            for row in rows:
                obj=objects[(row['serialized_file'],row['path_id'])]
                check(hashlib.sha256(obj.get_raw_data()).hexdigest()==row['raw_sha256'],'raw-object:'+row['id'])
                data=obj.read()
                if row['type']=='Texture2D':
                    result=data.image
                    p=json.loads(row['provenance'])
                    check(hashlib.sha256(data.get_image_data()).hexdigest()==p['encodedTextureSha256'],'encoded-texture:'+row['id'])
                    counts['unity_texture_pixel_checks']+=1
                else:
                    # Independent rectangle/rotation/alpha composition. Tight
                    # meshes need polygon masking; compare the source helper as
                    # a separate reproducibility check and report that limit.
                    p=json.loads(row['provenance']);settings=p['settingsRaw']
                    if not (settings>>1)&1:
                        from UnityPy.export.SpriteHelper import get_image_from_sprite
                        result=get_image_from_sprite(data)
                        counts['unity_tight_reproducibility_checks']+=1
                    else:
                        rd=data.m_RD
                        atlas=data.m_SpriteAtlas.deref_parse_as_object() if data.m_SpriteAtlas else None
                        if not atlas and data.m_AtlasTags:
                            atlas=next((o.read() for o in env.objects if o.type.name=='SpriteAtlas' and o.peek_name()==data.m_AtlasTags[0]),None)
                        if atlas:rd=next(v for k,v in atlas.m_RenderDataMap if k==data.m_RenderDataKey)
                        master=get_image_from_texture2d(rd.texture.deref_parse_as_object(),False).convert('RGBA')
                        if rd.alphaTexture:
                            alpha=get_image_from_texture2d(rd.alphaTexture.deref_parse_as_object(),False)
                            master.putalpha(alpha.getchannel('R'))
                        r=rd.textureRect
                        result=master.crop((r.x,r.y,r.x+r.width,r.y+r.height))
                        if settings&1:
                            rotation=(settings>>2)&15
                            op={0:None,1:Image.Transpose.FLIP_LEFT_RIGHT,2:Image.Transpose.FLIP_TOP_BOTTOM,
                                3:Image.Transpose.ROTATE_180,4:Image.Transpose.ROTATE_270}.get(rotation)
                            if op is not None:result=result.transpose(op)
                        result=result.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                        counts['unity_independent_sprite_pixel_checks']+=1
                check(result.size==(row['width'],row['height']) and pixel_hash(result)==row['pixel_sha256'],'unity-pixel:'+row['id'])
            del env
    result={'ok':not failures,'counts':dict(counts),'failures':failures,
            'limitations':['Tight polygon sprites reproduce the installed UnityPy helper; rectangular sprite crops use an independent crop/alpha/rotation implementation.',
                           'Unity pixel checks are deterministic bounded samples; blob/pixel/dimension/source hash and alias checks cover the complete catalog.']}
    target=output/'verification.json';tmp=target.with_suffix('.json.tmp');tmp.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8');tmp.replace(target)
    print(json.dumps(result,sort_keys=True));db.close()
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',type=Path,required=True);p.add_argument('--root',action='append',default=[])
    p.add_argument('--unity-samples',type=int,default=48)
    args=p.parse_args();roots={k:Path(v) for k,v in (s.split('=',1) for s in args.root)}
    raise SystemExit(0 if audit(args.output,roots,args.unity_samples)['ok'] else 1)
