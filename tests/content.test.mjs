import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {build,root,safeFile} from '../scripts/build-content.mjs';
function rootWithSeries(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sabatku-series-test-'));
 fs.cpSync(path.join(root,'contracts'),path.join(tmp,'contracts'),{recursive:true});
 fs.cpSync(path.join(root,'content'),path.join(tmp,'content'),{recursive:true});
 fs.copyFileSync(path.join(root,'repository.json'),path.join(tmp,'repository.json'));
 const taxonomyPath=path.join(tmp,'contracts/library-taxonomy.v1.json');
 const taxonomy=JSON.parse(fs.readFileSync(taxonomyPath,'utf8'));
 taxonomy.series.push({id:'sample-series',label:{id:'Seri Contoh',en:'Sample Series'}});
 fs.writeFileSync(taxonomyPath,JSON.stringify(taxonomy,null,2)+'\n');
 const lockPath=path.join(tmp,'contracts/lock.json');
 const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
 lock.files['library-taxonomy.v1.json']=crypto.createHash('sha256').update(fs.readFileSync(taxonomyPath)).digest('hex');
 fs.writeFileSync(lockPath,JSON.stringify(lock,null,2)+'\n');
 const workPath=path.join(tmp,'content/id/love-under-fire-id/work.json');
 const work=JSON.parse(fs.readFileSync(workPath,'utf8'));
 work.seriesIds=['sample-series'];
 fs.writeFileSync(workPath,JSON.stringify(work,null,2)+'\n');
 return {tmp,workPath};
}
function rootCopy(){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sabatku-content-test-'));
 fs.cpSync(path.join(root,'contracts'),path.join(tmp,'contracts'),{recursive:true});
 fs.cpSync(path.join(root,'content'),path.join(tmp,'content'),{recursive:true});
 fs.copyFileSync(path.join(root,'repository.json'),path.join(tmp,'repository.json'));
 return tmp;
}
test('the published Indonesian and local English editions enter the catalog with official sources',()=>{
 const result=build(root,{write:false});
 assert.equal(result.published,2);
 const edition=JSON.parse(fs.readFileSync(path.join(root,'content/id/love-under-fire-id/edition.json'),'utf8'));
 assert.equal(edition.id,'edition:love-under-fire:id:sabatku');
 assert.equal(edition.title,'Kasih di Tengah Kobaran Konflik');
 assert.equal(edition.locale,'id');
 assert.equal(edition.status,'published');
 assert.equal(edition.nodes.filter(node=>node.id.startsWith('chapter-')).length,42);
 assert.equal(edition.revision,'7');
 assert.equal(edition.externalEditions,undefined);
 const english=JSON.parse(fs.readFileSync(path.join(root,'content/en/love-under-fire-en/edition.json'),'utf8'));
 assert.equal(english.locale,'en');
 assert.equal(english.title,'Love Under Fire');
 assert.equal(english.nodes.filter(node=>node.id.startsWith('chapter-')).length,42);
 assert.equal(english.sources.find(source=>source.primary).url,'https://egwwritings.org/read?panels=p12269.2&index=0');
 assert.equal(english.sources.find(source=>source.kind==='pdf').offlineAllowed,true);
 assert.equal(result.documents,5);
 assert.equal(result.catalog.find(entry=>entry.locale==='en').id,'edition:love-under-fire:en:sabatku');
 assert.equal(result.catalog.find(entry=>entry.locale==='en').contentMode,'hosted');
 assert.equal(result.catalog.find(entry=>entry.locale==='en').sources.find(source=>source.kind==='pdf').offlineAllowed,true);
 assert.deepEqual(result.catalog.find(entry=>entry.locale==='id').audienceIds,['teens','young-adults']);
 assert.deepEqual(result.catalog.find(entry=>entry.locale==='en').audienceIds,['teens','young-adults']);
 assert.deepEqual(result.catalog.find(entry=>entry.locale==='id').seriesIds,[]);
 assert.deepEqual(result.catalog.find(entry=>entry.locale==='en').seriesIds,[]);
});
test('chapter headings become navigable sections and public copy keeps only reader notes',()=>{
 const tmp=rootCopy();
 try{
  build(tmp,{write:true});
  const editionRoot=path.join(tmp,'public/editions/love-under-fire-id/revisions/7');
  const manifest=JSON.parse(fs.readFileSync(path.join(editionRoot,'manifest.json'),'utf8'));
  const chapter=manifest.nodes.find(node=>node.id==='chapter-01');
  const sections=manifest.nodes.filter(node=>node.parentId==='chapter-01');
  assert.equal(chapter.nodeType,'chapter');
  assert.ok(sections.length>0);
  assert.ok(sections.every(node=>node.nodeType==='section'&&node.content?.path));
  const firstSection=fs.readFileSync(path.join(tmp,'public',sections[0].content.path),'utf8');
  assert.doesNotMatch(firstSection,/^##\s/m);
  const chapterWithFootnote=sections.find(node=>node.title.includes('Pertanda'));
  assert.ok(chapterWithFootnote);
  const noteBody=fs.readFileSync(path.join(tmp,'public',chapterWithFootnote.content.path),'utf8');
  assert.match(noteBody,/[\^]1\]/);
  assert.match(noteBody,/\[\^1\]: Henry Hart Milman/);
  const info=fs.readFileSync(path.join(tmp,'public',manifest.nodes.find(node=>node.id==='front-information').content.path),'utf8');
  assert.doesNotMatch(info,/End User License Agreement|lisensi terbatas|Catatan penyunting/);
  assert.doesNotMatch(info,/Penerjemah harus meninjau cakupan izin/i);
  assert.match(info,/izin resmi pemegang hak/);
  assert.ok(!manifest.nodes.some(node=>node.id==='glossary'));
  assert.doesNotMatch(JSON.stringify(manifest),/Catatan audit Bab|perlu audit sebelum publikasi/i);
  const appendix=fs.readFileSync(path.join(tmp,'public',manifest.nodes.find(node=>node.id==='appendix').content.path),'utf8');
  assert.doesNotMatch(appendix,/Catatan pemeriksaan|audit editorial tersendiri/i);
  assert.equal(manifest.offlineRedistributionAllowed,true);
  const englishManifest=JSON.parse(fs.readFileSync(path.join(tmp,'public/editions/love-under-fire-en/revisions/3/manifest.json'),'utf8'));
  const englishChapter=englishManifest.nodes.find(node=>node.id==='chapter-01');
  const englishSections=englishManifest.nodes.filter(node=>node.parentId==='chapter-01');
  assert.ok(englishSections.length>0);
  assert.equal(englishChapter.nodeType,'chapter');
  assert.ok(englishSections.every(node=>node.nodeType==='section'&&node.content?.path));
  const englishSectionFiles=englishSections.map(node=>fs.readFileSync(path.join(tmp,'public',node.content.path),'utf8'));
  assert.ok(englishSections.some(node=>node.title==='Magnificent Temple Doomed'));
  const englishFootnote=englishSectionFiles.find(text=>/\[\^\d+\]/.test(text));
  assert.ok(englishFootnote);
  assert.match(englishFootnote,/\[\^\d+\]:/);
  assert.doesNotMatch(JSON.stringify(englishManifest),/End User License Agreement|limited license/i);
  assert.equal(englishManifest.offlineRedistributionAllowed,true);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
test('series labels validate and propagate to every language edition',()=>{
 const {tmp,workPath}=rootWithSeries();
 try{
  const result=build(tmp,{write:false});
  assert.deepEqual(result.catalog.map(entry=>entry.seriesIds),[['sample-series'],['sample-series']]);
  const work=JSON.parse(fs.readFileSync(workPath,'utf8'));
  work.seriesIds=['unknown-series'];
  fs.writeFileSync(workPath,JSON.stringify(work,null,2)+'\n');
  assert.throws(()=>build(tmp,{write:false}),/Unknown series unknown-series/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
test('unsafe and missing source paths are rejected',()=>{assert.throws(()=>safeFile(root,'../secret'));assert.throws(()=>safeFile(root,'C:/secret'));assert.throws(()=>safeFile(root,'missing.md'))});
test('contract tampering is detected',()=>{const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sabatku-contract-test-'));try{fs.cpSync(path.join(root,'contracts'),path.join(tmp,'contracts'),{recursive:true});fs.copyFileSync(path.join(root,'repository.json'),path.join(tmp,'repository.json'));fs.appendFileSync(path.join(tmp,'contracts/digital-content.schema.json'),' ');assert.throws(()=>build(tmp,{write:false}),/Contract snapshot changed/)}finally{fs.rmSync(tmp,{recursive:true,force:true})}});
