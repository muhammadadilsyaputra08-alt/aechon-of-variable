import json,glob,sys
from PIL import Image
pal={v.lstrip('#').lower() for v in json.load(open('out/palette/archon_master.json'))['colors'].values()}
bad=0;n=0
for f in sorted(glob.glob('out/**/*.png',recursive=True)):
    if 'preview' in f or 'swatches' in f or 'app_icon_512' in f: continue
    im=Image.open(f).convert('RGBA'); n+=1
    off=set();semi=0
    for r,g,b,a in im.getdata():
        if a not in (0,255): semi+=1
        elif a==255 and '%02x%02x%02x'%(r,g,b) not in pal: off.add('%02x%02x%02x'%(r,g,b))
    if off or semi: bad+=1;print('FAIL',f,'off-palette:',sorted(off)[:4],'semi-alpha:',semi)
m=json.load(open('out/manifest.json'))
for k,v in m['sheets'].items():
    assert Image.open('out/'+v['file']).size==tuple(v['size']),k
print(f'{n} PNG diperiksa | palette-lock+alpha biner: {"LULUS" if not bad else "GAGAL "+str(bad)} | manifest ukuran: OK')
