import {test} from 'node:test'
import assert from 'node:assert/strict'
import {domTest,loadSource} from './helpers/react-dom.mjs'

test('scoped translation editor restores a previous field and saves only English',async()=>domTest(async({render,act,container,window})=>{
 const writes=[]
 const version={source:{title:'일정 안내',body:'한국어 원문'},sourceHash:'a'.repeat(64),revision:2,title:'Schedule',body:'Current body',history:[{id:1,field:'body',english:'Earlier body',saved_at:'2026-11-21T00:00:00Z',manual:true}]}
 const finalCommand=async command=>{
   if(command.action==='translation.list')return [{id:41,korean:version.source.title,english:version.title,status:'automatic',updated:null}]
   if(command.action==='translation.get')return version
   writes.push(command)
   return {revision:3}
 }
 const {NoticeEnglish}=loadSource('src/app/admin/content/tools/notice-english.tsx',{'@/lib/admin/final-client':{finalCommand}})
 await render(NoticeEnglish)
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,15))})
 async function click(label){
   const button=[...container.querySelectorAll('button')].find(b=>b.textContent===label)
   assert.ok(button,label)
   await act(async()=>button.click())
 }
 await click('영어 번역 수정')
 assert.equal(container.querySelector('input').value,'Schedule')
 assert.match(container.textContent,/한국어 원문/)
 assert.equal(container.querySelector('input[type=checkbox]'),null)
 await click('이 버전 사용')
 assert.equal(container.querySelector('textarea').value,'Earlier body')
 await click('취소')
 assert.equal(writes.length,0)
 await click('영어 번역 수정')
 await click('이 버전 사용')
 await act(async()=>container.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})))
 assert.deepEqual(JSON.parse(JSON.stringify(writes)),[{action:'translation.save',table:'editor_0_noti',id:41,sourceHash:version.sourceHash,revision:2,title:'Schedule',body:'Earlier body'}])
 assert.match(container.textContent,/영어 번역을 저장했습니다/)
}))
