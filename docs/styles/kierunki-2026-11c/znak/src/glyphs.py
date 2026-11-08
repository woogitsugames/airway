import json,sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
F='/workspace/71a/docs/styles/kierunki-2026-11c/makiety/ui-a/fonts/Archivo-VF.ttf'
out={}
for wd in (78,82,100):
    f=TTFont(F); f=instantiateVariableFont(f,{'wght':800,'wdth':wd})
    gs=f.getGlyphSet(); cm=f.getBestCmap(); upm=f['head'].unitsPerEm
    for ch in "AWIR→":
        g=cm.get(ord(ch))
        if not g: continue
        p=SVGPathPen(gs); gs[g].draw(p)
        out[f"{wd}_{ch}"]={'d':p.getCommands(),'adv':gs[g].width,'upm':upm}
    os2=f['OS/2']; out[f'{wd}_cap']=os2.sCapHeight
json.dump(out,open('glyphs.json','w'))
print({k:(v['adv'] if isinstance(v,dict) else v) for k,v in out.items()})
