import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
const config=JSON.parse(await readFile(new URL('../preview.json',import.meta.url),'utf8'));
const {sourceCommit:GAME_SHA,previewRepository:PREVIEW_REPO,base:BASE,saveKey:SAVE_KEY}=config;
if(config.sourceRepository!=='quddha16-pixel/lottery-of-life'||PREVIEW_REPO!=='quddha16-pixel/lottery-of-life-preview'||!/^[0-9a-f]{40}$/.test(GAME_SHA)||BASE!=='/lottery-of-life-preview/'||SAVE_KEY!=='lottery-of-life-preview.save.v1')throw Error('Unexpected preview configuration.');
const source=path.resolve(process.argv[2]??'source');
if(process.env.GITHUB_REPOSITORY&&process.env.GITHUB_REPOSITORY!==PREVIEW_REPO)throw Error('This publisher belongs only to the separate preview repository.');
const head=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
if(head!==GAME_SHA)throw Error('Game checkout does not match the selected Phase 3C commit.');
execFileSync('git',['diff','--exit-code','HEAD','--'],{cwd:source});
const require=createRequire(path.join(source,'package.json'));
const {build}=await import(pathToFileURL(require.resolve('vite')).href);
let transformed=0;
await build({root:source,base:BASE,plugins:[{
 name:'separate-github-preview-save-namespace',enforce:'pre',
 transform(code,id){
  if(id.split('?')[0]!==path.join(source,'src/game/storage.ts'))return;
  const original='export const SAVE_KEY = "life-simulator.save.v1";';
  if(code.split(original).length!==2)throw Error('Save adapter changed: review preview isolation before publishing.');
  transformed++;
  return code.replace(original,`export const SAVE_KEY = ${JSON.stringify(SAVE_KEY)};`);
 }
}]});
if(transformed!==1)throw Error('Preview save isolation was not applied exactly once.');
execFileSync('git',['diff','--exit-code','HEAD','--'],{cwd:source});
const dist=path.join(source,'dist'),index=path.join(dist,'index.html');
let html=await readFile(index,'utf8');
const badge=`<aside data-development-preview role="note" style="padding:5px 8px;background:#35311e;color:#fff0bd;font:11px/1.4 system-ui,sans-serif;text-align:center"><strong>DEVELOPMENT</strong> · Not a production release<code data-source-commit style="display:block;font:11px/1.4 ui-monospace,SFMono-Regular,monospace;overflow-wrap:anywhere;user-select:all">${GAME_SHA}</code></aside><style>@media(max-width:760px){.wildlife-game .adventure-life .wildlife-scene{aspect-ratio:2.9}}</style>`;
html=html.replace('<title>Lottery of Life</title>','<title>DEVELOPMENT — Lottery of Life</title>').replace('<body>',`<body>${badge}`);
if(!html.includes(badge)||html.includes('"/lottery-of-life/assets/'))throw Error('Preview identity/base labeling failed.');
await writeFile(index,html);
await writeFile(path.join(dist,'.nojekyll'),'');
await writeFile(path.join(dist,'build-info.json'),JSON.stringify({channel:'development',commit:GAME_SHA,sourceRepository:'quddha16-pixel/lottery-of-life',previewRepository:PREVIEW_REPO,base:BASE,saveKey:SAVE_KEY,backupKey:SAVE_KEY+'.backup',toolingCommit:process.env.GITHUB_SHA??'local-validation'},null,2)+'\n');
const files={};
async function inventory(dir,prefix=''){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const relative=prefix+entry.name;
  if(entry.isDirectory())await inventory(path.join(dir,entry.name),relative+'/');
  else if(relative!=='.nojekyll') files[relative]=createHash('sha256').update(await readFile(path.join(dir,entry.name))).digest('hex');
 }
}
await inventory(dist);
await writeFile(path.join(dist,'preview-manifest.json'),JSON.stringify({commit:GAME_SHA,files},null,2)+'\n');
console.log(JSON.stringify({commit:GAME_SHA,base:BASE,saveKey:SAVE_KEY,files:Object.keys(files).length}));
