"""Export named protobuf contracts from current Cpp2IL metadata, without loading game code."""
import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path


def raw_rows(pe, table_name):
    table = getattr(pe.net.mdtables, table_name, None)
    if not table or not table.rows: return []
    shape = table.rows[0].struct
    names = [k[0] for k in shape.__keys__]
    return [dict(zip(names, values)) for values in struct.iter_unpack(shape.__format_str__, table._table_data)]


def export_schema(dump, dependencies=None):
    if dependencies:
        sys.path.insert(0, str(dependencies))
    import dnfile
    output = {}; sources = []
    for assembly in ['Marvel.Runtime', 'Fuse.Runtime']:
        path = dump/(assembly+'.dll')
        pe = dnfile.dnPE(str(path), clr_lazy_load=True)
        tables = {k:raw_rows(pe,k) for k in ['TypeDef','TypeRef','Field','Property','PropertyMap','MemberRef','CustomAttribute','NestedClass']}
        strings = pe.net.metadata.streams[b'#Strings']; blobs = pe.net.metadata.streams[b'#Blob']
        cache = {}
        def name(index):
            if index not in cache: cache[index] = str(strings.get(index).value)
            return cache[index]
        parents = {r['NestedClass_Index']:r['EnclosingClass_Index'] for r in tables['NestedClass']}
        def typename(table, rid):
            row = tables[table][rid-1]; simple = name(row['TypeName_StringIndex'])
            if table == 'TypeDef' and rid in parents: return typename(table, parents[rid])+'+'+simple
            if table == 'TypeRef' and row['ResolutionScope_CodedIndex'] & 3 == 3:
                return typename(table, row['ResolutionScope_CodedIndex'] >> 2)+'+'+simple
            return '.'.join(filter(None, [name(row['TypeNamespace_StringIndex']), simple]))
        def coded_type(code):
            tag, rid = code & 3, code >> 2
            return typename('TypeDef' if tag == 0 else 'TypeRef', rid) if tag < 2 else f'TypeSpec#{rid}'
        def compressed(blob, pos):
            value = blob[pos]; pos += 1
            if value & 128 == 0: return value, pos
            if value & 192 == 128: return ((value & 63) << 8) | blob[pos], pos+1
            return ((value & 31) << 24) | int.from_bytes(blob[pos:pos+3], 'big'), pos+3
        def signature(blob, pos=1):
            code = blob[pos]; pos += 1
            primitive = {1:'void',2:'bool',3:'char',4:'sbyte',5:'byte',6:'short',7:'ushort',8:'int',9:'uint',10:'long',11:'ulong',12:'float',13:'double',14:'string',28:'object'}
            if code in primitive: return primitive[code], pos
            if code in (17,18):
                typ, pos = compressed(blob,pos); return coded_type(typ), pos
            if code == 29:
                kind,pos=signature(blob,pos); return kind+'[]',pos
            if code == 21:
                pos += 1; typ,pos=compressed(blob,pos); count,pos=compressed(blob,pos); args=[]
                for _ in range(count):
                    arg,pos=signature(blob,pos);args.append(arg)
                return coded_type(typ)+'<'+','.join(args)+'>',pos
            return f'element_{code}',pos
        attr_ctors = set()
        for rid,row in enumerate(tables['MemberRef'],1):
            cls = row['Class_CodedIndex']; tag=cls & 7
            if tag in (0,1) and typename('TypeDef' if tag == 0 else 'TypeRef',cls >> 3) == 'ProtoBuf.ProtoMemberAttribute': attr_ctors.add(rid)
        tags = {}
        def options(blob):
            count=struct.unpack_from('<H',blob,6)[0];pos=8;result={}
            def string():
                nonlocal pos
                if blob[pos] == 255: pos+=1;return None
                size,pos=compressed(blob,pos);text=blob[pos:pos+size].decode('utf-8');pos+=size;return text
            for _ in range(count):
                target,kind=blob[pos:pos+2];pos+=2
                if target not in (83,84): raise ValueError('Invalid named attribute target')
                if kind == 85: enum_type=string()
                key=string()
                if kind == 2: value=bool(blob[pos]);pos+=1
                elif kind in (8,85): value=struct.unpack_from('<i',blob,pos)[0];pos+=4
                elif kind in (14,80): value=string()
                else: raise ValueError(f'Unsupported ProtoMember option type {kind}')
                result[key]=value
            if pos != len(blob): raise ValueError('Trailing ProtoMember option bytes')
            return result
        for attr in tables['CustomAttribute']:
            typ=attr['Type_CodedIndex']
            if typ & 7 == 3 and typ >> 3 in attr_ctors:
                blob=blobs.get(attr['Value_BlobIndex']).value
                if blob[:2] != b'\x01\x00': raise ValueError('Invalid ProtoMember attribute')
                tag=struct.unpack_from('<i',blob,2)[0]
                tags[attr['Parent_CodedIndex']]=dict(tag=tag,options=options(blob))
        prop_maps={row['Parent_Index']:(row['PropertyList_Index'], tables['PropertyMap'][i+1]['PropertyList_Index'] if i+1<len(tables['PropertyMap']) else len(tables['Property'])+1) for i,row in enumerate(tables['PropertyMap'])}
        for index,row in enumerate(tables['TypeDef']):
            members=[]
            fend=tables['TypeDef'][index+1]['FieldList_Index'] if index+1<len(tables['TypeDef']) else len(tables['Field'])+1
            for rid in range(row['FieldList_Index'],fend):
                tag=tags.get((rid << 5) | 1)
                if tag is not None:
                    f=tables['Field'][rid-1];members.append(dict(**tag,name=name(f['Name_StringIndex']),type=signature(blobs.get(f['Signature_BlobIndex']).value)[0]))
            for rid in range(*prop_maps.get(index+1,(0,0))):
                tag=tags.get((rid << 5) | 9)
                if tag is not None:
                    f=tables['Property'][rid-1];members.append(dict(**tag,name=name(f['Name_StringIndex']),type=signature(blobs.get(f['Type_BlobIndex']).value,2)[0]))
            base=coded_type(row['Extends_CodedIndex']) if row['Extends_CodedIndex'] else None
            if not members and base != 'System.Enum': continue
            full=typename('TypeDef',index+1)
            if full in output: raise ValueError(f'Duplicate protobuf type {full}')
            if len({m['tag'] for m in members}) != len(members): raise ValueError(f'Duplicate tags {full}')
            output[full]=dict(assembly=assembly,baseType=base,fields=sorted(members,key=lambda x:x['tag']))
        sources.append(dict(path=str(path),sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
        print(assembly, 'schema types so far',len(output),flush=True)
    return dict(version=1,sources=sources,types=output)


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dump',type=Path,required=True)
    parser.add_argument('--dependencies',type=Path,help='Optional directory containing dnfile')
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args(); schema=export_schema(args.dump,args.dependencies)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(schema,ensure_ascii=False,indent=2),encoding='utf-8')
