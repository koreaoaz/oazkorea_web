import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {loadSource} from './helpers/react-dom.mjs'

const {packSections,unpackSections,savedSections} = loadSource('src/lib/record-sections.ts')
test('section editing retains delimiters in text, original newlines, and an unstructured original',()=>{
  const original='first\r\n\r\n## 00\r\nold note'
  const content=['A\n## 02\nB','\\example','C','D']
  const saved=packSections(content,original)
  assert.deepEqual([...unpackSections(saved).texts],content)
  assert.equal(unpackSections(saved).original,original)
  assert.equal(unpackSections(original),undefined)
  assert.equal(savedSections(packSections(['A','','C','D'],original)),undefined)
  assert.deepEqual([...savedSections(saved,packSections(['E','F','G','H'],'')).map(x=>x.en)],['E','F','G','H'])
})
for(const [kind,total] of [['project',14],['study',18]])test(kind+' has four source-matched bilingual sections in order',()=>{
  const data=JSON.parse(readFileSync('src/data/'+kind+'-sections.json','utf8'))
  assert.equal(Object.keys(data).length,total)
  for(const row of Object.values(data)){
    assert.deepEqual(row.sections.map(s=>s.kind),['overview','activities','implementation','results'])
    for(const s of row.sections){
      assert.ok(s.en.trim() && s.ko.trim())
      assert.equal(s.sourceHash,createHash('sha256').update(s.ko).digest('hex'))
    }
  }
})
