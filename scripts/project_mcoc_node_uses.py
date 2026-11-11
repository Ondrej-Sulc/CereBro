"""Project only the existing modifier sample's quest labels and placed uses.

Offline, read-only inputs. No quest graphs, route normalization, DB or game access.
"""
import argparse
import json
from pathlib import Path

from extract_mcoc_node_modifiers import digest_json, pinned, pointer
from mcoc_protobuf import Decoder, fields


def clean(value):
    return ' '.join(value.split()) if isinstance(value, str) else ''


def quest_label(quest, sources):
    memberships = []
    difficulties = []
    for source_id, document in sorted(sources.items()):
        for si, container in enumerate(document.get('pveSets', [])):
            summary = (container.get('QuestSummarys') or {}).get(quest['qid'])
            if summary and summary.get('mapId') == quest.get('mapId'):
                diff = (container.get('difficulties') or {}).get(quest.get('difficultyId'))
                if diff: difficulties.append(diff)
            for ai, act in enumerate(container.get('Acts') or []):
                if not act: continue
                for ci, chapter in enumerate(act.get('Chapters') or []):
                    if not chapter: continue
                    for qi, member in enumerate(chapter.get('Quests') or []):
                        if not member or member.get('qid') != quest['qid']: continue
                        if member.get('mapId') != quest.get('mapId'): continue
                        if any(member.get(k) != quest.get(k) for k in ['actIndex', 'chapterIndex', 'questIndex']): continue
                        memberships.append(dict(act=quest.get('actIndex'), actId=act.get('actId'), chapterId=chapter.get('chapterId'),
                            actDisplayIndex=act.get('displayIndex'), actName=clean(act.get('friendlyName')),
                            chapter=quest.get('chapterIndex'),
                            quest=quest.get('questIndex'), chapterName=clean(chapter.get('friendlyName')),
                            sourceId=source_id, pointer=f'/pveSets/{si}/Acts/{ai}/Chapters/{ci}/Quests/{qi}'))
    category = (quest.get('category') or {}).get('name', 'Unknown')
    numbers = {(m['act'], m['chapter'], m['quest']) for m in memberships}
    number = None
    if category == 'Story' and len(numbers) == 1:
        indices = next(iter(numbers))
        if all(isinstance(i, int) and i > 0 for i in indices):
            number = '.'.join(map(str, indices))
    name = clean(quest.get('friendlyName')) or 'Unnamed quest'
    prefix = str(quest.get('questIndex'))+'. '
    if number and name.startswith(prefix): name = name[len(prefix):]
    difficulty = clean(quest.get('difficulty')) or None
    ranges = {(d.get('minPRG'), d.get('maxPRG')) for d in difficulties}
    if not difficulty and len(ranges) == 1:
        low, high = next(iter(ranges))
        if isinstance(low, int) and isinstance(high, int):
            difficulty = f'Progression rank {low}' + (f'–{high}' if high != low else '')
    return dict(name=name, storyNumber=number, category=category, chapter=memberships[0]['chapterName'] if memberships else None,
                collection=clean(quest.get('actFriendlyName')) if clean(quest.get('actFriendlyName')) != '-' else None,
                difficulty=difficulty, labelEvidence=dict(memberships=memberships, difficultyId=quest.get('difficultyId'),
                    difficultyDefinitions=difficulties, rawName=quest.get('friendlyName'),
                    indices={k: quest.get(k) for k in ['actIndex', 'chapterIndex', 'questIndex']}))


def placement(tile, quest, blueprints, names):
    if tile is None: return None
    boss_ids = list(dict.fromkeys(([tile['bossId']] if tile.get('bossId') else []) +
        [e['bossId'] for e in tile.get('tileEntities') or [] if e.get('bossId')]))
    defenders = []
    for boss_id in boss_ids:
        boss = (quest.get('bosses') or {}).get(boss_id) or {}
        blueprint_id = boss.get('blueprint')
        game_id = blueprints.get(blueprint_id, {}).get('Character')
        defenders.append(dict(bossId=boss_id, blueprintId=blueprint_id, gameId=game_id, name=names.get(game_id)))
    number = tile.get('nodeNumber')
    return dict(x=tile['x'], y=tile['y'], nodeNumber=number if isinstance(number, int) and number > 0 else None,
                final=bool(tile.get('isFinalBoss') or tile.get('final')), defenders=defenders)


