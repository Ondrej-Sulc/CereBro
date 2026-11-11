"""Portable fixtures: no game install/cache/network required."""
from contextlib import redirect_stdout
import io
import json
from pathlib import Path
import shutil
import struct
from types import SimpleNamespace as NS
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image
import artwork as a
from catalog import Catalog


class ExtractionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.base = Path(self.tmp.name)
        self.src = self.base / 'assets'; self.src.mkdir()
        self.out = self.base / 'library'
        self.args = NS(root=['fixture=' + str(self.src)], output=self.out, reserve_gib=20, limit=0)

    def tearDown(self):
        self.tmp.cleanup()

    def run_command(self, fn):
        with patch('artwork.shutil.disk_usage', return_value=NS(free=100*a.GIB)), redirect_stdout(io.StringIO()):
            fn(self.args)

    def image(self, name, fmt='PNG'):
        image = Image.new('RGBA', (7, 5), (17, 93, 201, 80))
        image.putpixel((2, 3), (255, 0, 7, 0))
        image.save(self.src / name, format=fmt, lossless=True, exact=True)

    def test_pixel_dedup_keeps_encodings_aliases_and_transparency(self):
        self.image('one.png'); shutil.copyfile(self.src/'one.png', self.src/'two.png')
        self.image('three.webp', 'WEBP')
        self.run_command(a.inventory); self.run_command(a.extract)
        c = Catalog(self.out/'catalog.sqlite')
        self.assertEqual(c.db.execute('select count(*) from objects').fetchone()[0], 3)
        self.assertEqual(c.db.execute('select count(*) from assets').fetchone()[0], 1)
        self.assertEqual(c.db.execute('select count(*) from blobs').fetchone()[0], 2)
        self.assertEqual(len(c.search('one')), 1)
        asset = c.asset(c.search('one')[0]['id'])
        self.assertEqual((asset['width'],asset['height'],asset['alpha_min'],asset['alpha_max']), (7,5,0,80))
        self.assertEqual(len(asset['objects']), 3)
        for obj in asset['objects']:
            self.assertEqual(len(obj['provenance']['originalBlobSha256']), 64)
        c.close()

    def test_resume_stable_ids_and_changed_source_replaced(self):
        self.image('one.png'); self.image('two.png')
        self.run_command(a.inventory); self.args.limit=1; self.run_command(a.extract)
        self.args.limit=0; self.run_command(a.extract)
        c=Catalog(self.out/'catalog.sqlite'); before=[tuple(r) for r in c.db.execute('select id,raw_sha256 from objects order by id')]; c.close()
        self.run_command(a.inventory); self.run_command(a.extract)
        c=Catalog(self.out/'catalog.sqlite'); self.assertEqual(before,[tuple(r) for r in c.db.execute('select id,raw_sha256 from objects order by id')]); c.close()
        Image.new('RGBA',(2,3),(0,0,0,0)).save(self.src/'one.png')
        self.run_command(a.inventory); self.run_command(a.extract)
        c=Catalog(self.out/'catalog.sqlite'); self.assertEqual(c.search('one')[0]['width'],2);self.assertEqual(c.db.execute('select count(*) from aliases').fetchone()[0],2);c.close()

    def test_bad_source_does_not_stop_run_and_no_secrets_parsed(self):
        (self.src/'bad.png').write_bytes(b'not an image'); self.image('valid.png')
        (self.src/'config').mkdir(); (self.src/'config'/'private.png').write_bytes(b'private')
        (self.src/'ignored.json').write_bytes(b'not even parsed')
        self.run_command(a.inventory); self.run_command(a.extract)
        c=Catalog(self.out/'catalog.sqlite')
        self.assertEqual(len(c.search('valid')),1)
        self.assertEqual(c.db.execute("select count(*) from sources where status='done-with-errors'").fetchone()[0],1)
        self.assertEqual(c.db.execute("select count(*) from objects where status='error' and asset_id is null").fetchone()[0],1)
        self.assertEqual(c.db.execute("select count(*) from sources where path like '%private%'").fetchone()[0],0)
        c.close()

    def test_storage_stop_has_exact_remaining_and_resumes(self):
        self.image('one.png'); self.run_command(a.inventory)
        # Pass DB open then reject per-source guard. Checkpoint still has room.
        free=iter([100*a.GIB,100*a.GIB,20*a.GIB+32*1024**2]+[20*a.GIB+32*1024**2]*10)
        with patch('artwork.shutil.disk_usage',side_effect=lambda _: NS(free=next(free))),redirect_stdout(io.StringIO()):
            a.extract(self.args)
        checkpoint=json.loads((self.out/'checkpoint.json').read_text())
        self.assertEqual(checkpoint['state'],'storage-reserve'); self.assertEqual(len(checkpoint['remaining']),1)
        self.run_command(a.extract)
        self.assertEqual(json.loads((self.out/'checkpoint.json').read_text())['remaining'],[])

    def test_toc_exact_join_missing_and_no_basename_guess(self):
        pack=self.src/'Resources'/'Data'/'portraits'; pack.mkdir(parents=True)
        self.image('native.png'); shutil.move(self.src/'native.png',pack/'native.png')
        (pack/'toc.txt').write_text(json.dumps({'pack':'portraits','files':['native.png','missing.png'],
            'bundles':{'other':{'paths':{'same-basename':'Assets/elsewhere/native.png'}}}}))
        self.run_command(a.inventory); self.run_command(a.extract)
        c=Catalog(self.out/'catalog.sqlite')
        statuses=Counter(r[0] for r in c.db.execute('select status from references_catalog'))
        self.assertEqual(statuses['resolved'],1);self.assertEqual(statuses['missing-local-image-or-container-path'],2)
        self.assertEqual(len(c.search('portraits')),2);c.close()
        (pack/'toc.txt').write_text(json.dumps({'pack':'renamed','files':['native.png']}))
        self.run_command(a.inventory);self.run_command(a.extract)
        c=Catalog(self.out/'catalog.sqlite')
        self.assertEqual(len(c.search('renamed')),1)
        self.assertEqual(c.db.execute("SELECT count(*) FROM aliases WHERE evidence LIKE 'toc:%'").fetchone()[0],1);c.close()

    def test_texture_sprite_are_distinct_with_shared_blob(self):
        with patch('artwork.shutil.disk_usage',return_value=NS(free=100*a.GIB)):
            store=a.Store(self.out);db=a.connect(store);im=Image.new('RGBA',(4,4),(1,2,3,0))
            texture=a.emit_image(db,store,im,'texture');sprite=a.emit_image(db,store,im,'sprite');db.commit()
            self.assertNotEqual(texture,sprite)
            self.assertEqual(db.execute('select count(*) from blobs').fetchone()[0],1);db.close()

    def test_real_pptr_container_target_api(self):
        import UnityPy
        from UnityPy.classes.PPtr import PPtr
        # Use the installed pointer type: its origin is assetsfile, while the
        # dereferenced reader owns assets_file. External targets use deref().
        source=NS(name='fixture-cab',objects={})
        texture=NS(m_Name='test_texture',m_TextureFormat=4,m_Width=3,m_Height=2,m_MipCount=1,
                   m_ImageCount=1,m_TextureDimension=2,m_ColorSpace=0,m_StreamData=None,
                   get_image_data=lambda:b'encoded',image=Image.new('RGBA',(3,2),(1,2,3,4)))
        obj=NS(type=NS(name='Texture2D'),assets_file=source,path_id=9,peek_name=lambda:'test_texture',
               get_raw_data=lambda:b'raw-object',read=lambda:texture)
        obj2=NS(type=obj.type,assets_file=source,path_id=10,peek_name=obj.peek_name,get_raw_data=obj.get_raw_data,read=obj.read)
        source.objects.update({9:obj,10:obj2})
        ptr=PPtr(m_FileID=0,m_PathID=9,assetsfile=source)
        ptr2=PPtr(m_FileID=0,m_PathID=10,assetsfile=source)
        bundle=NS(type=NS(name='AssetBundle'),read=lambda:NS(m_Container=[('assets/ui/test_texture.png',NS(asset=ptr)),('assets/ui/test_texture.png',NS(asset=ptr2))]))
        env=NS(container={'assets/ui/test_texture.png':ptr2},objects=[obj,obj2,bundle])
        with patch('artwork.shutil.disk_usage',return_value=NS(free=100*a.GIB)),patch.object(UnityPy,'load',return_value=env):
            s=a.Store(self.out);db=a.connect(s);sid='fixture'
            path=self.src/'test.bundle';path.write_bytes(b'raw');stat=path.stat()
            db.execute('INSERT INTO sources(id,root,path,classification,bytes,mtime_ns) VALUES(?,?,?,?,?,?)',(sid,'fixture','test.bundle','unity',stat.st_size,stat.st_mtime_ns))
            row=db.execute('SELECT * FROM sources').fetchone();a.unity(db,s,row,self.src/'test.bundle');db.commit()
            self.assertEqual(db.execute("SELECT status FROM objects").fetchone()[0],'done')
            self.assertEqual(db.execute("SELECT count(*) FROM aliases WHERE evidence='unity-container'").fetchone()[0],2)
            db.execute("UPDATE sources SET status='done',sha256=?",(a.file_hash(path),));db.commit()
            db.close()
            with redirect_stdout(io.StringIO()):a.reconcile_aliases(self.args)
        c=Catalog(self.out/'catalog.sqlite')
        self.assertEqual(c.db.execute("SELECT count(*) FROM aliases WHERE evidence LIKE 'unity-container-source:%'").fetchone()[0],2);c.close()

    def test_audit_detects_modified_bytes_and_preview_is_self_contained(self):
        from verify import audit
        from preview import build
        self.image('icon.png');self.run_command(a.inventory);self.run_command(a.extract)
        with redirect_stdout(io.StringIO()),patch('artwork.shutil.disk_usage',return_value=NS(free=100*a.GIB)):
            result=audit(self.out,{'fixture':self.src},0);build(self.out,8)
        self.assertTrue(result['ok'])
        page=(self.out/'preview.html').read_text(encoding='utf8')
        self.assertIn('data:image/png;base64,',page);self.assertNotIn('file://',page);self.assertNotIn(str(self.src),page)
        c=Catalog(self.out/'catalog.sqlite');blob=c.db.execute('SELECT path FROM blobs LIMIT 1').fetchone()[0];c.close()
        (self.out/blob).write_bytes(b'changed')
        with redirect_stdout(io.StringIO()):result=audit(self.out,{'fixture':self.src},0)
        self.assertFalse(result['ok']);self.assertTrue(any(s.startswith('blob:') for s in result['failures']))

    def test_bundle_header_index_without_unpacking_asset_blocks(self):
        names=['CAB-0123456789abcdef','CAB-0123456789abcdef.resS']
        directory=b'\0'*16+struct.pack('>II',0,len(names))
        for name in names:directory+=struct.pack('>QQI',0,123,0)+name.encode()+b'\0'
        header=b'UnityFS\0'+struct.pack('>I',8)+b'6.x.x\0'+b'6000.3.10f1\0'+struct.pack('>QIII',999,len(directory),len(directory),64)
        header+=b'\0'*((-len(header))%16)
        path=self.src/'test.bundle';path.write_bytes(header+directory)
        result=a.bundle_directory(path)
        self.assertEqual(result['names'],names);self.assertEqual(result['directorySha256'],a.digest(directory))
        self.run_command(a.inventory)
        with patch('artwork.shutil.disk_usage',return_value=NS(free=100*a.GIB)):
            db=a.connect(a.Store(self.out));index=a.cabinet_index(db,{'fixture':self.src});db.close()
        self.assertEqual(index[names[0].lower()][0]['path'],'test.bundle')


