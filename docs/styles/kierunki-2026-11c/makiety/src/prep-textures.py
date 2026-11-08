import sys
from PIL import Image
Image.MAX_IMAGE_PIXELS=None
dl,out=sys.argv[1],sys.argv[2]
im=Image.open(dl+'/bm.jpg').convert('RGB'); im.save(out+'/day-5400.jpg',quality=92)
n=Image.open(dl+'/night.jpg'); n.draft('RGB',(6750,3375)); n=n.convert('RGB').resize((8192,4096),Image.LANCZOS); n.save(out+'/night-8192.jpg',quality=90)
c=Image.open(dl+'/C1.jpg'); c.draft('RGB',(10800,10800)); c=c.convert('RGB'); print(c.size)
s=c.size[0]/90.0
# lon 0..64E, lat 18..66N
box=(0,int((90-66)*s),int(64*s),int((90-18)*s)); d=c.crop(box).resize((6144,4608),Image.LANCZOS); d.save(out+'/day-detail.jpg',quality=92); print(d.size)
