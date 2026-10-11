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
test('published Indonesian and local English editions enter the catalog with official sources',()=>{
 const result=build(root,{write:false});
 assert.equal(result.published,5);
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
 assert.equal(result.documents,11);
 assert.equal(result.catalog.find(entry=>entry.locale==='en').id,'edition:love-under-fire:en:sabatku');
 assert.equal(result.catalog.find(entry=>entry.locale==='en').contentMode,'hosted');
 assert.equal(result.catalog.find(entry=>entry.locale==='en').sources.find(source=>source.kind==='pdf').offlineAllowed,true);
 const indonesian=result.catalog.find(entry=>entry.id==='edition:love-under-fire:id:sabatku');
 assert.deepEqual(indonesian.audienceIds,['teens','young-adults']);
 assert.deepEqual(result.catalog.find(entry=>entry.locale==='en').audienceIds,['teens','young-adults']);
 assert.deepEqual(indonesian.seriesIds,[]);
 assert.deepEqual(result.catalog.find(entry=>entry.locale==='en').seriesIds,[]);
});
test('2026 stewardship readings publish 52 Sabbath entries with byte-verified offline Android assets',()=>{
 const result=build(root,{write:false});
 const edition=JSON.parse(fs.readFileSync(path.join(root,'content/id/stewardship-readings/2026/edition.json'),'utf8'));
 const work=JSON.parse(fs.readFileSync(path.join(root,'content/id/stewardship-readings/works/readings.json'),'utf8'));
 const androidAssets=path.resolve(root,'../sabatku-android/app/src/main/assets/stewardship-readings');
 const bundle=JSON.parse(fs.readFileSync(path.join(androidAssets,'index.json'),'utf8'));
 assert.equal(edition.id,'edition:stewardship-readings:2026:id');
 assert.equal(edition.revision,'4');
 assert.equal(edition.status,'published');
 assert.equal(edition.rights.status,'verified');
 assert.equal(edition.rights.offlineAllowed,true);
 assert.equal(work.author,'Julian Archer');
 assert.deepEqual(edition.collectionIds,['tithe-offering-readings']);
 assert.equal(edition.nodes.length,52);
 assert.ok(edition.sources.some(source=>source.primary&&source.url.startsWith('https://stewardship.adventist.org/')));
 assert.ok(edition.sources.some(source=>source.kind==='pdf'&&source.url.endsWith('.pdf')));
 assert.equal(bundle.book.id,edition.id);
 assert.equal(bundle.book.revision,edition.revision);
 assert.equal(bundle.readings.length,52);
 assert.ok(fs.statSync(path.join(androidAssets,'cover.jpg')).size>0);
 for(let index=0;index<52;index++){
  const node=edition.nodes[index],row=bundle.readings[index];
  const date=new Date(`${node.readingDate}T00:00:00Z`);
  assert.equal(node.order,index+1);
  assert.equal(node.nodeType,'chapter');
  assert.equal(date.getUTCDay(),6,`${node.id} is a Sabbath reading`);
  if(index)assert.equal(date.getTime()-new Date(`${edition.nodes[index-1].readingDate}T00:00:00Z`).getTime(),7*24*60*60*1000);
  assert.equal(row.id,node.id);
  assert.equal(row.readingDate,node.readingDate);
  const bytes=fs.readFileSync(path.join(androidAssets,row.contentAssetPath.replace('stewardship-readings/','')));
  assert.ok(bytes.length>0);
  assert.equal(bytes.length,row.bytes,`${row.id} byte length`);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256,`${row.id} SHA-256`);
 }
 const catalogEntry=result.catalog.find(entry=>entry.id===edition.id);
 assert.ok(catalogEntry);
 assert.equal(catalogEntry.offlineAllowed,true);
});
test('Mission Quarterlies publish child and youth/adult books with 13 aligned weekly chapters',()=>{
 const result=build(root,{write:false});
 const editions=result.catalog.filter(entry=>entry.id.startsWith('edition:mission-stories:')).sort((a,b)=>a.id.localeCompare(b.id));
 assert.equal(editions.length,2);
 assert.deepEqual(editions.map(entry=>entry.id),[
  'edition:mission-stories:2026-q4:children:id',
  'edition:mission-stories:2026-q4:youth-adult:id',
 ]);
 const dateSets=[];
 for(const entry of editions){
  assert.equal(entry.locale,'id');
  assert.equal(entry.offlineAllowed,true);
  assert.deepEqual(entry.seriesIds,['mission-quarterlies']);
  assert.deepEqual(entry.publicationPeriod,{type:'quarterly',year:2026,quarter:4,cadence:'weekly',startDate:'2026-10-03',endDate:'2026-12-26'});
  const suffix=entry.id.includes(':children:')?'children':'youth-adult';
  const edition=JSON.parse(fs.readFileSync(path.join(root,`content/id/mission-stories/2026-q4-${suffix}/edition.json`),'utf8'));
  assert.equal(edition.nodes.length,13);
  assert.ok(edition.nodes.every(node=>node.readingDate&&node.country));
  dateSets.push(edition.nodes.map(node=>node.readingDate));
 }
 assert.deepEqual(dateSets[0],dateSets[1]);
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
  const loveEditions=result.catalog.filter(entry=>entry.id.startsWith('edition:love-under-fire:'));
  assert.deepEqual(loveEditions.map(entry=>entry.seriesIds),[['sample-series'],['sample-series']]);
  const missionEditions=result.catalog.filter(entry=>entry.id.startsWith('edition:mission-stories:'));
  assert.equal(missionEditions.length,2);
  assert.ok(missionEditions.every(entry=>entry.seriesIds.includes('mission-quarterlies')));
  const work=JSON.parse(fs.readFileSync(workPath,'utf8'));
  work.seriesIds=['unknown-series'];
  fs.writeFileSync(workPath,JSON.stringify(work,null,2)+'\n');
  assert.throws(()=>build(tmp,{write:false}),/Unknown series unknown-series/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
});
test('unsafe and missing source paths are rejected',()=>{assert.throws(()=>safeFile(root,'../secret'));assert.throws(()=>safeFile(root,'C:/secret'));assert.throws(()=>safeFile(root,'missing.md'))});
test('contract tampering is detected',()=>{const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sabatku-contract-test-'));try{fs.cpSync(path.join(root,'contracts'),path.join(tmp,'contracts'),{recursive:true});fs.copyFileSync(path.join(root,'repository.json'),path.join(tmp,'repository.json'));fs.appendFileSync(path.join(tmp,'contracts/digital-content.schema.json'),' ');assert.throws(()=>build(tmp,{write:false}),/Contract snapshot changed/)}finally{fs.rmSync(tmp,{recursive:true,force:true})}});
