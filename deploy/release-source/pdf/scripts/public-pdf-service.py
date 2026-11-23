"""Private PDF validator transport. Bind behind TLS; no file names, bodies or tokens logged."""
import argparse
import hmac
import http.server
import os
from pathlib import Path
import re
import subprocess
import sys
import threading

LIMIT=4*1024*1024
ROOT=Path(__file__).resolve().parents[1]

def handler_class(key):
    if not re.fullmatch(r'[a-f0-9]{64}',key):
        raise ValueError('PDF_SERVICE_KEY_REQUIRED')
    slots=threading.BoundedSemaphore(2)
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self,*args):
            pass
        def setup(self):
            super().setup()
            self.connection.settimeout(20)
        def reply(self,status,data=b'',mime='application/octet-stream'):
            self.send_response(status)
            self.send_header('Content-Type',mime)
            self.send_header('Content-Length',str(len(data)))
            self.send_header('Cache-Control','no-store')
            self.send_header('X-Content-Type-Options','nosniff')
            self.end_headers()
            self.wfile.write(data)
        def do_POST(self):
            if self.path!='/v1/normalize':
                self.reply(404);return
            if not hmac.compare_digest(self.headers.get('Authorization','').encode(),('Bearer '+key).encode()):
                self.reply(403);return
            if self.headers.get('Content-Type')!='application/pdf' or self.headers.get('Transfer-Encoding'):
                self.reply(415);return
            try:
                sizes=self.headers.get_all('Content-Length',[])
                if len(sizes)!=1 or not sizes[0].isdigit():raise ValueError()
                size=int(sizes[0])
                if not 0<size<=LIMIT:raise ValueError()
            except ValueError:
                self.reply(413);return
            if not slots.acquire(blocking=False):
                self.reply(503);return
            try:
                body=self.rfile.read(size)
                if len(body)!=size:raise ValueError()
                result=subprocess.run([sys.executable,'-B',str(ROOT/'scripts/validate-public-pdf.py')],input=body,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=12,check=False)
                if result.returncode or not 0<len(result.stdout)<=LIMIT:raise ValueError()
                self.reply(200,result.stdout,'application/pdf')
            except (ValueError,TimeoutError,subprocess.TimeoutExpired,OSError):
                self.reply(422)
            finally:
                slots.release()
    return Handler

def serve(host,port,key):
    http.server.ThreadingHTTPServer((host,port),handler_class(key)).serve_forever()

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8081)
    args=parser.parse_args()
    # Mounted secret file or process environment, never command-line secret arguments.
    secret=Path(os.environ['OAZ_PDF_VALIDATOR_KEY_FILE']).read_text().strip() if os.environ.get('OAZ_PDF_VALIDATOR_KEY_FILE') else os.environ.get('OAZ_PDF_VALIDATOR_KEY','')
    serve(args.host,args.port,secret)
