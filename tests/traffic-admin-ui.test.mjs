import test from 'node:test'
import assert from 'node:assert/strict'
import {domTest,loadSource} from './helpers/react-dom.mjs'
test('content catalog places studies before projects while retaining the editor scope for each link',async()=>domTest(async({container,render})=>{
  const {ContentCatalog}=loadSource('src/app/admin/content/catalog.tsx',{
    '@/lib/admin/client':{adminCommand:async()=>({role:'ADMIN',slot:'admin2',scopes:['editor_2_studies']})},
    '@/components/LocaleProvider':{T:({text})=>text},
    '@/components/AdminSessionLoading':{AdminSessionLoading:()=>null},
  })
  await render(ContentCatalog)
  const cards=Array.from(container.querySelectorAll('article'))
  const names=cards.map(c=>c.querySelector('h2').textContent)
  assert.deepEqual(names.slice(0,5),['공지','홍보','스터디','프로젝트','시간표'])
  assert.equal(cards[2].querySelector('a').getAttribute('href'),'/admin/content/studies')
  assert.equal(cards[3].querySelector('a'),null)
}))
test('protected status route rejects unauthenticated, regular and AAL1 sessions before the operational RPC',async()=>{
 let session=null,calls=0
 const {GET}=loadSource('src/app/api/admin/operations-status/route.ts',{
   '@/lib/admin/server':{verifiedAdminPage:async()=>session},
   '@/lib/traffic-server':{reply:(data,status=200)=>Response.json(data,{status}),trafficRpc:()=>async()=>{calls++;return {started:'2026-11-23T03:10:00Z',lastCron:null,latest:null}}},
 },{process:{env:{}}})
 const request=new Request('https://example.invalid/api/admin/operations-status')
 for(session of [null,{role:'ADMIN',aal:'aal2'},{role:'SUPER_ADMIN',aal:'aal1'}])assert.equal((await GET(request)).status,403)
 assert.equal(calls,0)
 session={role:'SUPER_ADMIN',aal:'aal2'}
 assert.equal((await GET(request)).status,200)
 assert.equal(calls,1)
})
