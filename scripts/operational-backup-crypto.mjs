// Reuses the reviewed OAZ scrypt/AES-256-GCM parameters. No network or plaintext files.
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
const MAGIC=Buffer.from('OAZBAK01'),MAX=128*1024*1024;
function key(password,salt){
 if(typeof password!=='string'||password.length<20||Buffer.byteLength(password)>1024)throw Error('PASSWORD_POLICY');
 return crypto.scryptSync(password,salt,32,{N:131072,r:8,p:1,maxmem:192*1024*1024});
}
export function seal(raw,password){
 if(!Buffer.isBuffer(raw)||raw.length<1||raw.length>MAX)throw Error('SIZE_LIMIT');
 const salt=crypto.randomBytes(16),nonce=crypto.randomBytes(12);
 const h=Buffer.from(JSON.stringify({version:1,cipher:'AES-256-GCM',kdf:'scrypt',N:131072,r:8,p:1,salt:salt.toString('hex'),nonce:nonce.toString('hex'),bytes:raw.length}));
 const prefix=Buffer.alloc(12);MAGIC.copy(prefix);prefix.writeUInt32BE(h.length,8);const aad=Buffer.concat([prefix,h]);
 const k=key(password,salt);try{const c=crypto.createCipheriv('aes-256-gcm',k,nonce,{authTagLength:16});c.setAAD(aad);return Buffer.concat([aad,c.update(raw),c.final(),c.getAuthTag()]);}finally{k.fill(0);}
}
export function open(sealed,password){
 if(!Buffer.isBuffer(sealed)||sealed.length<29||sealed.length>MAX+4112||!sealed.subarray(0,8).equals(MAGIC))throw Error('FORMAT');
 const n=sealed.readUInt32BE(8);if(n<1||n>4096||12+n+16>=sealed.length)throw Error('HEADER');
 const h=JSON.parse(sealed.subarray(12,12+n).toString());
 if(h.version!==1||h.cipher!=='AES-256-GCM'||h.kdf!=='scrypt'||h.N!==131072||h.r!==8||h.p!==1||!Number.isSafeInteger(h.bytes)||h.bytes<1||h.bytes>MAX||sealed.length!==12+n+h.bytes+16||!/^[0-9a-f]{32}$/.test(h.salt)||!/^[0-9a-f]{24}$/.test(h.nonce))throw Error('HEADER');
 const k=key(password,Buffer.from(h.salt,'hex'));let raw;
 try{const d=crypto.createDecipheriv('aes-256-gcm',k,Buffer.from(h.nonce,'hex'),{authTagLength:16});d.setAAD(sealed.subarray(0,12+n));d.setAuthTag(sealed.subarray(-16));raw=d.update(sealed.subarray(12+n,-16));const tail=d.final();return Buffer.concat([raw,tail]);}catch(e){raw?.fill(0);throw e;}finally{k.fill(0);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>180*1024*1024)throw Error('INPUT_LIMIT');chunks.push(chunk);}const arg=JSON.parse(Buffer.concat(chunks).toString());const raw=Buffer.from(arg.data,'base64');if(!['seal','open'].includes(arg.mode))throw Error('MODE');const result=arg.mode==='seal'?seal(raw,arg.password):open(raw,arg.password);arg.password='';process.stdout.write(result);raw.fill(0);}catch{process.stderr.write('BACKUP_CRYPTO_FAILED\n');process.exitCode=2;}
}
