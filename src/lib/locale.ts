export type Locale='ko'|'en'
export const parseLocale=(value:unknown):Locale=>value==='en'?'en':'ko'
export function localeURL(path:string,locale:Locale){const u=new URL(path,'http://locale.invalid');if(u.origin!=='http://locale.invalid')return '/?lang='+locale;u.searchParams.set('lang',locale);return u.pathname+u.search+u.hash}
