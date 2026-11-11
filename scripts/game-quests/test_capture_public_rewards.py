"""Offline public-reader scope/lease checks; these tests never inspect a process."""
import datetime
import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import capture_public_rewards as reader


class PublicRewardsPreflightTests(unittest.TestCase):
 def setUp(self):
  self.directory=TemporaryDirectory();self.addCleanup(self.directory.cleanup)
  self.root=Path(self.directory.name);(self.root/'temp').mkdir()
  self.path=self.root/'temp'/'lease.json'
  self.now=datetime.datetime(2026,11,9,19,tzinfo=datetime.timezone.utc)
  self.lease={'format':'cerebro.quest-public-rewards-lease.v1','owner':reader.OWNER,'grantedByRoot':True,'userReadyConfirmed':True,'readinessEvidence':'Actual user says ready at Special selection','processId':123,'readerSha256':reader.sha(Path(reader.__file__)),'scopeSha256':reader.scope_hash(),'supportPins':reader.PINS,'allowedSetIds':sorted(reader.NEW_SETS),'grantedAt':self.now.isoformat(),'expiresAt':(self.now+datetime.timedelta(minutes=15)).isoformat()}
  self.root_patch=patch.object(reader,'REPO',self.root);self.root_patch.start();self.addCleanup(self.root_patch.stop)

 def save(self):self.path.write_text(json.dumps(self.lease),encoding='utf-8')

 def test_scope_contains_only_public_parent_rewards_and_identity(self):
  self.assertEqual(len(reader.NEW_SETS),10)
  self.assertEqual(set(reader.ALLOW),{'QuestSet','Act','Chapter','QuestSummary','EB.Sparx.RedeemerItem'})
  self.assertEqual(reader.ALLOW['QuestSummary'],{'qid','setId','mapId'})
  self.assertEqual(reader.ALLOW['EB.Sparx.RedeemerItem'],{'Type','Data','Quantity','MinQuantity','MaxQuantity','Action','Header','Footer'})
  self.assertFalse(set().union(*reader.ALLOW.values())&{'QuestMaps','bosses','completed','mastered','player','account','inventory','teams','progression'})

 def test_exact_live_lease_is_accepted_without_process_access(self):
  self.save();self.assertEqual(reader.validate_lease(self.path,123,self.now),self.lease)

 def test_ungranted_or_unconfirmed_lease_fails(self):
  for field in ['grantedByRoot','userReadyConfirmed']:
   with self.subTest(field=field):
    self.lease[field]=False;self.save()
    with self.assertRaises(ValueError):reader.validate_lease(self.path,123,self.now)
    self.lease[field]=True
  self.lease['readinessEvidence']='';self.save()
  with self.assertRaises(ValueError):reader.validate_lease(self.path,123,self.now)

 def test_process_scope_reader_or_pins_drift_fails(self):
  mutations={'processId':456,'readerSha256':'changed','scopeSha256':'changed','supportPins':{},'allowedSetIds':[]}
  for field,value in mutations.items():
   with self.subTest(field=field):
    original=self.lease[field];self.lease[field]=value;self.save()
    with self.assertRaises(ValueError):reader.validate_lease(self.path,123,self.now)
    self.lease[field]=original

 def test_stale_future_unbounded_or_naive_lease_fails(self):
  for start,end in [(self.now-datetime.timedelta(hours=1),self.now),(self.now+datetime.timedelta(seconds=1),self.now+datetime.timedelta(minutes=10)),(self.now,self.now+datetime.timedelta(minutes=31)),(self.now.replace(tzinfo=None),self.now.replace(tzinfo=None)+datetime.timedelta(minutes=10))]:
   with self.subTest(start=start,end=end):
    self.lease['grantedAt']=start.isoformat();self.lease['expiresAt']=end.isoformat();self.save()
    with self.assertRaises(ValueError):reader.validate_lease(self.path,123,self.now)

 def test_lease_outside_ignored_temp_fails(self):
  outside=self.root/'lease.json';outside.write_text(json.dumps(self.lease),encoding='utf-8')
  with self.assertRaises(ValueError):reader.validate_lease(outside,123,self.now)


if __name__=='__main__':unittest.main()
