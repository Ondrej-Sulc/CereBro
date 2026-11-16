"""Portable real-source formatter, binding and reproduction regressions."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from build_act10_modifiers import build,read,clean,render_definition,REPO,FIXTURES


class Act10ModifierTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.capture=read(FIXTURES/'act10-modifiers-capture.json')
        cls.proof=read(FIXTURES/'act10-modifier-format.json')
        cls.raw={r['id']:r['raw'] for r in cls.capture['definitions']}

    def render(self,id,proof=None):
        p=proof or self.proof
        return render_definition(self.raw[id],p['components'],p['appearances'],p['formulas'],1)[1]

    def test_all_149_descriptions_and_73_independent_native_comparisons(self):
        for id in self.raw:
            text=self.render(id)
            self.assertTrue(text.strip(),id);self.assertNotRegex(text,r'\{[^}]*\}')
        self.assertEqual(len(self.proof['nativeComparisonCases']),73)
        for sample in self.proof['nativeComparisonCases']:
            self.assertEqual(self.render(sample['id']),clean(sample['description']),sample['id'])

    def test_real_template_duration_percentage_and_stackable_arguments(self):
        self.assertIn('disables it for 20 seconds',self.render('pve_braceimpact_sp_1'))
        self.assertIn('200% Daunted',self.render('pve_daunted_pwrshld_2'))
        self.assertIn('Critical Damage Rating by 20%',self.render('pve_arrow_knee_3'))
        self.assertIn('Placebo Buff for 5 seconds',self.render('pve_prsnspc_plac'))
        self.assertEqual(self.render('avx_hp_pct1000'),'+1000% Health')

    def test_missing_or_changed_component_appearance_and_formula_fail(self):
        id='aq_special_interference';first=self.raw[id]['valueStr'][0]
        for mode in ['component','appearance','formula','identity']:
            p=copy.deepcopy(self.proof)
            if mode=='component':del p['components'][first]
            if mode=='appearance':p['components'][first]['AppearanceID']='missing'
            if mode=='formula':p['formulas']['var_x_a']['reqAttrData']=True
            if mode=='identity':p['components'][first]['ID']='another-component'
            with self.subTest(mode=mode),self.assertRaises(ValueError):self.render(id,p)

    def test_unsupported_templates_and_unobserved_quantities_fail(self):
        raw=copy.deepcopy(self.raw['ava_limber10'])
        for template in ['{99}','{1:N2}']:
            raw['localizedDesc']=template
            with self.assertRaises(ValueError):render_definition(raw,self.proof['components'],self.proof['appearances'],self.proof['formulas'],1)
        for quantity in [0,2]:
            with self.assertRaises(ValueError):render_definition(raw,self.proof['components'],self.proof['appearances'],self.proof['formulas'],quantity)

    def test_output_reproduces_and_original_maps_stay_unmodified(self):
        expected=read(REPO/'src/data/game-quests/act10-modifiers.json')
        actual=build();self.assertEqual(actual,expected)
        self.assertEqual((actual['definitionCount'],actual['applicationCount'],actual['verifiedIcons']),(149,271,208))
        self.assertEqual(len(actual['maps']),16)

    def test_capture_pin_rejects_changed_or_unapproved_source_before_build(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'capture.json';path.write_text(json.dumps(self.capture)+'\n',encoding='utf-8')
            with self.assertRaisesRegex(ValueError,'input drift'):build(capture_path=path)


if __name__=='__main__':unittest.main()
