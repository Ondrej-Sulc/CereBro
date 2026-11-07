"""Synthetic scale tests; real calibration receipts are produced from captured evidence."""
import unittest
from calibrate_mcoc_crystal_odds import calibrate


def fixture():
    ui={'source':{'gachaSha256':'a'*64},'disclosures':[{'sourceCrystalId':'fixture','captureComplete':True,
        'observedAt':'2026-11-05T12:00:00+00:00','rows':[{'label':'Fixture outcome','displayedPercent':'25.00%',
        'percentValue':'25.00','decimalPlaces':2,'comparison':'displayed'}],'evidence':[]}]}
    api={'source':{'gachaSha256':'a'*64},'openings':{'fixture':{'status':'captured',
        'observedAt':'2026-11-05T15:00:00+00:00','responseSha256':'b'*64,
        'groups':[{'rows':[{'label':'Fixture outcome','percentValue':'25'}]}]}}}
    return ui,api


class ScaleCalibrationTests(unittest.TestCase):
    def test_compares_unscaled_raw_values_to_the_actual_display(self):
        result=calibrate(*fixture())
        self.assertTrue(result['allPassed'])
        self.assertEqual(result['apiValueScale'],'percentage-points')
        self.assertEqual(result['comparisons'][0]['apiPercentValue'],'25')

    def test_rejects_fractional_scale_wrong_snapshot_or_missing_rows(self):
        ui,api=fixture();api['openings']['fixture']['groups'][0]['rows'][0]['percentValue']='0.25'
        with self.assertRaises(ValueError):calibrate(ui,api)
        ui,api=fixture();api['source']['gachaSha256']='c'*64
        with self.assertRaises(ValueError):calibrate(ui,api)
        ui,api=fixture();api['openings']['fixture']['groups'][0]['rows']=[]
        with self.assertRaises(ValueError):calibrate(ui,api)


if __name__=='__main__':unittest.main()
