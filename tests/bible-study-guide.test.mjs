import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {build,root} from '../scripts/build-content.mjs';

test('Metcalf guide publishes registered source parts with complete question sequences',()=>{
 const base=path.join(root,'content/id/penuntun-dasar-pemahaman-alkitab');
 const edition=JSON.parse(fs.readFileSync(path.join(base,'edition.json'),'utf8'));
 const result=build(root,{write:false});
 const entry=result.catalog.find(book=>book.workId==='work:penuntun-dasar-pemahaman-alkitab');
 assert.ok(entry);
 assert.equal(entry.locale,'id');
 assert.equal(entry.title,'SPL - Penuntun Dasar untuk Pemahaman Alkitab');
 assert.match(entry.description,/pertanyaan, jawaban ayat, penjelasan, dan kesimpulan/);
 assert.doesNotMatch(entry.description,/belum tersedia|ditambahkan bertahap/);
 assert.equal(edition.nodes.length,47);
 assert.deepEqual(edition.nodes.filter(node=>node.nodeType==='part').map(node=>node.id),['part-01','part-02','part-03','part-04','part-05','part-06','part-07']);
 for (const [part,expected] of [['02',[7,4,4,8]],['03',[5,6,10,10,6,7,8]],['04',[8,14,7,4]],['05',[14,13,6,9,10]],['06',[6,9,5,3,7]],['07',[8,7,8,7,3,3,11,7,3,8]]]) {
  const sections=edition.nodes.filter(node=>node.parentId===`part-${part}`);
  assert.equal(sections.length,expected.length);
  sections.forEach((node,index)=>{
   const body=fs.readFileSync(path.join(base,node.file),'utf8');
   const sequence=[...body.matchAll(/^### (\d+)\./gm)].map(match=>Number(match[1]));
   assert.deepEqual(sequence,Array.from({length:expected[index]},(_,i)=>i+1));
   assert.doesNotMatch(body,/^## HALAMAN|^---$|Transkripsi berdasarkan/m);
  });
 }
 const counts=[5,5,10,6,5];
 const notes=[2,5,2,3,3];
 const quotes=[4,5,8,6,5];
 const topics=edition.nodes.filter(node=>node.parentId==='part-01');
 assert.equal(topics.length,5);
 topics.forEach((node,index)=>{
  const body=fs.readFileSync(path.join(base,node.file),'utf8');
  assert.equal([...body.matchAll(/^### \d+\./gm)].length,counts[index]);
  assert.equal([...body.matchAll(/^### Kesimpulan$/gm)].length,1);
  assert.equal([...body.matchAll(/^\*\*Catatan:/gm)].length,notes[index]);
  assert.equal([...body.matchAll(/^> “/gm)].length,quotes[index]);
  assert.doesNotMatch(body,/^---$|^>$/m);
  assert.doesNotMatch(body,/\b(?:draf|OCR|needs-team-review)\b/i);
  assert.doesNotMatch(body,/; Baca /);
 });
 const creation=fs.readFileSync(path.join(base,topics[2].file),'utf8');
 assert.match(creation,/Mazmur 33:6; Mazmur 33:9/);
 assert.match(creation,/Baca Kejadian 2:15/);
 const foundation=fs.readFileSync(path.join(base,topics[4].file),'utf8');
 assert.match(foundation,/2 Timotius 2:18/);
 assert.doesNotMatch(foundation,/1 Timotius 2:18/);
 const prophecy=fs.readFileSync(path.join(base,topics[1].file),'utf8');
 assert.match(prophecy,/Babel mempertahankan seorang komisaris di dalam kota itu/);
 const understanding=fs.readFileSync(path.join(base,topics[3].file),'utf8');
 assert.match(understanding,/dari pohon kehidupan dan dari kota kudus/);
 assert.match(understanding,/\*\*Peraturan 5:/);
 assert.match(foundation,/memilih kamu untuk diselamatkan dalam Roh yang menguduskan kamu/);
});
