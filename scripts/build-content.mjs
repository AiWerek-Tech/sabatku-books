import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import {validateEditionQuality,validateBookCover} from './edition-quality.mjs';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const MAX_CHAPTER_BYTES=2*1024*1024;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const notePattern=/^\[\^([^\]]+)\]:\s*(.*)$/;
function splitChapter(markdown,id){
 const lines=markdown.replace(/\r\n/g,'\n').split('\n'),notes=new Map(),body=[];let active=null;
 for(const line of lines){
  const match=notePattern.exec(line);
  if(match){active=match[1];if(notes.has(active))throw Error(`${id}: duplicate footnote ${active}`);notes.set(active,[match[2]]);continue;}
  if(active&&/^\s{2,}\S/.test(line)){notes.get(active).push(line.trim());continue;}
  active=null;body.push(line);
 }
 const sections=[];let current={title:null,lines:[]};
 for(const line of body){const heading=/^##\s+(.+?)\s*$/.exec(line.trim());if(heading){sections.push(current);current={title:heading[1],lines:[]};}else current.lines.push(line);}
 sections.push(current);
 const used=new Set();
 for(const section of sections){const text=section.lines.join('\n').trim();for(const match of text.matchAll(/\[\^([^\]]+)\]/g))used.add(match[1]);}
 for(const id of used)if(!notes.has(id))throw Error(`${id}: footnote ${id} is referenced but has no definition`);
 const render=section=>{
  const text=section.lines.join('\n').trim();if(!text)return '';
  const ids=[...new Set([...text.matchAll(/\[\^([^\]]+)\]/g)].map(match=>match[1]))];
  const definitions=ids.map(noteId=>`[^${noteId}]: ${notes.get(noteId).join(' ')}`);
  return [text,...definitions].join('\n\n');
 };
 const intro=render(sections[0]);
 const children=sections.slice(1).map((section,index)=>({title:section.title,body:render(section),index}));
 return {intro,children};
}
function nodeType(node){
 if(node.nodeType)return node.nodeType;
 if(/^chapter-[0-9]+/.test(node.id))return 'chapter';
 if(node.id==='appendix')return 'appendix';
 if(node.id==='glossary')return 'glossary';
 return 'front-matter';
}
function sectionSlug(value){
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'section';
}
export function safeFile(base,rel){
 if(typeof rel!=='string'||rel.includes('\\')||rel.includes(':')||path.isAbsolute(rel)||rel.split('/').includes('..')) throw Error('Unsafe path: '+rel);
 const full=path.resolve(base,rel), boundary=fs.realpathSync(base);
 if(!full.startsWith(path.resolve(base)+path.sep)) throw Error('Path escapes content directory');
 const real=fs.realpathSync(full);
 if(!real.startsWith(boundary+path.sep)||!fs.statSync(real).isFile()) throw Error('Unsafe file or symlink: '+rel);
 return real;
}
function files(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(e.isSymbolicLink())throw Error('Symlink source is not allowed');const p=path.join(dir,e.name);return e.isDirectory()?files(p):[p]})}
function textSafe(s){if(/<\s*(script|iframe|object|embed)\b|javascript\s*:|data\s*:\s*text\/html/i.test(s))throw Error('Unsafe active content')}
export function build(base=root,{write=true}={}){
 const config=read(path.join(base,'repository.json'));
 const pins=read(path.join(base,'contracts/lock.json'));
 for(const [name,digest]of Object.entries(pins.files))if(hash(fs.readFileSync(path.join(base,'contracts',name)))!==digest)throw Error('Contract snapshot changed: '+name);
 const schema=read(path.join(base,'contracts/digital-content.schema.json'));
 const ajv=new Ajv({allErrors:true,strict:false});formats(ajv);const validate=ajv.compile(schema);
 const taxonomy=read(path.join(base,'contracts/library-taxonomy.v1.json'));
 if(!validate(taxonomy))throw Error('Invalid taxonomy '+ajv.errorsText(validate.errors));
 const themes=new Set(taxonomy.themes.map(x=>x.id)),collections=new Set(taxonomy.collections.map(x=>x.id)),audiences=new Set(taxonomy.audiences.map(x=>x.id)),series=new Set(taxonomy.series.map(x=>x.id));
 const documents=files(path.join(base,'content')).filter(p=>p.endsWith('.json')).map(p=>{const data=read(p);if(!validate(data))throw Error(p+': '+ajv.errorsText(validate.errors));return {data,base:path.dirname(p)}});
 const ids=new Set();for(const {data:d}of documents){if(ids.has(d.id))throw Error('Duplicate identity '+d.id);ids.add(d.id)}
 const works=new Map(documents.filter(x=>x.data.kind==='work').map(x=>[x.data.id,x.data]));
 const providers=new Map(documents.filter(x=>x.data.kind==='provider').map(x=>[x.data.id,x.data]));
 const editions=new Map(documents.filter(x=>x.data.kind==='edition').map(x=>[x.data.id,x.data]));
 const outputs=new Map(),catalog=[];const destinations=new Set();
 const externalEditionIds=new Set();for(const {data:d}of documents.filter(x=>x.data.kind==='edition')){const locales=new Set([d.locale]);for(const external of d.externalEditions||[]){if(ids.has(external.id)||externalEditionIds.has(external.id))throw Error('Duplicate external edition identity '+external.id);externalEditionIds.add(external.id);if(locales.has(external.locale))throw Error(`${d.id}: duplicate edition locale ${external.locale}`);locales.add(external.locale);const sourceUrls=new Set();for(const source of external.sources){let url;try{url=new URL(source.url)}catch{throw Error(`${external.id}: invalid source URL`)}if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error(`${external.id}: external source must use HTTPS without credentials`);if(sourceUrls.has(url.href))throw Error(`${external.id}: duplicate external source URL`);sourceUrls.add(url.href)}if(!external.sources.some(source=>source.kind==='online-text'))throw Error(`${external.id}: an external text edition needs an online-text source`);if(external.sources.filter(source=>source.primary).length>1)throw Error(`${external.id}: only one source may be primary`);}}
 const put=(p,v)=>{if(outputs.has(p))throw Error('Duplicate output '+p);outputs.set(p,Buffer.isBuffer(v)?v:Buffer.from(typeof v==='string'?v:JSON.stringify(v,null,2)+'\n'))};
 const refCheck=(d)=>{for(const t of d.themeIds||[])if(!themes.has(t))throw Error('Unknown theme '+t);if(d.primaryThemeId&&!d.themeIds.includes(d.primaryThemeId))throw Error('Primary theme missing from themeIds');for(const t of d.collectionIds||[])if(!collections.has(t))throw Error('Unknown collection '+t);for(const t of d.audienceIds||[])if(!audiences.has(t))throw Error('Unknown audience '+t);for(const t of d.seriesIds||[])if(!series.has(t))throw Error('Unknown series '+t)};
 const asset=(source,rel,dest)=>{const bytes=fs.readFileSync(safeFile(source,rel));put(dest,bytes);return {path:dest,bytes:bytes.length,sha256:hash(bytes)}};
 for(const {data:d,base:source}of documents){
  if(config.domain==='books'&&!['work','edition','reading-plan'].includes(d.kind))throw Error('Wrong domain document '+d.kind);
  if(config.domain==='publications'&&!['provider','publication'].includes(d.kind))throw Error('Wrong domain document '+d.kind);
  refCheck(d);
  if(d.kind==='edition'){
   if(!works.has(d.workId))throw Error('Missing work '+d.workId);
   const sourceUrls=new Set();for(const source of d.sources||[]){let url;try{url=new URL(source.url)}catch{throw Error(`${d.id}: invalid source URL`)}if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error(`${d.id}: source must use HTTPS without credentials`);if(sourceUrls.has(url.href))throw Error(`${d.id}: duplicate source URL`);sourceUrls.add(url.href)}if(d.sources?.filter(source=>source.primary).length>1)throw Error(`${d.id}: only one source may be primary`);
   const nodeIds=new Set(d.nodes.map(n=>n.id));if(nodeIds.size!==d.nodes.length)throw Error('Duplicate node');
   for(const n of d.nodes)if(n.parentId&&!nodeIds.has(n.parentId))throw Error('Missing parent node');
   for(const n of d.nodes){const seen=new Set([n.id]);let p=n.parentId;while(p){if(seen.has(p))throw Error('TOC cycle');seen.add(p);p=d.nodes.find(x=>x.id===p).parentId}}
   if(d.cover)validateBookCover(fs.readFileSync(safeFile(source,d.cover)));
   validateEditionQuality(d,new Map(d.nodes.map(n=>[n.id,fs.readFileSync(safeFile(source,n.file))])),d.cover?fs.statSync(safeFile(source,d.cover)).size:0);
   for(const n of d.nodes){const body=fs.readFileSync(safeFile(source,n.file));if(!body.length||body.length>MAX_CHAPTER_BYTES)throw Error('Chapter is empty or exceeds the 2 MiB reader limit');textSafe(body.toString('utf8'))}
   if(d.status!=='published')continue;
   if(!['verified','public-domain'].includes(d.rights.status)||!d.nodes.length||!d.cover)throw Error('Published edition needs approved rights, cover and content');
   const prefix='editions/'+d.key+'/revisions/'+d.revision;if(destinations.has(prefix))throw Error('Output collision');destinations.add(prefix);
   const nodes=[];
   const addNode=(n,body,nodeKind)=>{
    let content;
    const notice="Konten buku ini masih dalam proses. Silakan kembali lagi nanti.";
    const pending=body.trim()===notice;
    const partial=!pending && body.includes(notice);
    const readingBody=partial?body.replaceAll(notice,"").trim():body;
    if(body.trim() && !pending){
     const bytes=Buffer.from(readingBody+'\n');if(bytes.length>MAX_CHAPTER_BYTES)throw Error(`${d.id}/${n.id}: chapter section exceeds the 2 MiB reader limit`);
     const output=prefix+'/nodes/'+n.id.replaceAll(':','-')+'.md';put(output,bytes);
     content={path:output,bytes:bytes.length,sha256:hash(bytes)};
    }
    const imagePath=`assets/${n.id}.jpg`;
    const illustration=fs.existsSync(path.join(source,imagePath))?asset(source,imagePath,prefix+'/'+imagePath):null;
    nodes.push({id:n.id,title:n.title,parentId:n.parentId,nodeType:nodeKind,order:n.order,...(pending?{availability:"pending"}:partial?{availability:"partial"}:{}),...(n.readingDate?{readingDate:n.readingDate}:{}),...(n.country?{country:n.country}:{}),...(content?{content}:{}),...(illustration?{illustration}:{})});
   };
   for(const n of d.nodes){
    const body=fs.readFileSync(safeFile(source,n.file),'utf8');
    if(nodeType(n)==='chapter'){
     const split=splitChapter(body,n.id);
     const hasIntroText=split.intro.split('\n').some(line=>line.trim()&&!/^#{1,6}\s/.test(line.trim())&&!/^(?:[-*_]\s*){3,}$/.test(line.trim()));
     addNode(n,split.children.length&&!hasIntroText?'':split.intro,'chapter');
     split.children.forEach((section,index)=>{
      if(!section.title)throw Error(`${d.id}/${n.id}: a chapter contains an empty section heading`);
      const id=`${n.id}:section-${sectionSlug(section.title)}-${index+1}`;
      addNode({id,title:section.title,parentId:n.id,order:index+1},section.body,'section');
     });
    }else addNode(n,body,nodeType(n));
   }
   const cover=asset(source,d.cover,prefix+'/assets/cover'+path.extname(d.cover));
   const manifest={schemaVersion:'sabatku-library-v1',edition:d,work:works.get(d.workId),cover,nodes,capabilities:['markdown-chapters','hierarchical-toc','footnotes','online-reading','offline-download'],offlineRedistributionAllowed:d.rights.offlineAllowed};
   put(prefix+'/manifest.json',manifest);catalog.push({id:d.id,workId:d.workId,title:d.title,description:d.description||'',author:works.get(d.workId).author,locale:d.locale,revision:d.revision,contentMode:'hosted',rightsStatus:d.rights.status,offlineAllowed:d.rights.offlineAllowed,sources:(d.sources||[]).map(source=>({...source,offlineAllowed:source.offlineAllowed===true})),primaryThemeId:d.primaryThemeId,themeIds:d.themeIds,collectionIds:d.collectionIds,audienceIds:d.audienceIds||[],seriesIds:works.get(d.workId).seriesIds||[],...(d.publicationPeriod?{publicationPeriod:d.publicationPeriod}:{}),manifest:prefix+'/manifest.json',cover});
   for(const external of d.externalEditions||[]){const primary=external.sources.find(source=>source.primary)||external.sources.find(source=>source.kind==='online-text')||external.sources[0];catalog.push({id:external.id,workId:d.workId,title:external.title,description:external.description||d.description||'',author:works.get(d.workId).author,locale:external.locale,revision:d.revision,contentMode:'external-link',providerId:external.providerId,sourceUrl:primary.url,sources:external.sources.map(source=>({...source,offlineAllowed:source.offlineAllowed===true})),primaryThemeId:d.primaryThemeId,themeIds:d.themeIds,collectionIds:d.collectionIds,audienceIds:d.audienceIds||[],seriesIds:works.get(d.workId).seriesIds||[],...(d.publicationPeriod?{publicationPeriod:d.publicationPeriod}:{}),manifest:null,cover});}
  }
  if(d.kind==='publication'){
   const provider=providers.get(d.providerId);if(!provider)throw Error('Missing provider');
   if(!provider.contentModes.includes(d.contentMode))throw Error('Provider mode not permitted');
   if(new URL(provider.canonicalUrl).hostname!==new URL(d.canonicalUrl).hostname)throw Error('Canonical source domain mismatch');
   if(d.updatedAt&&Date.parse(d.updatedAt)<Date.parse(d.publishedAt))throw Error('Updated timestamp precedes publication');
   if(d.summary)textSafe(d.summary);if(d.body)textSafe(fs.readFileSync(safeFile(source,d.body),'utf8'));
   if(d.status!=='published')continue;
   if(provider.status!=='verified'||!provider.verifiedAt||!provider.verificationNote)throw Error('Provider verification is required');
   if(!['verified','public-domain'].includes(d.rights.status))throw Error('Rights review required');
   if(d.contentMode==='approved-summary'&&!d.summary)throw Error('Summary required');
   if(d.contentMode==='licensed-fulltext'&&!d.body)throw Error('Full text required');
   if(d.contentMode==='external-link'&&(d.body||d.rights.offlineAllowed))throw Error('External links do not provide offline full text');
   const prefix='items/'+d.key+'/revisions/'+d.revision;if(destinations.has(prefix))throw Error('Output collision');destinations.add(prefix);
   const item={schemaVersion:'sabatku-publications-v1',...d,provider};if(d.body)item.body=asset(source,d.body,prefix+'/content.md');
   put(prefix+'/item.json',item);catalog.push({id:d.id,title:d.title,type:d.type,locale:d.locale,publishedAt:d.publishedAt,providerId:d.providerId,contentMode:d.contentMode,themeIds:d.themeIds,item:prefix+'/item.json'});
  }
 }
 const plans=documents.filter(x=>x.data.kind==='reading-plan').map(x=>x.data);
 for(const p of plans)for(const t of p.targets){const e=editions.get(t.editionId);if(!e||!e.nodes.some(n=>n.id===t.nodeId))throw Error('Broken reading target');}
 put('reading-plans.json',plans.filter(p=>p.targets.every(t=>editions.get(t.editionId)?.status==='published')));
 catalog.sort((a,b)=>a.id.localeCompare(b.id));
 put('catalog.json',{schemaVersion:config.domain==='books'?'sabatku-library-v1':'sabatku-publications-v1',domain:config.domain,revision:hash(Buffer.from(JSON.stringify(catalog))),entries:catalog,taxonomy:'taxonomy.json'});put('taxonomy.json',taxonomy);
 put('index.html','<!doctype html><meta charset="utf-8"><title>'+config.name+'</title><h1>'+config.name+'</h1><p>Public content catalog Â· '+catalog.length+' published entries</p><a href="catalog.json">Catalog JSON</a>');
 {const out=path.join(base,'public');for(const [p,b]of outputs){const f=path.join(out,p);if(fs.existsSync(f)&&/\/revisions\//.test(p)&&!fs.readFileSync(f).equals(b))throw Error('Immutable revision modified: '+p)}}
 if(write){const out=path.join(base,'public');fs.mkdirSync(out,{recursive:true});for(const [p,b]of [...outputs].sort(([a],[b])=>(a==='catalog.json')-(b==='catalog.json'))){const f=path.join(out,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,b)}}
 return {documents:documents.length,published:catalog.length,files:outputs.size,catalog:structuredClone(catalog)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const {catalog,...summary}=build(root,{write:!process.argv.includes('--check')});console.log(JSON.stringify(summary))}catch(e){console.error(e.message);process.exitCode=1}}
