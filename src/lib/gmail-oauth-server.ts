import 'server-only'
/** Refresh only an already consented readonly grant. No interactive consent or mailbox mutation. */
export async function gmailAccessToken(env:NodeJS.ProcessEnv=process.env):Promise<string>{
 if(env.OAZ_GMAIL_READONLY_TOKEN){await validateGrant(env.OAZ_GMAIL_READONLY_TOKEN,env.OAZ_GMAIL_CLIENT_ID);return env.OAZ_GMAIL_READONLY_TOKEN;}
 if(!env.OAZ_GMAIL_REFRESH_TOKEN||!env.OAZ_GMAIL_CLIENT_ID||!env.OAZ_GMAIL_CLIENT_SECRET)throw Error('GMAIL_AUTH_PENDING');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:env.OAZ_GMAIL_REFRESH_TOKEN,client_id:env.OAZ_GMAIL_CLIENT_ID,client_secret:env.OAZ_GMAIL_CLIENT_SECRET})});
 if(!response.ok||Number(response.headers.get('content-length'))>16384)throw Error('GMAIL_REAUTH_REQUIRED');
 const reader=response.body?.getReader();if(!reader)throw Error('GMAIL_REAUTH_REQUIRED');let size=0,text='';const decoder=new TextDecoder();
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw Error('GMAIL_RESPONSE_LIMIT')}text+=decoder.decode(value,{stream:true})}
 const result=JSON.parse(text+decoder.decode());
 if(typeof result.access_token!=='string'||result.access_token.length>8192)throw Error('GMAIL_REAUTH_REQUIRED');
 if(result.scope!==undefined&&String(result.scope)!=='https://www.googleapis.com/auth/gmail.readonly')throw Error('GMAIL_SCOPE_MISMATCH');
 await validateGrant(result.access_token,env.OAZ_GMAIL_CLIENT_ID);
 return result.access_token;
}
async function validateGrant(token:string,clientId:string|undefined){
 if(!clientId)throw Error('GMAIL_CLIENT_REQUIRED');
 // Same introspection method as Google's official OAuth2 client; never put a token in a URL.
 const response=await fetch('https://oauth2.googleapis.com/tokeninfo',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('GMAIL_REAUTH_REQUIRED');
 const reader=response.body?.getReader();if(!reader)throw Error('GMAIL_GRANT_UNVERIFIED');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16384){await reader.cancel();throw Error('GMAIL_RESPONSE_LIMIT')}chunks.push(value)}
 const grant=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(grant.scope!=='https://www.googleapis.com/auth/gmail.readonly'||grant.aud!==clientId||!Number.isFinite(Number(grant.expires_in))||Number(grant.expires_in)<=0)throw Error('GMAIL_GRANT_UNVERIFIED');
}
