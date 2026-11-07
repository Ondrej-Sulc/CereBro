"""Strict, schema-driven reader for local MCOC protobuf catalogs.

Preserves unknown fields and supports packed repeated numbers. It never guesses
whether a byte string is text or a nested message.
"""
from __future__ import annotations

import base64
import struct


def varint(data: bytes, pos: int = 0):
    value = 0
    for shift in range(0, 70, 7):
        if pos >= len(data):
            raise ValueError('Truncated varint')
        byte = data[pos]; pos += 1
        value |= (byte & 127) << shift
        if byte < 128:
            if value >= 1 << 64:
                raise ValueError('Varint exceeds uint64')
            return value, pos
    raise ValueError('Overlong varint')


def fields(data: bytes):
    pos = 0
    while pos < len(data):
        start = pos
        tag, pos = varint(data, pos)
        number, wire = tag >> 3, tag & 7
        if number < 1 or number >= 1 << 29:
            raise ValueError(f'Invalid field tag {number}')
        if wire == 0:
            value, pos = varint(data, pos)
        elif wire in (1, 5):
            end = pos + (8 if wire == 1 else 4)
            if end > len(data):
                raise ValueError('Truncated fixed-width value')
            value = data[pos:end]; pos = end
        elif wire == 2:
            size, pos = varint(data, pos)
            end = pos + size
            if end > len(data):
                raise ValueError('Truncated length-delimited value')
            value = data[pos:end]; pos = end
        else:
            raise ValueError(f'Unsupported wire type {wire}')
        yield number, wire, value, data[start:pos]


def generic_args(kind: str):
    body = kind[kind.index('<')+1:-1]
    args, start, depth = [], 0, 0
    for i, char in enumerate(body):
        if char == '<': depth += 1
        elif char == '>': depth -= 1
        elif char == ',' and depth == 0:
            args.append(body[start:i]); start = i+1
    return args + [body[start:]]


class Decoder:
    def __init__(self, schema):
        self.schema = schema['types'] if 'types' in schema else schema
        self.used_types = set()
        self.unknown = []

    def message(self, data: bytes, kind: str, path: str = ''):
        if kind not in self.schema:
            raise ValueError(f'Missing schema {kind} at {path}')
        self.used_types.add(kind)
        specs = {f['tag']: f for f in self.schema[kind]['fields']}
        output = {}
        for tag, wire, value, raw in fields(data):
            if tag not in specs:
                item = dict(tag=tag, wire=wire, rawBase64=base64.b64encode(raw).decode())
                output.setdefault('_unknownFields', []).append(item)
                self.unknown.append(dict(path=path, type=kind, tag=tag))
                continue
            spec = specs[tag]; name = spec['name']; typ = spec['type']
            if spec.get('options', {}).get('DataFormat', 0) != 0:
                raise ValueError(f'Unsupported explicit DataFormat at {path}.{name}')
            member_path = path+'.'+name if path else name
            if typ.startswith('System.Collections.Generic.Dictionary`2<'):
                if wire != 2: raise ValueError(f'Non-message dictionary {member_path}')
                key_type, value_type = generic_args(typ)
                parts = list(fields(value))
                unknown = [n for n,w,v,r in parts if n not in (1, 2)]
                if unknown: raise ValueError(f'Unknown dictionary tags at {member_path}: {unknown}')
                keys = [self.scalar(v, w, key_type, member_path+'.key') for n,w,v,r in parts if n == 1]
                vals = [self.scalar(v, w, value_type, member_path+'.value') for n,w,v,r in parts if n == 2]
                if len(keys) != 1 or len(vals) != 1:
                    raise ValueError(f'Incomplete/duplicate dictionary entry at {member_path}')
                mapping = output.setdefault(name, {})
                key = str(keys[0])
                if key in mapping: raise ValueError(f'Duplicate dictionary key {member_path}[{key}]')
                mapping[key] = vals[0]
            elif typ != 'byte[]' and (typ.endswith('[]') or typ.startswith('System.Collections.Generic.List`1<')):
                inner = typ[:-2] if typ.endswith('[]') else generic_args(typ)[0]
                target = output.setdefault(name, [])
                if wire == 2 and self.is_numeric(inner):
                    target.extend(self.packed(value, inner, member_path))
                else:
                    target.append(self.scalar(value, wire, inner, member_path))
            else:
                if name in output:
                    raise ValueError(f'Duplicate scalar member {member_path}')
                output[name] = self.scalar(value, wire, typ, member_path)
        return output

    def is_numeric(self, kind):
        return kind in {'bool','byte','sbyte','short','ushort','int','uint','long','ulong','float','double'} or self.schema.get(kind, {}).get('baseType') == 'System.Enum'

    def packed(self, data, kind, path):
        pos = 0; result = []
        while pos < len(data):
            if kind in ('float', 'double'):
                size = 4 if kind == 'float' else 8
                if pos+size > len(data): raise ValueError(f'Truncated packed {kind} at {path}')
                result.append(self.scalar(data[pos:pos+size], 5 if size == 4 else 1, kind, path)); pos += size
            else:
                value, pos = varint(data, pos)
                result.append(self.scalar(value, 0, kind, path))
        return result

    def scalar(self, value, wire, kind, path):
        expected = 2
        if self.is_numeric(kind): expected = 5 if kind == 'float' else 1 if kind == 'double' else 0
        if wire != expected: raise ValueError(f'Wire {wire} for {kind} at {path}, expected {expected}')
        if kind == 'string': return value.decode('utf-8', errors='strict')
        if kind == 'byte[]': return {'base64': base64.b64encode(value).decode()}
        if kind in ('float', 'double'): return struct.unpack('<f' if kind == 'float' else '<d', value)[0]
        if kind == 'bool':
            if value not in (0, 1): raise ValueError(f'Invalid bool {value} at {path}')
            return bool(value)
        if self.is_numeric(kind):
            if kind in ('int', 'short', 'sbyte') or self.schema.get(kind, {}).get('baseType') == 'System.Enum':
                value &= (1 << 32)-1
                if value >= 1 << 31: value -= 1 << 32
            elif kind == 'long' and value >= 1 << 63: value -= 1 << 64
            return value
        return self.message(value, kind, path)