class SpriteContractTests(unittest.TestCase):
    def test_native_rect_and_all_packing_rotations(self):
        from UnityPy.export import SpriteHelper as helper
        image=Image.new('RGBA',(6,5))
        for y in range(5):
            for x in range(6):image.putpixel((x,y),(x*30,y*40,7,x*20+y))
        transforms=[None,Image.Transpose.FLIP_LEFT_RIGHT,Image.Transpose.FLIP_TOP_BOTTOM,Image.Transpose.ROTATE_180,Image.Transpose.ROTATE_270]
        for rotation,transform in enumerate(transforms):
            data=NS(texture=object(),alphaTexture=None,textureRect=NS(x=1,y=1,width=3,height=2),settingsRaw=3+(rotation<<2))
            sprite=NS(m_SpriteAtlas=None,m_AtlasTags=[],m_RD=data)
            with patch.object(helper,'get_image',return_value=image):
                result=helper.get_image_from_sprite(sprite)
            expected=image.crop((1,1,4,3))
            if transform is not None:expected=expected.transpose(transform)
            expected=expected.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
            self.assertEqual(result.tobytes(),expected.tobytes())
            self.assertEqual(result.size,expected.size)

    def test_split_alpha_uses_red_channel_without_resizing(self):
        from UnityPy.export import SpriteHelper as helper
        sprite=NS(assets_file=NS(_cache={}))
        color=NS(path_id=1,deref_parse_as_object=lambda:'color')
        alpha=NS(path_id=2,deref_parse_as_object=lambda:'alpha')
        images={'color':Image.new('RGB',(3,2),(2,3,4)),'alpha':Image.new('RGB',(3,2),(67,5,6))}
        with patch.object(helper,'get_image_from_texture2d',side_effect=lambda t,flip:images[t]):
            result=helper.get_image(sprite,color,alpha)
        self.assertEqual(result.size,(3,2));self.assertEqual(result.getpixel((0,0)),(2,3,4,67))


from collections import Counter
if __name__=='__main__':
    unittest.main()
