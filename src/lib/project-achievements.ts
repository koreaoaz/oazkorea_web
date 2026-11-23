/** Keep legacy free text intact; JSON arrays and actual arrays are also supported. */
export function projectAchievements(value:unknown):string[]{
 if(Array.isArray(value))return value.filter((v):v is string=>typeof v==='string');
 if(typeof value!=='string'||!value.trim())return [];
 try{const parsed:unknown=JSON.parse(value);if(Array.isArray(parsed)&&parsed.every(v=>typeof v==='string'))return parsed}catch{}
 return [value];
}
