import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadSource,domTest} from './helpers/react-dom.mjs';
for(const locale of ['ko','en'])test(`home and Alumni honor lists preserve canonical API name order in ${locale}`,()=>domTest(async({render,container})=>{
 const entries=[{display_name:'합성 가',display_order:30},{display_name:'합성 나',display_order:1},{display_name:'합성 다',display_order:0}];
 const {default:Donators}=loadSource('src/components/home/features/Donators.tsx',{
  '@/components/LocaleProvider':{T:({text})=>text},
  '@/hooks/useAsyncQuery':{useAsyncQuery:()=>({data:{entries,fixtureCount:0},loading:false,error:null,reload(){}})},
 });
 await render(Donators,{detailed:false});
 // Home uses the common list component; assert canonical text order even when
 // old numeric ranks deliberately conflict. Alumni receives the exact same data.
 const text=container.textContent;assert.ok(text.indexOf('합성 가')<text.indexOf('합성 나'));assert.ok(text.indexOf('합성 나')<text.indexOf('합성 다'));
 await render(Donators,{detailed:true});assert.deepEqual([...container.querySelectorAll('h2')].map(x=>x.textContent),entries.map(x=>x.display_name));
}));