def project_uses(catalog, sources, blueprints, names):
    bindings = {}
    for definition in catalog['definitions']:
        for version in definition['versions']:
            for application in version['applications']:
                key = (definition['id'], version['definitionHash'], application['hash'])
                if key in bindings and bindings[key] != version['hash']:
                    raise ValueError('Ambiguous definition version')
                bindings[key] = version['hash']
    known = {d['id'] for d in catalog['definitions']}
    quests, uses = [], {}
    for source in catalog['profile']['inputs']:
        document = sources[source['id']]
        for map_pointer in source['pointers']:
            map_data = pointer(document, map_pointer)
            summary_pointer = '/quest' if map_pointer == '/map' else map_pointer.replace('/QuestMaps/', '/QuestSummarys/')
            quest = pointer(document, summary_pointer)
            key = digest_json(dict(qid=quest['qid'], mapId=quest['mapId'], sourceSha256=source['sha256']))
            container = (document.get('container') or {}) if map_pointer == '/map' else pointer(document, map_pointer.split('/QuestMaps/')[0])
            quests.append(dict(key=key, questId=quest['qid'], mapId=quest['mapId'], sourceId=source['id'],
                containerSetId=container.get('setId'), containerSetName=container.get('setName'),
                summarySetId=quest.get('setId'), summarySetName=quest.get('setName'),
                sourceSha256=source['sha256'], mapPointer=map_pointer, summaryPointer=summary_pointer, **quest_label(quest, sources)))
            tiles = {(t['x'], t['y']): t for t in map_data['walkableTiles']}
            for ti, tile in enumerate(map_data['walkableTiles']):
                for list_name in sorted(tile):
                    is_assignment = list_name in ('attackerBuffs', 'defenderBuffs')
                    if not is_assignment and not (list_name.startswith('source') and list_name.endswith('Buffs')): continue
                    for bi, application in enumerate(tile[list_name] or []):
                        raw_buff = application.get('buff') or {}
                        effect_id = raw_buff.get('id')
                        if effect_id not in known: continue
                        raw = {k: v for k, v in application.items() if k not in ('buff', 'sourceCoordinate')}
                        app_hash = digest_json(raw)
                        version = bindings.get((effect_id, digest_json(raw_buff), app_hash))
                        if not version: raise ValueError(f'Unbound application: {effect_id}')
                        origin = application.get('sourceCoordinate')
                        origin_tile = tiles.get((origin['x'], origin['y'])) if origin else None
                        identity = dict(questKey=key, effectId=effect_id, versionHash=version, applicationHash=app_hash,
                                        sourceCoordinate=origin)
                        use_id = digest_json(identity)
                        node_source = application.get('nodeSource') or {}
                        side = 'attacker' if node_source.get('attk') is True else 'defender' if node_source.get('attk') is False else 'unknown'
                        use = uses.setdefault(use_id, dict(id=use_id, **identity, role=(node_source.get('type') or {}).get('name', 'Unknown'),
                            side=side, sourceNode=placement(origin_tile, quest, blueprints, names), affectedNodes=[], sourcePointers=[]))
                        path = f'{map_pointer}/walkableTiles/{ti}/{list_name}/{bi}'
                        if not is_assignment:
                            use['sourcePointers'].append(path)
                        else:
                            expected_side = 'attacker' if list_name == 'attackerBuffs' else 'defender'
                            if side != expected_side: raise ValueError('Assignment side mismatch')
                            placed = placement(tile, quest, blueprints, names)
                            # Only named, placed encounters: empty walkable tiles and
                            # unplaced boss-table rows do not become affected fights.
                            if placed['defenders']:
                                existing = next((n for n in use['affectedNodes'] if n['x'] == tile['x'] and n['y'] == tile['y']), None)
                                if existing: existing['pointers'].append(path)
                                else: use['affectedNodes'].append(dict(**placed, pointers=[path]))
    output = dict(schemaVersion=1, contract='cerebro.node-modifier-uses/v1', modifierCatalogHash=catalog['contentHash'],
                  quests=sorted(quests, key=lambda q: q['key']), uses=sorted(uses.values(), key=lambda u: u['id']))
    for use in output['uses']:
        use['affectedNodes'].sort(key=lambda n: (n['nodeNumber'] or 0, n['x'], n['y']))
        use['sourcePointers'] = sorted(set(use['sourcePointers']))
    return output


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['catalog', 'source-root', 'bcg', 'schema', 'out']:
        parser.add_argument('--'+name, type=Path, required=True)
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding='utf-8'))
    if catalog['contentHash'] != digest_json({k: v for k, v in catalog.items() if k != 'contentHash'}):
        raise ValueError('Modifier catalog hash mismatch')
    profile = catalog['profile']
    sources = {s['id']: json.loads(pinned(args.source_root/s['path'], s['sha256'])) for s in profile['inputs']}
    decoder = Decoder(json.loads(pinned(args.schema, profile['schemaSha256'])))
    blueprints, names = {}, {}
    for tag, wire, value, _ in fields(pinned(args.bcg, profile['bcgSha256'])):
        if tag not in (3, 4): continue
        row = decoder.message(value, 'BCGBlueprintBase' if tag == 3 else 'BCGCharacterData')
        if tag == 3:
            if row['Blueprint'] in blueprints: raise ValueError('Duplicate blueprint')
            blueprints[row['Blueprint']] = row
        else:
            if row['Character'] in names: raise ValueError('Duplicate character')
            names[row['Character']] = clean((row.get('_friendlyNameLoc') or {}).get('en')) or None
    if decoder.unknown: raise ValueError('Unknown blueprint/character schema')
    result = project_uses(catalog, sources, blueprints, names)
    result['provenance'] = dict(inputs=profile['inputs'], bcgSha256=profile['bcgSha256'], schemaSha256=profile['schemaSha256'])
    result['contentHash'] = digest_json(result)
    protected = [args.catalog, args.bcg, args.schema, *[args.source_root/s['path'] for s in profile['inputs']]]
    if args.out.resolve() in [p.resolve() for p in protected]: raise ValueError('Output cannot overwrite input')
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':'))+'\n', encoding='utf-8')


if __name__ == '__main__':
    main()
