import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
const {sourceCommit:GAME_SHA,base:BASE,saveKey:KEY}=JSON.parse(await readFile(new URL('../preview.json',import.meta.url),'utf8'));
const source=path.resolve(process.argv[2]??'source'),live=process.argv[3];
const require=createRequire(path.join(source,'package.json')), {chromium}=require('@playwright/test');
const root=path.join(source,'dist'), failures=[];
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith(BASE)){res.writeHead(404).end();return;}
  const relative=decodeURIComponent(url.pathname.slice(BASE.length))||'index.html',file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  const bytes=await readFile(file);
  res.writeHead(200,{'content-type':types[path.extname(file)]??'application/octet-stream'});res.end(bytes);
 }catch{res.writeHead(404).end();}
});
if(!live)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=live?new URL(BASE,live):new URL(`http://127.0.0.1:${server.address().port}${BASE}`);
if(live&&(base.protocol!=='https:'||base.hostname!=='quddha16-pixel.github.io'))throw Error('Use the dedicated HTTPS GitHub preview URL.');
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH??(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)});
try{
 const context=await browser.newContext({viewport:{width:390,height:664},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 await context.addInitScript(()=>{
  if(!localStorage.getItem('preview-isolation-test-started')){
   localStorage.setItem('life-simulator.save.v1','production-save-sentinel');
   localStorage.setItem('life-simulator.save.v1.backup','production-backup-sentinel');
   localStorage.setItem('preview-isolation-test-started','yes');
  }
 });
 const page=await context.newPage();
 page.on('pageerror',e=>failures.push(e.message));
 page.on('request',r=>{const u=new URL(r.url());if(u.origin!==base.origin||u.pathname.startsWith('/lottery-of-life/'))failures.push('Unexpected request: '+u.href);});
 page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname!=='/favicon.ico')failures.push(`${r.status()} ${r.url()}`);});
 await page.goto(base.href);await page.getByRole('button',{name:'New Life',exact:true}).waitFor();
 assert.equal((await page.locator('[data-source-commit]').innerText()).trim(),GAME_SHA);
 await page.getByRole('button',{name:'New Life',exact:true}).click();
 await page.getByRole('button',{name:'Choose species',exact:true}).click();
 await page.getByLabel('Unlocked species').selectOption('wolf');
 await page.getByText('World seed & historical scope',{exact:true}).click();
 await page.getByRole('textbox',{name:'World seed'}).fill('audit-new-wolf');
 for(const label of ['Reveal species','Reveal birthplace','Reveal birth date','Reveal circumstances','Begin Life'])await page.getByRole('button',{name:label,exact:true}).click();
 await page.getByRole('main',{name:'Active life'}).waitFor();await page.evaluate(()=>document.fonts.ready);
 const controls=await page.locator('.rpg-decisions .game-action:visible, .rpg-decisions .next-moment:visible').evaluateAll(xs=>xs.slice(0,2).map(x=>({label:x.innerText,bottom:x.getBoundingClientRect().bottom,height:x.getBoundingClientRect().height})));
 const nav=page.getByRole('navigation',{name:'Gameplay navigation'}),top=await nav.evaluate(x=>x.getBoundingClientRect().top);
 assert.equal(controls.length,2);for(const c of controls){assert.ok(c.bottom<top,`${c.label} is hidden by navigation`);assert.ok(c.height>=44);}
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
 const inspect=page.getByRole('button',{name:/^Inspect /});await inspect.focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.ok(await inspect.evaluate(x=>x===document.activeElement));
 await nav.getByRole('button',{name:'Explore',exact:true}).click();await page.getByRole('button',{name:/River bend/}).click();
 assert.match(await page.getByRole('dialog').innerText(),/Too young/);await page.keyboard.press('Escape');await nav.getByRole('button',{name:'Life',exact:true}).click();
 await page.getByRole('button',{name:/^Seek food from your mother/}).click();
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);assert.notDeepEqual(after,before);
 await page.reload();await page.getByRole('main',{name:'Active life'}).waitFor();
 assert.ok(isDeepStrictEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY),after));
 assert.equal(await page.evaluate(()=>localStorage.getItem('life-simulator.save.v1')),'production-save-sentinel');
 assert.equal(await page.evaluate(()=>localStorage.getItem('life-simulator.save.v1.backup')),'production-backup-sentinel');
 const info=await page.evaluate(async()=>await(await fetch('build-info.json',{cache:'no-store'})).json());
 assert.equal(info.commit,GAME_SHA);assert.equal(info.channel,'development');assert.equal(info.base,BASE);assert.equal(info.saveKey,KEY);
 const expected=JSON.parse(await readFile(path.join(root,'preview-manifest.json'),'utf8'));
 const actual=await page.evaluate(async()=>await(await fetch('preview-manifest.json',{cache:'no-store'})).json());assert.deepEqual(actual,expected);
 for(const [relative,digest]of Object.entries(expected.files)){
  const bytes=await page.evaluate(async relative=>{const r=await fetch(relative,{cache:'no-store'});if(!r.ok)throw Error('Asset HTTP '+r.status);return Array.from(new Uint8Array(await r.arrayBuffer()));},relative);
  assert.equal(createHash('sha256').update(Buffer.from(bytes)).digest('hex'),digest,'Deployed bytes differ: '+relative);
 }
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/github-preview-mobile.png',animations:'disabled'});
 assert.deepEqual(failures,[]);
 console.log(JSON.stringify({url:base.href,commit:GAME_SHA,checkedFiles:Object.keys(expected.files).length,controls,navTop:top,productionStorageUntouched:true,previewReload:true,https:base.protocol==='https:'}));
}finally{await browser.close();if(server.listening)await new Promise(resolve=>server.close(resolve));}
