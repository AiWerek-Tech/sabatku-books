import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build,root,safeFile} from '../scripts/build-content.mjs';
test('only the published Indonesian pilot edition enters the catalog',()=>{
 const result=build(root,{write:false});
 assert.equal(result.published,1);
 const edition=JSON.parse(fs.readFileSync(path.join(root,'content/id/love-under-fire-id/edition.json'),'utf8'));
 assert.equal(edition.id,'edition:love-under-fire:id:sabatku');
 assert.equal(edition.title,'Kasih di Tengah Kobaran Konflik');
 assert.equal(edition.locale,'id');
 assert.equal(edition.status,'published');
 assert.equal(edition.nodes.filter(node=>node.id.startsWith('chapter-')).length,42);
 assert.equal(edition.sourceUrl,'https://m.egwwritings.org/en/book/12269.2');
});
test('unsafe and missing source paths are rejected',()=>{assert.throws(()=>safeFile(root,'../secret'));assert.throws(()=>safeFile(root,'C:/secret'));assert.throws(()=>safeFile(root,'missing.md'))});
test('contract tampering is detected',()=>{const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sabatku-contract-test-'));try{fs.cpSync(path.join(root,'contracts'),path.join(tmp,'contracts'),{recursive:true});fs.copyFileSync(path.join(root,'repository.json'),path.join(tmp,'repository.json'));fs.appendFileSync(path.join(tmp,'contracts/digital-content.schema.json'),' ');assert.throws(()=>build(tmp,{write:false}),/Contract snapshot changed/)}finally{fs.rmSync(tmp,{recursive:true,force:true})}});
