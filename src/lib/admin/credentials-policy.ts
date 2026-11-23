export const credentialName=/^[a-z][a-z0-9._-]{3,31}$/
export function passwordAllowed(value:unknown):value is string {
 if(typeof value!=='string'||[...value].length<15||new TextEncoder().encode(value).length>72||/[\u0000-\u001f\u007f]/.test(value))return false
 const normalized=value.toLowerCase().replace(/[^a-z0-9]/g,'')
 return new Set(value).size>=4&&!/^(password123456789|administrator123|123456789012345|12345678901234567890|qwerty123456789)$/.test(normalized)&&!/^(.{1,8})\1{2,}$/.test(value)
}
