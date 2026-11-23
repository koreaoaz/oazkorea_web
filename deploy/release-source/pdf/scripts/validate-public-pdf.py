"""Bounded subprocess, binary stdin/stdout; never reads user document paths or logs their contents."""
import hashlib,io,logging,re,sys
from pathlib import Path
WHEEL=Path(__file__).resolve().parents[1]/'build/final-integration/tools/pypdf-6.21.4-py3-none-any.whl'
SHA='33e4fb41ca352810eb4e9838aa0d82d6888a5f8bf682f43e99cce5faa666255c'
def normalize(data):
 if len(data)>5*1024*1024 or not data.startswith(b'%PDF-') or not data.rstrip().endswith(b'%%EOF'):raise ValueError()
 assert hashlib.sha256(WHEEL.read_bytes()).hexdigest()==SHA
 sys.path.insert(0,str(WHEEL))
 from pypdf import PdfReader,PdfWriter
 from pypdf._configuration import apply_configuration
 from pypdf.generic import DictionaryObject,ArrayObject,IndirectObject,StreamObject
 logging.disable(logging.CRITICAL)
 with apply_configuration(maximum_declared_stream_length=8_000_000,zlib_maximum_output_length=8_000_000,array_based_stream_maximum_output_length=8_000_000,stream_decoding_work_maximum_length=16_000_000,stream_filters_maximum_length=4,stream_parsing_work_maximum_count=100000,page_tree_maximum_entries=500,page_tree_maximum_page_entries=5000,array_maximum_element_count=10000,dictionary_maximum_element_count=10000,jbig2dec_binary=None):
  reader=PdfReader(io.BytesIO(data),strict=True,root_object_recovery_limit=0)
  if reader.is_encrypted or not 1<=len(reader.pages)<=100:raise ValueError()
  blocked={'/JS','/JavaScript','/AA','/OpenAction','/Launch','/EmbeddedFiles','/EmbeddedFile','/RichMedia','/XFA','/AcroForm','/SubmitForm','/ImportData','/GoToR','/GoToE','/URI','/Annots','/3D','/Sound','/Movie','/FileAttachment','/JBIG2Decode','/JBIG2Globals'}
  seen=set();budget=[0,0]
  def walk(obj,depth=0):
   budget[0]+=1
   if budget[0]>50000 or depth>60:raise ValueError()
   if isinstance(obj,IndirectObject):
    key=(obj.idnum,obj.generation)
    if key in seen:return
    seen.add(key);return walk(obj.get_object(),depth+1)
   if isinstance(obj,DictionaryObject):
    if blocked.intersection(map(str,obj.keys())) or any(str(v) in blocked for v in obj.values()):raise ValueError()
    if isinstance(obj,StreamObject):
     decoded=obj.get_data();budget[1]+=len(decoded)
     if budget[1]>32_000_000:raise ValueError()
    for value in obj.values():walk(value,depth+1)
   elif isinstance(obj,ArrayObject):
    for value in obj:walk(value,depth+1)
  walk(reader.trailer)
  text='\n'.join(page.extract_text() or '' for page in reader.pages)
  if re.search(r'강의자료|강의 원본|과제|회원명부|회계|출석부|개인정보|lecture notes|assignment|confidential|payroll',text,re.I):raise ValueError()
  if re.search(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|01[016789][- .]?\d{3,4}[- .]?\d{4}',text):raise ValueError()
  writer=PdfWriter()
  for page in reader.pages:writer.add_page(page,excluded_keys=['/Metadata','/PieceInfo','/Annots'])
  writer.add_metadata({'/Producer':'OaZ public document validation'})
  output=io.BytesIO();writer.write(output);result=output.getvalue()
  if len(result)>5*1024*1024:raise ValueError()
  return result
if __name__=='__main__':
 try:sys.stdout.buffer.write(normalize(sys.stdin.buffer.read(5*1024*1024+1)))
 except Exception:sys.stderr.write('PDF_REVIEW_REJECTED\n');sys.exit(1)
