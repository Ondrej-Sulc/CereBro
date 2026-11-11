"""Offline DIFF / DRY-RUN for versioned node indexes. No apply or DB access."""
import argparse
import copy
import json
from pathlib import Path

from extract_mcoc_node_modifiers import reconciliation_plan


def records(index):
    if index.get('contract') != 'cerebro.node-modifier-index/v2':
        raise ValueError('Expected a versioned node index')
    result = {row['id']: row for row in index['records']}
    if len(result) != len(index['records']):
        raise ValueError('Duplicate exact Buff ID')
    return result


def diff(before, after):
    old, new = records(before), records(after)
    return dict(added=sorted(new.keys()-old.keys()), removed=sorted(old.keys()-new.keys()),
        changed=sorted(key for key in old.keys() & new.keys() if old[key]['detailSha256'] != new[key]['detailSha256']),
        provenanceChanged=before['profileHash'] != after['profileHash'], writes=[])


def dry_run(index, curated, bindings):
    source = records(index)
    # Adapt only the exact identity/version contract. The existing reconciliation
    # preserves every exported curated field and proposes zero writes.
    catalog = dict(definitions=[dict(id=key, versions=[dict(hash=value) for value in row['versionHashes']]) for key, row in source.items()])
    return reconciliation_plan(catalog, copy.deepcopy(curated), bindings)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='mode', required=True)
    for mode, names in [('diff', ['before', 'after']), ('dry-run', ['index', 'curated', 'bindings'])]:
        command = sub.add_parser(mode)
        for name in names + ['out']:
            command.add_argument('--'+name, type=Path, required=True)
    args = parser.parse_args()
    inputs = [value for key, value in vars(args).items() if key not in ('mode', 'out')]
    if args.out.resolve() in [path.resolve() for path in inputs]:
        raise ValueError('Output must not overwrite an input')
    load = lambda path: json.loads(path.read_text(encoding='utf-8-sig'))
    result = diff(load(args.before), load(args.after)) if args.mode == 'diff' else dry_run(load(args.index), load(args.curated), load(args.bindings))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2)+'\n', encoding='utf-8')


if __name__ == '__main__':
    main()
