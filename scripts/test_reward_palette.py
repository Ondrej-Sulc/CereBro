import io
import struct
import unittest
from PIL import Image
from extract_mcoc_reward_palette import parse_color_dictionary
from extract_mcoc_reward_artwork import resolve_material_tint, tint_image


def unity_string(value):
    raw=value.encode(); result=struct.pack('<I',len(raw))+raw
    return result+b'\0'*((-len(result))%4)


class RewardPaletteTests(unittest.TestCase):
    def test_reads_complete_serialized_color_dictionary_and_rejects_trailing_or_conflicting_data(self):
        payload=struct.pack('<I',1)+struct.pack('<i',7)+unity_string('relic')+struct.pack('<28f',*([1.0]*28))
        definitions=[('class_cosmic',(0.0,0.6,0.8,1.0)),('class_iso_generic',(0.4,0.4,0.5,1.0))]
        payload+=struct.pack('<I',len(definitions))+b''.join(unity_string(key)+struct.pack('<4f',*rgba) for key,rgba in definitions)
        colors=parse_color_dictionary(payload)
        self.assertAlmostEqual(colors['class_cosmic'][1],0.6)
        with self.assertRaises(ValueError): parse_color_dictionary(payload+b'\0')
        with self.assertRaises(ValueError): parse_color_dictionary(payload[:-4])

    def test_renderer_uses_class_colors_explicit_tints_and_generic_enhancement_color(self):
        colors={'class_cosmic':[0,0.6,0.8,1], 'class_iso_generic':[0.4,0.4,0.5,1]}
        self.assertEqual(resolve_material_tint({'_evoType':'blueprint','_class':'cosmic'},colors)['key'],'class_cosmic')
        self.assertEqual(resolve_material_tint({'_evoType':'evolve','_class':'cosmic','_tintColor':'23c5ff'},colors)['source'],'blueprint')
        self.assertEqual(resolve_material_tint({'_evoType':'enhance','_class':'cosmic','_tintColor':'ffffff'},colors)['key'],'class_iso_generic')
        with self.assertRaises(ValueError): resolve_material_tint({'_evoType':'evolve','_class':'unreviewed'},colors)
        with self.assertRaises(ValueError): resolve_material_tint({'_evoType':'new_kind','_class':'cosmic'},colors)

    def test_texture_multiply_preserves_shape_and_applies_alpha_without_css_filters(self):
        image=Image.new('RGBA',(2,1)); image.putdata([(255,200,100,128),(100,100,100,0)])
        payload=io.BytesIO(); image.save(payload,format='PNG')
        tinted=Image.open(io.BytesIO(tint_image(payload.getvalue(),[1,0.5,0.25,1]))).convert('RGBA')
        self.assertEqual(tinted.getpixel((0,0)),(255,100,25,128))
        self.assertEqual(tinted.getpixel((1,0))[3],0)

    def test_inventory_overlay_matches_shader_dark_and_light_branches_and_alpha(self):
        image=Image.new('RGBA',(3,1)); image.putdata([(64,128,192,128),(0,255,100,0),(127,129,255,255)])
        payload=io.BytesIO();image.save(payload,format='PNG')
        tinted=Image.open(io.BytesIO(tint_image(payload.getvalue(),[1,0.5,0.25,0.5],'overlay'))).convert('RGBA')
        self.assertEqual(list(tinted.getdata()),[(128,128,161,64),(0,255,50,0),(254,129,255,128)])
        with self.assertRaises(ValueError):tint_image(payload.getvalue(),[1,1,1,1],'unknown')


if __name__=='__main__':unittest.main()
