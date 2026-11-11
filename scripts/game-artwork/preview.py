"""Compact self-contained review selector with actual embedded thumbnails."""
import argparse
import base64
from collections import defaultdict
import html
import io
import json
from pathlib import Path
import sqlite3

from PIL import Image, ImageDraw
from artwork import Store


def build(output, limit=96):
    c=sqlite3.connect(output/'catalog.sqlite');c.row_factory=sqlite3.Row
    groups=defaultdict(list)
    seen=set()
    for row in c.execute('''SELECT a.*,o.name,l.category,l.path,s.root,s.path source_path,b.path original
        FROM assets a JOIN objects o ON o.asset_id=a.id JOIN aliases l ON l.object_id=o.id
        JOIN sources s ON s.id=o.source_id JOIN blobs b ON b.sha256=a.blob_sha256
        WHERE s.status IN ('done','done-with-errors') ORDER BY a.id,o.id,l.path,l.evidence'''):
        if row['id'] in seen:continue
        seen.add(row['id'])
        groups[(row['kind'],row['category'])].append(dict(row))
    selected=[]
    while len(selected)<limit and any(groups.values()):
        for key in sorted(groups):
            if groups[key] and len(selected)<limit:selected.append(groups[key].pop(0))
    payload=[];sheet=Image.new('RGB',(8*160,((len(selected)+7)//8)*184),(33,35,43));draw=ImageDraw.Draw(sheet)
    for i,row in enumerate(selected):
        png=(output/row['preview']).read_bytes()
        payload.append({k:row[k] for k in ['id','kind','name','path','category','width','height','alpha_min','root','source_path','original']})
        payload[-1]['image']='data:image/png;base64,'+base64.b64encode(png).decode()
        with Image.open(io.BytesIO(png)) as thumb:
            x=(i%8)*160;y=(i//8)*184
            for dx in range(0,144,12):
                for dy in range(0,144,12):draw.rectangle((x+8+dx,y+8+dy,x+19+dx,y+19+dy),fill=(72,73,79) if ((dx+dy)//12)%2 else (53,54,60))
            sheet.paste(thumb,(x+8+(144-thumb.width)//2,y+8+(144-thumb.height)//2),thumb)
            draw.text((x+8,y+155),f'{i+1} {row["kind"]} {row["width"]}x{row["height"]}',fill=(235,235,240))
            draw.text((x+8,y+170),row['name'][:21].encode('ascii','replace').decode(),fill=(184,189,200))
    data=json.dumps(payload,ensure_ascii=True).replace('<','\\u003c')
    page='''<!doctype html><html><head><meta charset="utf-8"><title>Local artwork review</title>
    <style>:root{color-scheme:dark}body{font:13px var(--font-sans,system-ui);color:var(--foreground,#ddd);margin:0}
    input,select,button{font:inherit;padding:7px;background:var(--card,#252733);color:inherit;border:1px solid var(--border,#555);border-radius:6px}
    .controls{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}#grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px}
    article{border:1px solid var(--border,#555);border-radius:7px;padding:8px;overflow:hidden}article img{width:100%;height:112px;object-fit:scale-down;background:repeating-conic-gradient(#555 0% 25%,#333 0% 50%) 50%/14px 14px}
    .name{overflow-wrap:anywhere;margin:6px 0}.meta{color:var(--muted-foreground,#bbb);font-size:11px}details{font-size:10px;overflow-wrap:anywhere}
    #note{margin:8px 0 12px;color:var(--muted-foreground,#bbb)}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>
    <div class="controls"><input id="q" aria-label="Filter sample" placeholder="Filter sampled names / paths"><select id="kind" aria-label="Image kind"><option value="">All kinds</option><option>loose</option><option>texture</option><option>sprite</option></select><select id="cat" aria-label="Source category"><option value="">All source groups</option></select><button id="more">Show 24 more</button></div>
    <div id="note"></div><div id="grid"></div><script>const rows=DATA;let cap=24;
    const q=document.getElementById('q'),kind=document.getElementById('kind'),cat=document.getElementById('cat'),grid=document.getElementById('grid');
    for(const s of [...new Set(rows.map(x=>x.category))].sort()){const o=document.createElement('option');o.textContent=s;cat.append(o)}
    function render(){grid.replaceChildren();let r=rows.filter(x=>(!kind.value||x.kind===kind.value)&&(!cat.value||x.category===cat.value)&&[x.name,x.path,x.source_path,x.id,x.category].join(' ').toLowerCase().includes(q.value.toLowerCase()));
    document.getElementById('note').textContent=`${r.length} of ${rows.length} representative samples · thumbnails only · complete search is in SQLite · groups come from source paths`;
    for(const x of r.slice(0,cap)){const a=document.createElement('article'),im=document.createElement('img');im.src=x.image;im.alt=x.name;a.append(im);const n=document.createElement('div');n.className='name';n.textContent=x.name;a.append(n);const m=document.createElement('div');m.className='meta';m.textContent=`${x.kind} · ${x.width} × ${x.height} · ${x.category} · alpha min ${x.alpha_min}`;a.append(m);const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('pre');s.textContent='Source and content ID';p.textContent=JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k])=>k!=='image')),null,2);d.append(s,p);a.append(d);grid.append(a)}}
    for(const el of[q,kind,cat])el.addEventListener('input',()=>{cap=24;render()});document.getElementById('more').onclick=()=>{cap+=24;render()};render();</script></body></html>'''.replace('DATA',data)
    store=Store(output);store.write('preview.html',page.encode())
    buf=io.BytesIO();sheet.save(buf,format='PNG');store.write('contact-sheet.png',buf.getvalue())
    store.json('preview-selection.json',[{k:v for k,v in x.items() if k!='image'} for x in payload]);c.close()
    print(json.dumps({'samples':len(payload),'preview':'preview.html','sheet':'contact-sheet.png'}))


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--output',type=Path,required=True);p.add_argument('--limit',type=int,default=96)
    args=p.parse_args();build(args.output,min(args.limit,192))
