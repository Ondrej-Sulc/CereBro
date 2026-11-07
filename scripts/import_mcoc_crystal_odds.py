"""Import genuine, reviewed game-UI odds disclosures with source and image evidence.

This does not fetch private game APIs, infer individual champion rates, OCR images,
or fabricate undisclosed rows. Synthetic inputs belong only in importer tests.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from extract_mcoc_crystal_rules import validate_contracts
from mcoc_protobuf import Decoder


def only_keys(value, allowed, required, label):
    if not isinstance(value, dict) or set(value)-set(allowed) or set(required)-set(value):
        raise ValueError(f'Unexpected or missing fields in {label}')


def nonempty(value, label, limit=1000):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f'Invalid {label}')
    return value.strip()


def normalize_text(value):
    return re.sub(r'\s+', ' ', value).strip()


def parse_displayed_percent(value):
    if not isinstance(value, str):
        raise ValueError('Invalid displayed percentage')
    match = re.fullmatch(r'\s*([<>≤≥]?)\s*(\d{1,3}(?:\.\d{1,8})?)\s*%\s*', value)
    if not match:
        raise ValueError('Invalid displayed percentage')
    prefix, number = match.groups()
    amount = Decimal(number)
    if amount < 0 or amount > 100:
        raise ValueError('Displayed percentage outside 0–100')
    return dict(displayedPercent=value.strip(), percentValue=number,
                comparison={'': 'displayed', '<': 'less-than', '>': 'greater-than', '≤': 'at-most', '≥': 'at-least'}[prefix],
                decimalPlaces=len(number.partition('.')[2]), rateBasis='displayed-category')


def outcome_hint(label):
    hero = re.fullmatch(r'([1-7])-Star Hero', label)
    if hero:
        return dict(kind='champion-rarity', rarity=int(hero[1]))
    nexus = re.fullmatch(r'([1-7])-Star Nexus Hero Crystal', label)
    if nexus:
        return dict(kind='nested-crystal', rarityHint=int(nexus[1]), selectionHint='nexus')
    return dict(kind='disclosed-category')


def store_tab(box):
    # Verified GachaCrystalButton.Config.GetTab: Premium→4, Shards→2,
    # Special→3, everything else→the ordinary Crystals tab (1).
    value = box.get('GameSpecificData', {}).get('Tab', '')
    return {'Premium': 'Premium', 'Shards': 'Shard Crystals', 'Special': 'Special'}.get(value, 'Crystals')


def image_evidence(row, evidence_root):
    only_keys(row, {'file', 'sha256', 'role'}, {'file', 'sha256', 'role'}, 'image evidence')
    relative = Path(nonempty(row['file'], 'evidence path', 400))
    root = evidence_root.resolve()
    path = (root/relative).resolve()
    if relative.is_absolute() or not path.is_relative_to(root):
        raise ValueError('Evidence path escapes the supplied directory')
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if row['sha256'] != digest:
        raise ValueError('Evidence content hash mismatch')
    if data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR' or len(data) < 24:
        raise ValueError('Expected PNG screenshot evidence')
    width, height = struct.unpack('>II', data[16:24])
    role = row['role']
    if role not in ('odds-tooltip', 'identity-path'):
        raise ValueError('Unknown evidence role')
    return dict(file=relative.as_posix(), sha256=digest, role=role, width=width, height=height)


def import_disclosures(captures, gacha, source_sha256, evidence_root):
    only_keys(captures, {'version', 'gachaSha256', 'captures'}, {'version', 'gachaSha256', 'captures'}, 'capture package')
    if captures['version'] != 1 or captures['gachaSha256'] != source_sha256:
        raise ValueError('Capture package does not match this gacha snapshot')
    if not isinstance(captures['captures'], list) or not captures['captures']:
        raise ValueError('No real disclosure captures supplied')
    boxes = [box for group in gacha.get('groups', []) for box in group.get('Set', {}).get('Boxes', [])]
    if len({box['Name'] for box in boxes}) != len(boxes):
        raise ValueError('Duplicate crystal source identities')
    output, identities = [], set()
    for capture in captures['captures']:
        required = {'crystalId', 'displayName', 'description', 'storeTab', 'observedAt', 'timestampBasis', 'complete', 'rows', 'evidence'}
        only_keys(capture, required | {'expectedTotalPercent'}, required, 'disclosure capture')
        observed = datetime.fromisoformat(nonempty(capture['observedAt'], 'observation time', 64).replace('Z', '+00:00'))
        if observed.tzinfo is None:
            raise ValueError('Observation time must include a timezone')
        if capture['timestampBasis'] not in ('snapshot-observed', 'sanitized-evidence-saved'):
            raise ValueError('Unknown observation timestamp basis')
        if type(capture['complete']) is not bool:
            raise ValueError('Capture completeness must be explicit')
        crystal_id = nonempty(capture['crystalId'], 'source crystal identity', 512)
        title = nonempty(capture['displayName'], 'observed title', 300)
        description = nonempty(capture['description'], 'observed description', 6000)
        tab = nonempty(capture['storeTab'], 'observed tab', 40)
        matches = [box for box in boxes if normalize_text(box.get('_displayName', {}).get('en', '')) == normalize_text(title)
                   and normalize_text(box.get('_description', {}).get('en', '')) == normalize_text(description) and store_tab(box) == tab]
        if len(matches) != 1 or matches[0]['Name'] != crystal_id:
            raise ValueError('Title/description/tab do not uniquely prove this source opening')
        key = crystal_id, observed.isoformat()
        if key in identities:
            raise ValueError('Duplicate source-opening observation')
        identities.add(key)
        if not isinstance(capture['evidence'], list) or not capture['evidence']:
            raise ValueError('Real screenshot evidence is required')
        evidence = [image_evidence(row, evidence_root) for row in capture['evidence']]
        if not any(row['role'] == 'odds-tooltip' for row in evidence):
            raise ValueError('A disclosure screenshot is required')
        if not isinstance(capture['rows'], list) or not capture['rows']:
            raise ValueError('No disclosed rate rows')
        rows, labels = [], set()
        for row in capture['rows']:
            only_keys(row, {'label', 'displayedPercent'}, {'label', 'displayedPercent'}, 'rate row')
            label = nonempty(row['label'], 'disclosed label', 300)
            if label in labels:
                raise ValueError('Duplicate disclosed label within this group')
            labels.add(label)
            rows.append(dict(label=label, **parse_displayed_percent(row['displayedPercent']), outcomeHint=outcome_hint(label)))
        total = sum((Decimal(row['percentValue']) for row in rows), Decimal(0))
        sum_status = 'not-requested'
        if 'expectedTotalPercent' in capture:
            if not capture['complete'] or any(row['comparison'] != 'displayed' for row in rows):
                raise ValueError('Cannot total-check a partial or bounded disclosure')
            try:
                expected = Decimal(nonempty(capture['expectedTotalPercent'], 'expected displayed total', 32))
            except InvalidOperation as error:
                raise ValueError('Invalid expected total') from error
            if not expected.is_finite() or expected < 0 or expected > 100:
                raise ValueError('Invalid expected total')
            rounding = sum((Decimal(5).scaleb(-row['decimalPlaces']-1) for row in rows), Decimal(0))
            if abs(total-expected) > rounding:
                raise ValueError('Disclosed rows do not match the declared total within display rounding')
            sum_status = 'within-display-rounding'
        output.append(dict(sourceCrystalId=crystal_id, displayName=title, description=description, storeTab=tab,
                           observedAt=observed.isoformat(), timestampBasis=capture['timestampBasis'], sourceMethod='game-ui-transcription',
                           sourceIdentityProof='unique-title-description-tab', captureComplete=capture['complete'],
                           exactUnderlyingOddsKnown=False, serverResponseAsOf=None, rows=rows, displayedSumPercent=str(total),
                           sumValidation=sum_status, evidence=evidence))
    return dict(version=1, source=dict(gachaSha256=source_sha256, captureMethod='game-ui-transcription', language='en',
                                      apiPayloadCaptured=False), disclosures=output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--captures', type=Path, required=True)
    parser.add_argument('--gacha', type=Path, required=True)
    parser.add_argument('--schema', type=Path, required=True)
    parser.add_argument('--evidence-root', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    schema = json.loads(args.schema.read_text(encoding='utf8'))
    validate_contracts(schema)
    raw = args.gacha.read_bytes()
    decoder = Decoder(schema)
    gacha = decoder.message(raw, 'EB.Sparx.GachaDataBuffer')
    if decoder.unknown:
        raise ValueError('Unreviewed gacha protobuf fields')
    result = import_disclosures(json.loads(args.captures.read_text(encoding='utf8')), gacha,
                                hashlib.sha256(raw).hexdigest(), args.evidence_root)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
    print(json.dumps(dict(disclosures=len(result['disclosures']), rows=sum(len(row['rows']) for row in result['disclosures']), sourceGachaSha256=result['source']['gachaSha256'])))
