import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {build,root} from '../scripts/build-content.mjs';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sabatku-books-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.cpSync(path.join(root,'contracts'),path.join(dir,'contracts'),{recursive:true});
 fs.copyFileSync(path.join(root,'repository.json'),path.join(dir,'repository.json'));
 fs.mkdirSync(path.join(dir,'content/book'),{recursive:true});
 const work=JSON.parse(fs.readFileSync(path.join(root,'examples/work.json')));
 const edition=JSON.parse(fs.readFileSync(path.join(root,'examples/edition.json')));
 edition.nodes=[{id:'chapter-27',title:'Chapter 27',order:27,file:'chapter.md'}];edition.cover='cover.png';
 fs.writeFileSync(path.join(dir,'content/book/chapter.md'),'# Chapter\n\nA paragraph.\n');
 fs.writeFileSync(path.join(dir,'content/book/cover.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64'));
 const save=()=>{fs.writeFileSync(path.join(dir,'content/book/work.json'),JSON.stringify(work));fs.writeFileSync(path.join(dir,'content/book/edition.json'),JSON.stringify(edition))};save();
 return {dir,edition,save};
}
test('draft content is excluded; a published edition includes hashed cover and chapter',t=>{
 const f=fixture(t);assert.equal(build(f.dir).published,0);
 f.edition.status='published';f.edition.rights.status='verified';f.save();assert.equal(build(f.dir).published,1);
 const cat=JSON.parse(fs.readFileSync(path.join(f.dir,'public/catalog.json')));const m=JSON.parse(fs.readFileSync(path.join(f.dir,'public',cat.entries[0].manifest)));
 const body=fs.readFileSync(path.join(f.dir,'public',m.nodes[0].content.path));
 assert.equal(m.nodes[0].content.bytes,body.length);assert.equal(m.nodes[0].content.sha256,crypto.createHash('sha256').update(body).digest('hex'));
 assert.ok(fs.existsSync(path.join(f.dir,'public',m.cover.path)));
 assert.throws(()=>{fs.writeFileSync(path.join(f.dir,'content/book/chapter.md'),'changed');build(f.dir)},/Immutable revision/);
});
test('unreviewed rights cannot enter the catalog',t=>{const f=fixture(t);f.edition.status='published';f.save();assert.throws(()=>build(f.dir),/approved rights/)});
test('chapters larger than the online reader limit are rejected',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.dir,'content/book/chapter.md'),Buffer.alloc(2*1024*1024+1,97));assert.throws(()=>build(f.dir),/2 MiB reader limit/)});
test('TOC cycles and broken reading-plan targets fail validation',t=>{const f=fixture(t);f.edition.nodes[0].parentId='chapter-27';f.save();assert.throws(()=>build(f.dir),/TOC cycle/);delete f.edition.nodes[0].parentId;f.save();fs.writeFileSync(path.join(f.dir,'content/plan.json'),JSON.stringify({kind:'reading-plan',id:'plan:q4:01',programId:'cornerstone',editionId:'2026-q4-cc',lessonId:'lesson-01',targets:[{editionId:f.edition.id,nodeId:'missing'}]}));assert.throws(()=>build(f.dir),/Broken reading target/)});
