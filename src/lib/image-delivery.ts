import {mainPresentation} from './main-presentation'
/** Main and reviewed local environments use revocable delivery. */
export function imageURL(bucket:string,path:string,legacy:string){
 if(!mainPresentation()&&process.env.NEXT_PUBLIC_OAZ_FINAL_ACCEPTANCE!=='true')return legacy;
 if(/^https?:\/\//.test(path)){
  try{const url=new URL(path),prefix='/storage/v1/object/public/'+bucket+'/';if(url.protocol!=='https:'||url.hostname!=='maoefmwpdcnugyenyiea.supabase.co'||url.username||url.password||url.search||!url.pathname.startsWith(prefix))return '/placeholder.svg';path=decodeURIComponent(url.pathname.slice(prefix.length))}catch{return '/placeholder.svg'}
 }
 if(!['notice-images','project_img','study-images','card_news'].includes(bucket)||path.split('/').some(p=>!p||p==='.'||p==='..'||/[\\\x00-\x1f]/.test(p)))return '/placeholder.svg';
 return '/api/images/'+encodeURIComponent(bucket)+'/'+path.split('/').map(encodeURIComponent).join('/');
}
