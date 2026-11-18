import copy,unittest
from swap_projection import public_response,swap,Stop
EXPECTED={'definitionSetId':'set','mapId':'q','sourceHash':'a'*64,'publicMapSha256':'b'*64,'nativeMapHash':'h','coordinates':[[0,0]],'edges':[],'portals':[]}
TARGET={'setId':'set'}
def packet():return {'result':{'data':{'qid':'q','mapId':'q','setId':'set'},'map':{'hash':'h','gridDimension':1,'grid':[[{'x':0,'y':0,'walkable':True,'choice':True,'choices':[{'choiceId':'teamswap','swapCount':1,'minSwaps':0,'swappedBids':['PRIVATE'],'disabled':True}], 'userData':'PRIVATE'}]]},'progression':'PRIVATE'}}
class Tests(unittest.TestCase):
 def test_selects_only_public_choice_fields(self):
  p=packet();before=copy.deepcopy(p);out=public_response(p,'q',200,EXPECTED,TARGET)
  self.assertNotIn('PRIVATE',str(out));self.assertEqual(p,before);self.assertEqual(out['choices'][0]['swaps'][0]['swapCount'],1)
 def test_absent_counts_only_native_defaults(self):
  s=swap({'choiceId':'swapteamselect'});self.assertEqual(s['swapCount'],1);self.assertEqual(len(s['nativeDefaultsApplied']),2)
 def test_malformed_present_counts_rejected(self):
  for value in [None,True,'1',1.2,-1]:
   with self.assertRaises(Stop):swap({'choiceId':'teamswap','swapCount':value})
 def test_wrong_geometry_and_identity_rejected(self):
  for change in ['identity','geometry','hash']:
   p=packet()
   if change=='identity':p['result']['data']['qid']='other'
   elif change=='hash':p['result']['map']['hash']='other'
   else:p['result']['map']['grid'][0][0]['links']=[{'x':0,'y':0}]
   with self.assertRaises(Stop):public_response(p,'q',200,EXPECTED,TARGET)
 def test_generic_choices_are_never_swaps(self):
  p=packet();p['result']['map']['grid'][0][0]['choices']=[{'choiceId':'reward'}]
  self.assertEqual(public_response(p,'q',200,EXPECTED,TARGET)['choices'][0]['swaps'],[])
 def test_portal_link_duplication_does_not_change_graph(self):
  p=packet();p['result']['map']['grid'][0][0]['links']=[{'x':0,'y':0}];p['result']['map']['grid'][0][0]['pt']=[{'x':0,'y':0}];expected=dict(EXPECTED,portals=[[0,0,0,0]])
  self.assertEqual(public_response(p,'q',200,expected,TARGET)['questId'],'q')
 def test_padding_and_numeric_string_portal_coordinates_are_public_geometry(self):
  p=packet();p['result']['map']['grid'].append([]);p['result']['map']['grid'][0][0]['x']='0';self.assertEqual(public_response(p,'q',200,EXPECTED,TARGET)['questId'],'q')
 def test_http_error_and_unknown_target_stop(self):
  with self.assertRaises(Stop):public_response(packet(),'q',403,EXPECTED,TARGET)

if __name__=='__main__':unittest.main()
