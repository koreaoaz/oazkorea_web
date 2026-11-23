"""Bounded, offline review of feed exports. Never extract private account categories.
The result is private review evidence, not publication approval.
"""
import argparse,collections,hashlib,io,json,re,shutil,stat,unicodedata,zipfile
from datetime import datetime,timezone,timedelta
from pathlib import Path,PurePosixPath

def decode_text(value):
 if not isinstance(value,str):return ''
 try:return value.encode('latin1').decode('utf-8')
 except UnicodeError:return value

def labels(row):return {decode_text(x.get('label','')):x for x in row.get('label_values',[]) if 'label' in x}
def media_paths(row):
 result=[]
 def visit(value):
  if isinstance(value,dict):
   if isinstance(value.get('uri'),str):result.append(value['uri'])
   for k,v in value.items():
    if k in ('media','dict','label_values'):visit(v)
  elif isinstance(value,list):
   for item in value:visit(item)
 visit(row);return list(dict.fromkeys(result))

def check_entries(infos):
 keys=set();total=0
 for item in infos:
  # ZipInfo normalizes Windows separators and truncates NUL in filename.
  # Validate the original central-directory name before trusting normalization.
  name=item.orig_filename;path=PurePosixPath(name);key=unicodedata.normalize('NFC',name).casefold()
  if '\\' in name or ':' in name or path.is_absolute() or any(x in ('','..','.') for x in name.split('/')) or any(ord(c)<32 for c in name) or key in keys:raise ValueError('UNSAFE_OR_DUPLICATE_ZIP_PATH')
  if stat.S_ISLNK(item.external_attr>>16) or item.flag_bits&1:raise ValueError('LINK_OR_ENCRYPTED_ZIP_ENTRY')
  if item.file_size>32*1024**2 or item.file_size/max(item.compress_size,1)>200:raise ValueError('ZIP_ENTRY_LIMIT')
  keys.add(key);total+=item.file_size
 if total>256*1024**2 or len(infos)>10000:raise ValueError('ZIP_TOTAL_LIMIT')
 return total

def review(path):
 with zipfile.ZipFile(path) as z:
  infos=z.infolist();total=check_entries(infos);names={x.filename for x in infos}
  feeds=json.loads(z.read('your_instagram_activity/media/posts_1.json'))
  rich=json.loads(z.read('your_instagram_activity/media/posts.json'))
  result=[];used=set()
  for index,row in enumerate(feeds):
   media=row.get('media',[]);uris=[m['uri'] for m in media]
   assert uris and all(p.startswith('media/posts/') and p in names for p in uris),'FEED_MEDIA_MISSING'
   matches=[(i,x) for i,x in enumerate(rich) if set(uris).issubset(set(media_paths(x)))]
   caption=decode_text(row.get('title','') or media[0].get('title',''))
   timestamp=row.get('creation_timestamp') or media[0].get('creation_timestamp')
   item={'feedIndex':index,'sourceId':None,'sourceUrl':None,'metadataPath':'your_instagram_activity/media/posts_1.json','caption':caption,'captionSha256':hashlib.sha256(caption.encode()).hexdigest(),'timestamp':timestamp,'timestampBasis':'feed.creation_timestamp' if row.get('creation_timestamp') else 'feed.media[0].creation_timestamp','media':[],'issues':[]}
   if len(matches)==1:
    ri,root=matches[0];used.add(ri);ls=labels(root)
    item.update(sourceId=root['fbid'],richMetadataIndex=ri,richTimestamp=root.get('timestamp'))
    if decode_text(ls.get('게시됨',{}).get('value',''))!='참':item['issues'].append('NOT_PUBLISHED')
    if decode_text(ls.get('임시 저장본',{}).get('value',''))=='참':item['issues'].append('DRAFT')
    if abs(int(root['timestamp'])-int(timestamp))>5:item['issues'].append('TIMESTAMP_CONFLICT')
    rich_caption=decode_text(ls.get('캡션',{}).get('value',''))
    if rich_caption and rich_caption!=caption:item['issues'].append('CAPTION_CONFLICT')
   else:item['issues'].append('SOURCE_ID_AMBIGUOUS')
   if not isinstance(timestamp,int) or not 946684800<timestamp<4102444800:item['issues'].append('INVALID_TIMESTAMP')
   else:item['publishedAt']=datetime.fromtimestamp(timestamp,timezone.utc).isoformat();item['publishedAtKST']=datetime.fromtimestamp(timestamp,timezone(timedelta(hours=9))).isoformat()
   if re.search(r'(?<!\d)01\d[- .]?\d{3,4}[- .]?\d{4}(?!\d)',caption):item['issues'].append('PERSONAL_PHONE')
   for order,uri in enumerate(uris):
    b=z.read(uri);item['media'].append({'uri':uri,'order':order,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'video':Path(uri).suffix.lower() in ('.mp4','.mov')})
   result.append(item)
  excluded=[{'richIndex':i,'sourceId':r['fbid'],'reason':'ARCHIVED_MEDIA' if any(p.startswith('media/archived_posts/') for p in media_paths(r)) else 'NOT_IN_CURRENT_FEED_EXPORT'} for i,r in enumerate(rich) if i not in used]
  return {'zipSha256':hashlib.file_digest(open(path,'rb'),'sha256').hexdigest(),'zipBytes':path.stat().st_size,'entries':len(infos),'unpackedBytes':total,'richPostRecords':len(rich),'feedPosts':len(feeds),'feedMedia':sum(len(p['media']) for p in result),'excludedRichRecords':excluded,'categories':dict(collections.Counter('/'.join(x.filename.split('/')[:2]) for x in infos)),'posts':result}

def main():
 from news08_private import secure_directory
 from PIL import Image,ImageOps,ImageDraw
 parser=argparse.ArgumentParser();parser.add_argument('zip',type=Path);args=parser.parse_args()
 assert shutil.disk_usage('C:/').free>16*1024**3,'DISK_SAFETY_LIMIT'
 out=secure_directory();result=review(args.zip)
 (out/'instagram-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 with zipfile.ZipFile(args.zip) as z:
  for start in range(0,len(result['posts']),6):
   sheet=Image.new('RGB',(1200,6*200),'#eeeeee');draw=ImageDraw.Draw(sheet)
   for y,post in enumerate(result['posts'][start:start+6]):
    draw.text((5,y*200+3),f"FEED {post['feedIndex']} / {post.get('publishedAtKST','?')[:10]} / {len(post['media'])} assets",fill='black')
    for x,m in enumerate(post['media'][:8]):
     if m['video']:continue
     with Image.open(io.BytesIO(z.read(m['uri']))) as im:
      assert im.width*im.height<=16_000_000,'PIXEL_LIMIT';im=ImageOps.exif_transpose(im);im.thumbnail((145,170));sheet.paste(im.convert('RGB'),(x*150,y*200+25))
   sheet.save(out/f'instagram-contact-{start}.jpg')
 public={k:v for k,v in result.items() if k!='posts'};public['issues']=dict(collections.Counter(v for p in result['posts'] for v in p['issues']))
 (out.parent/'instagram-zip-audit.json').write_text(json.dumps(public,indent=2));print(json.dumps(public))

if __name__=='__main__':main()
