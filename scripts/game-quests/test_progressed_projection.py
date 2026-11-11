import json
import tempfile
import unittest
from pathlib import Path
from build_progressed import validate_sources

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'temp/quest-explorer-review/progressed-20261109'

class ProgressedSourceTests(unittest.TestCase):
    def test_finite_capture_ledger_covers_every_new_map_once(self):
        ledger=validate_sources(SOURCE)
        self.assertEqual(152,sum(n.startswith('maps/') for n in ledger['files']))
        ids={Path(n).stem for n in ledger['files'] if n.startswith('maps/')}
        targets=set(json.loads((SOURCE/'targets.json').read_text(encoding='utf-8'))['questIds'])
        missing=targets-ids
        self.assertEqual(16,len(missing))
        summaries=json.loads((SOURCE/'initial-catalog.json').read_text(encoding='utf-8'))
        quests={q['qid']:q for s in summaries['pveSets'] for q in s['QuestSummarys'].values()}
        self.assertTrue(all(quests[q]['actIndex']==10 and quests[q]['category']['name']=='Story' for q in missing))

    def test_ledger_rejects_changed_captured_bytes_before_projection(self):
        with tempfile.TemporaryDirectory(dir=ROOT/'temp') as td:
            p=Path(td);(p/'capture-manifest.json').write_text(json.dumps({'files':{'source.json':'0'*64}}))
            (p/'source.json').write_text('{}')
            with self.assertRaisesRegex(ValueError,'source drift'):validate_sources(p)

if __name__=='__main__':unittest.main()
