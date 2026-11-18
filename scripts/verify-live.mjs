import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const config=JSON.parse(await readFile(new URL('../preview.json',import.meta.url),'utf8'));
const root=path.resolve(process.argv[2]??'site'),url=new URL('https://quddha16-pixel.github.io'+config.base);
const expected=JSON.parse(await readFile(path.join(root,'preview-manifest.json'),'utf8'));
assert.equal(expected.commit,config.sourceCommit);
async function bytes(relative){
 if(relative.startsWith('/')||relative.includes('..')||/[?#\\]/.test(relative))throw Error('Invalid manifest path');
 const target=new URL(relative,url);target.searchParams.set('verify',config.sourceCommit);
 const r=await fetch(target,{cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error(`${relative}: HTTP ${r.status}`);
 if(new URL(r.url).origin!==url.origin)throw Error('Unexpected origin');
 return Buffer.from(await r.arrayBuffer());
}
let verified=false,last;
for(let attempt=0;attempt<18;attempt++){
 try{
  const info=JSON.parse((await bytes('build-info.json')).toString('utf8'));
  assert.equal(info.commit,config.sourceCommit);assert.equal(info.channel,'development');assert.equal(info.previewRepository,config.previewRepository);assert.equal(info.saveKey,config.saveKey);
  const manifest=JSON.parse((await bytes('preview-manifest.json')).toString('utf8'));assert.deepEqual(manifest,expected);
  for(const [relative,digest]of Object.entries(expected.files))assert.equal(createHash('sha256').update(await bytes(relative)).digest('hex'),digest,'Unexpected deployed bytes: '+relative);
  verified=true;break;
 }catch(error){last=error;if(attempt<17)await new Promise(resolve=>setTimeout(resolve,5000));}
}
if(!verified)throw last;
console.log(JSON.stringify({url:url.href,commit:config.sourceCommit,files:Object.keys(expected.files).length,https:true}));
