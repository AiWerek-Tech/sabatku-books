import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const MAX_CHAPTER_BYTES=2*1024*1024;
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
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
 const themes=new Set(taxonomy.themes.map(x=>x.id)),collections=new Set(taxonomy.collections.map(x=>x.id)),audiences=new Set(taxonomy.audiences.map(x=>x.id));
 const documents=files(path.join(base,'content')).filter(p=>p.endsWith('.json')).map(p=>{const data=read(p);if(!validate(data))throw Error(p+': '+ajv.errorsText(validate.errors));return {data,base:path.dirname(p)}});
 const ids=new Set();for(const {data:d}of documents){if(ids.has(d.id))throw Error('Duplicate identity '+d.id);ids.add(d.id)}
 const works=new Map(documents.filter(x=>x.data.kind==='work').map(x=>[x.data.id,x.data]));
 const providers=new Map(documents.filter(x=>x.data.kind==='provider').map(x=>[x.data.id,x.data]));
 const editions=new Map(documents.filter(x=>x.data.kind==='edition').map(x=>[x.data.id,x.data]));
 const outputs=new Map(),catalog=[];const destinations=new Set();
 const externalEditionIds=new Set();for(const {data:d}of documents.filter(x=>x.data.kind==='edition')){const locales=new Set([d.locale]);for(const external of d.externalEditions||[]){if(ids.has(external.id)||externalEditionIds.has(external.id))throw Error('Duplicate external edition identity '+external.id);externalEditionIds.add(external.id);if(locales.has(external.locale))throw Error(`${d.id}: duplicate edition locale ${external.locale}`);locales.add(external.locale);const sourceUrls=new Set();for(const source of external.sources){let url;try{url=new URL(source.url)}catch{throw Error(`${external.id}: invalid source URL`)}if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw Error(`${external.id}: external source must use HTTPS without credentials`);if(sourceUrls.has(url.href))throw Error(`${external.id}: duplicate external source URL`);sourceUrls.add(url.href)}if(!external.sources.some(source=>source.kind==='online-text'))throw Error(`${external.id}: an external text edition needs an online-text source`);if(external.sources.filter(source=>source.primary).length>1)throw Error(`${external.id}: only one source may be primary`);}}
 const put=(p,v)=>{if(outputs.has(p))throw Error('Duplicate output '+p);outputs.set(p,Buffer.isBuffer(v)?v:Buffer.from(typeof v==='string'?v:JSON.stringify(v,null,2)+'\n'))};
 const refCheck=(d)=>{for(const t of d.themeIds||[])if(!themes.has(t))throw Error('Unknown theme '+t);if(d.primaryThemeId&&!d.themeIds.includes(d.primaryThemeId))throw Error('Primary theme missing from themeIds');for(const t of d.collectionIds||[])if(!collections.has(t))throw Error('Unknown collection '+t);for(const t of d.audienceIds||[])if(!audiences.has(t))throw Error('Unknown audience '+t)};
 const asset=(source,rel,dest)=>{const bytes=fs.readFileSync(safeFile(source,rel));put(dest,bytes);return {path:dest,bytes:bytes.length,sha256:hash(bytes)}};
 for(const {data:d,base:source}of documents){
  if(config.domain==='books'&&!['work','edition','reading-plan'].includes(d.kind))throw Error('Wrong domain document '+d.kind);
  if(config.domain==='publications'&&!['provider','publication'].includes(d.kind))throw Error('Wrong domain document '+d.kind);
  refCheck(d);
  if(d.kind==='edition'){
   if(!works.has(d.workId))throw Error('Missing work '+d.workId);
   const nodeIds=new Set(d.nodes.map(n=>n.id));if(nodeIds.size!==d.nodes.length)throw Error('Duplicate node');
   for(const n of d.nodes)if(n.parentId&&!nodeIds.has(n.parentId))throw Error('Missing parent node');
   for(const n of d.nodes){const seen=new Set([n.id]);let p=n.parentId;while(p){if(seen.has(p))throw Error('TOC cycle');seen.add(p);p=d.nodes.find(x=>x.id===p).parentId}}
   if(d.cover)safeFile(source,d.cover);
   for(const n of d.nodes){const body=fs.readFileSync(safeFile(source,n.file));if(!body.length||body.length>MAX_CHAPTER_BYTES)throw Error('Chapter is empty or exceeds the 2 MiB reader limit');textSafe(body.toString('utf8'))}
   if(d.status!=='published')continue;
   if(!['verified','public-domain'].includes(d.rights.status)||!d.nodes.length||!d.cover)throw Error('Published edition needs approved rights, cover and content');
   const prefix='editions/'+d.key+'/revisions/'+d.revision;if(destinations.has(prefix))throw Error('Output collision');destinations.add(prefix);
   const nodes=d.nodes.map(n=>({id:n.id,title:n.title,parentId:n.parentId,order:n.order,content:asset(source,n.file,prefix+'/nodes/'+n.id.replaceAll(':','-')+'.md')}));
   const cover=asset(source,d.cover,prefix+'/assets/cover'+path.extname(d.cover));
   const manifest={schemaVersion:'sabatku-library-v1',edition:d,work:works.get(d.workId),cover,nodes,capabilities:['markdown-chapters','online-reading'],offlineRedistributionAllowed:d.rights.offlineAllowed};
   put(prefix+'/manifest.json',manifest);catalog.push({id:d.id,workId:d.workId,title:d.title,author:works.get(d.workId).author,locale:d.locale,revision:d.revision,contentMode:'hosted',themeIds:d.themeIds,collectionIds:d.collectionIds,manifest:prefix+'/manifest.json',cover});
   for(const external of d.externalEditions||[]){const primary=external.sources.find(source=>source.primary)||external.sources.find(source=>source.kind==='online-text')||external.sources[0];catalog.push({id:external.id,workId:d.workId,title:external.title,author:works.get(d.workId).author,locale:external.locale,revision:d.revision,contentMode:'external-link',providerId:external.providerId,sourceUrl:primary.url,sources:external.sources,themeIds:d.themeIds,collectionIds:d.collectionIds,manifest:null,cover});}
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
 put('index.html','<!doctype html><meta charset="utf-8"><title>'+config.name+'</title><h1>'+config.name+'</h1><p>Public content catalog · '+catalog.length+' published entries</p><a href="catalog.json">Catalog JSON</a>');
 if(write){const out=path.join(base,'public');fs.mkdirSync(out,{recursive:true});for(const [p,b]of outputs){const f=path.join(out,p);if(fs.existsSync(f)&&/\/revisions\//.test(p)&&!fs.readFileSync(f).equals(b))throw Error('Immutable revision modified: '+p)}for(const [p,b]of [...outputs].sort(([a],[b])=>(a==='catalog.json')-(b==='catalog.json'))){const f=path.join(out,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,b)}}
 return {documents:documents.length,published:catalog.length,files:outputs.size};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(build(root,{write:!process.argv.includes('--check')})))}catch(e){console.error(e.message);process.exitCode=1}}
