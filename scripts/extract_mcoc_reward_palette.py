"""Read the game's ColorDictionary asset; never load or execute game code."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

REVIEWED_MARVEL_METADATA = 'd1b1085922513073b9dcd656aa08ee70e01a7aef1433aa35876fdfba463278b5'


def parse_color_dictionary(payload):
    """Reviewed serialized fields: RarityColorSet[] followed by ColorDefinition[]."""
    offset=0
    def read(fmt):
        nonlocal offset
        size=struct.calcsize(fmt)
        if offset+size>len(payload): raise ValueError('Truncated ColorDictionary')
        values=struct.unpack_from(fmt,payload,offset);offset+=size
        return values
    def count():
        value=read('<I')[0]
        if value>10000:raise ValueError('Unreviewed ColorDictionary count')
        return value
    def string():
        nonlocal offset
        size=count()
        if offset+size>len(payload):raise ValueError('Truncated ColorDictionary string')
        value=payload[offset:offset+size].decode('utf-8');offset=(offset+size+3)//4*4
        return value
    def color():
        values=list(read('<4f'))
        if any(not math.isfinite(value) or not 0<=value<=1 for value in values):raise ValueError('Unreviewed ColorDictionary color')
        return values
    for _ in range(count()):
        read('<i');string()
        for _ in range(7):color()
    result={}
    for _ in range(count()):
        key=string();rgba=color()
        if not key or key in result:raise ValueError('Duplicate or empty ColorDictionary key')
        result[key]=rgba
    if offset!=len(payload):raise ValueError('Unreviewed ColorDictionary trailing fields')
    return result


def extract(resources, metadata):
    import UnityPy
    metadata_hash=hashlib.sha256(metadata.read_bytes()).hexdigest()
    if metadata_hash!=REVIEWED_MARVEL_METADATA:raise ValueError('ColorDictionary metadata requires review')
    env=UnityPy.load(str(resources));matches=[]
    for obj in env.objects:
        if obj.type.name=='MonoBehaviour' and obj.read(check_read=False).m_Name=='ColorDictionary':matches.append(obj)
    if len(matches)!=1:raise ValueError('Expected one ColorDictionary asset')
    obj=matches[0];raw=obj.get_raw_data()
    # Reviewed Unity MonoBehaviour header, followed by the two serialized arrays.
    size=struct.unpack_from('<I',raw,28)[0]
    if raw[32:32+size].decode('utf-8')!='ColorDictionary':raise ValueError('Unreviewed MonoBehaviour header')
    colors=parse_color_dictionary(raw[(32+size+3)//4*4:])
    for key in ['class_cosmic','class_chemical','class_mutant','class_trained','class_mystic','class_tech','class_none','class_iso_generic']:
        if key not in colors:raise ValueError('Missing required class color')
    return {'version':1,'source':{'fileName':resources.name,'sha256':hashlib.sha256(resources.read_bytes()).hexdigest(),
        'pathId':obj.path_id,'objectSha256':hashlib.sha256(raw).hexdigest(),'metadataSha256':metadata_hash},'colors':colors}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    for name in ['resources','metadata','out']:parser.add_argument('--'+name,type=Path,required=True)
    args=parser.parse_args();result=extract(args.resources,args.metadata)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,separators=(',',':'))+'\n',encoding='utf-8')
    print(json.dumps({'colors':len(result['colors']),'classColors':sum(key.startswith('class_') for key in result['colors'])}))
