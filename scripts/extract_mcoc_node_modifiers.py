"""Offline EXTRACT / DIFF / DRY-RUN for an evidence-bound node modifier sample.

No network, game process, Prisma, or database access. Buff IDs are not component
IDs or curated NodeModifier cuids. Templates are never numerically guessed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from mcoc_protobuf import Decoder, fields


def encoded(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')


def digest_json(value):
    return hashlib.sha256(encoded(value)).hexdigest()


def pinned(path, expected):
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError(f'Source hash mismatch: {path.name}')
    return data


def pointer(value, path):
    for token in path.split('/')[1:]:
        key = token.replace('~1', '/').replace('~0', '~')
        value = value[int(key)] if isinstance(value, list) else value[key]
    return value


def walk(value, path):
    if isinstance(value, dict):
        if isinstance(value.get('buff'), dict) and value['buff'].get('id'):
            yield path, value
        else:
            for key in sorted(value):
                yield from walk(value[key], path+'/'+key.replace('~', '~0').replace('/', '~1'))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from walk(item, path+'/'+str(index))


def build_definitions(samples, components, bcg_sha256=None):
    definitions = {}
    for source_id, source_pointer, sample in sorted(samples, key=lambda s: (s[0], s[1])):
        for path, app in walk(sample, source_pointer):
            raw = app['buff']
            identity = raw['id']
            if not isinstance(identity, str) or not identity:
                raise ValueError('Missing Buff identity')
            # Only statMods has the named BCG component binding. Other valueStr
            # types remain opaque. Preserve order; it is not a set of synonyms.
            ids = (raw.get('buffStatMods') or raw.get('valueStr') or []) if raw.get('buffType') == 'statMods' else []
            if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
                raise ValueError(f'Invalid component IDs: {identity}')
            linked = [dict(id=i, hash=digest_json(components[i]), raw=components[i]) for i in ids if i in components]
            missing = [i for i in ids if i not in components]
            # Bind the complete BCG source too: referenced formula/inheritance
            # definitions may change while these raw component rows stay equal.
            revision = digest_json(dict(raw=raw, components=linked, missingComponentIds=missing, sourceBcgSha256=bcg_sha256))
            definition = definitions.setdefault(identity, dict(id=identity, versions={}))
            version = definition['versions'].setdefault(revision, dict(hash=revision, sourceBcgSha256=bcg_sha256, definitionHash=digest_json(raw), raw=raw,
                componentIds=ids, components=linked, missingComponentIds=missing, applications={}))
            context = {k: v for k, v in app.items() if k not in ('buff', 'sourceCoordinate')}
            app_hash = digest_json(context)
            variant = version['applications'].setdefault(app_hash, dict(hash=app_hash, text=app.get('buffDescription'), raw=context,
                evidence=dict(sourceId=source_id, pointer=path, coordinate=app.get('sourceCoordinate')), observations=0))
            # Observations include aliases such as sourceAllBuffs/sourceLocalBuffs.
            # They are deliberately NOT encounter counts or an occurrence index.
            variant['observations'] += 1
    result = []
    for identity in sorted(definitions):
        definition = definitions[identity]
        definition['versions'] = [definition['versions'][key] for key in sorted(definition['versions'])]
        for version in definition['versions']:
            version['applications'] = [version['applications'][key] for key in sorted(version['applications'])]
        result.append(definition)
    return result


def extract(profile, source_root, bcg_path, schema_path, evidence_root):
    schema = json.loads(pinned(schema_path, profile['schemaSha256']))
    for kind, expected in {'BCGDataBuffer': {1: 'stat_modifiers'}, 'BCGStatModifier': {1: 'ID', 13: 'Chance', 14: 'Modifier', 15: 'Duration', 24: 'Stackable'}}.items():
        actual = {f['tag']: f['name'] for f in schema['types'][kind]['fields']}
        if any(actual.get(tag) != name for tag, name in expected.items()):
            raise ValueError(f'Named schema drift: {kind}')
    for item in profile['evidence']:
        pinned(evidence_root/item['path'], item['sha256'])
    samples = []
    for item in profile['inputs']:
        value = json.loads(pinned(source_root/item['path'], item['sha256']))
        if value.get('gameAssemblySha256') != profile['gameAssemblySha256']:
            raise ValueError('Capture/game build mismatch')
        for path in item['pointers']:
            samples.append((item['id'], path, pointer(value, path)))
    decoder = Decoder(schema)
    components = {}
    for tag, wire, value, _ in fields(pinned(bcg_path, profile['bcgSha256'])):
        if tag != 1:
            continue
        if wire != 2:
            raise ValueError('Non-message stat modifier')
        row = decoder.message(value, 'BCGStatModifier')
        identity = row.get('ID')
        if not identity or identity in components:
            raise ValueError(f'Duplicate/missing BCG component: {identity}')
        components[identity] = row
    if decoder.unknown:
        raise ValueError('Unknown BCG component fields; review schema before refresh')
    definitions = build_definitions(samples, components, profile['bcgSha256'])
    if not definitions:
        raise ValueError('Empty modifier sample')
    output = dict(schemaVersion=1, contract='cerebro.node-modifier-definitions/v1', profile=profile,
                  profileHash=digest_json(profile), definitions=definitions)
    output['contentHash'] = digest_json(output)
    return output


def catalog_diff(before, after):
    old = {d['id']: digest_json(d) for d in before['definitions']}
    new = {d['id']: digest_json(d) for d in after['definitions']}
    if len(old) != len(before['definitions']) or len(new) != len(after['definitions']):
        raise ValueError('Duplicate Buff definition identity')
    return dict(added=sorted(new.keys()-old.keys()), removed=sorted(old.keys()-new.keys()),
                changed=sorted(i for i in old.keys() & new.keys() if old[i] != new[i]),
                provenanceChanged=digest_json(before.get('profile')) != digest_json(after.get('profile')), writes=[])


def reconciliation_plan(catalog, curated, bindings):
    records = {r['id']: r for r in curated}
    if len(records) != len(curated):
        raise ValueError('Duplicate curated cuid')
    versions = {d['id']: {v['hash'] for v in d['versions']} for d in catalog['definitions']}
    if len(versions) != len(catalog['definitions']):
        raise ValueError('Duplicate Buff definition identity')
    result = []
    seen = set()
    for binding in bindings:
        key = (binding['curatedId'], binding['effectId'], binding['versionHash'])
        if key in seen:
            raise ValueError('Duplicate binding')
        seen.add(key)
        identity = binding['curatedId']
        effect = binding['effectId']
        status = 'verified'
        if identity not in records: status = 'missing-curated-record'
        elif effect not in versions: status = 'missing-definition'
        elif binding['versionHash'] not in versions[effect]: status = 'definition-drift'
        elif binding['curatedHash'] != digest_json(records[identity]): status = 'curated-drift'
        result.append(dict(**binding, status=status))
    bound = {b['curatedId'] for b in result if b['status'] == 'verified'}
    return dict(mode='DRY-RUN', bindings=result, unboundCuratedIds=sorted(records.keys()-bound),
                preservedCuratedRecords=curated, writes=[])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='mode', required=True)
    ex = sub.add_parser('extract')
    for name in ['profile', 'source-root', 'bcg', 'schema', 'evidence-root', 'out']:
        ex.add_argument('--'+name, type=Path, required=True)
    diff = sub.add_parser('diff')
    diff.add_argument('--before', type=Path, required=True)
    diff.add_argument('--after', type=Path, required=True)
    diff.add_argument('--out', type=Path, required=True)
    dry = sub.add_parser('dry-run')
    for name in ['catalog', 'curated', 'bindings', 'out']:
        dry.add_argument('--'+name, type=Path, required=True)
    args = parser.parse_args()
    load = lambda path: json.loads(path.read_text(encoding='utf-8'))
    if args.mode == 'extract':
        result = extract(load(args.profile), args.source_root, args.bcg, args.schema, args.evidence_root)
        protected = ([args.profile, args.bcg, args.schema]
                     + [args.source_root/i['path'] for i in load(args.profile)['inputs']]
                     + [args.evidence_root/i['path'] for i in load(args.profile)['evidence']])
    elif args.mode == 'diff':
        result = catalog_diff(load(args.before), load(args.after)); protected = [args.before, args.after]
    else:
        result = reconciliation_plan(load(args.catalog), load(args.curated), load(args.bindings))
        protected = [args.catalog, args.curated, args.bindings]
    if args.out.resolve() in [p.resolve() for p in protected]:
        raise ValueError('Output must not overwrite an input')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, sort_keys=True, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf-8')


if __name__ == '__main__':
    main()
