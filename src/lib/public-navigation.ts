export const PUBLIC_NAV_ITEMS=[
 {name:'About',href:'/about/who-we-are',subItems:[{name:'Who We Are',href:'/about/who-we-are'},{name:'Notice',href:'/about/notice'}]},
 {name:'Records',href:'/studies/records',subItems:[{name:'Study Records',href:'/studies/records'},{name:'Project Records',href:'/projects/archives'}]},
 {name:'Schedule',href:'/studies/schedule',subItems:[{name:'Room Schedule',href:'/studies/schedule'},{name:'Calendar',href:'/schedule/calendar'}]},
 {name:'Recruit',href:'/recruit/timeline',subItems:[{name:'Timeline',href:'/recruit/timeline'},{name:'FAQ',href:'/recruit/faq'}]},
 {name:'Community',href:'/news',subItems:[{name:'News',href:'/news'},{name:'SNS',href:'/sns'}]},
 {name:'Alumni',href:'/alumni/homecoming',subItems:[{name:'Homecoming',href:'/alumni/homecoming'},{name:'Network',href:'/alumni/network'},{name:'Hall of Fame',href:'/alumni/hall-of-fame'}]},
] as const
export function isPublicLinkActive(href:string,path:string){
 if(href==='/recruit/timeline'&&['/recruit','/recruit/recruitment'].includes(path))return true
 return path===href||path.startsWith(href+'/')
}
export function isPublicNavActive(name:string,path:string){
 if(name==='Schedule')return isPublicLinkActive('/studies/schedule',path)||isPublicLinkActive('/schedule',path)
 if(name==='Records')return !isPublicLinkActive('/studies/schedule',path)&&['/studies','/projects','/events/archive'].some(prefix=>isPublicLinkActive(prefix,path))
 if(name==='Community')return ['/news','/sns','/blog'].some(prefix=>isPublicLinkActive(prefix,path))
 return isPublicLinkActive('/'+name.toLowerCase(),path)
}
export const SOCIAL_CHANNELS=[
 {id:'kakao',name:'카카오톡 공식 문의 채널',nameEn:'KakaoTalk Official Inquiry Channel',href:'http://pf.kakao.com/_nLRJX',image:'',description:'학회 일정, 스터디·세션, 행사 등 학회 활동에 관해 문의해 주세요.'},
 {id:'instagram',name:'Instagram',href:'https://www.instagram.com/ku_oaz',image:'/instagram.png',description:'학회 활동을 사진과 소식으로 만나는 기존 Instagram 채널입니다.'},
 {id:'band',name:'OaZ Band',href:'https://www.band.us/band/98494837',image:'/band.png',description:'학회 소식과 교류를 위한 기존 Band 채널입니다.'},
] as const
