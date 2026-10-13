import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
async function files(dir,prefix='') {
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const name=prefix+entry.name;
    if(entry.isDirectory())result.push(...await files(join(dir,entry.name),name+'/'));
    else if(name!=='sw.js')result.push(name);
  }
  return result.sort();
}
const all=await files(dist);
const hash=createHash('sha256');
for(const name of all)hash.update(name).update(await readFile(join(dist,name)));
const version=hash.digest('hex').slice(0,16);
const core=all.filter(name=>!name.startsWith('ai/'));
// Only shipped static resources can enter Cache Storage. Local video URLs,
// requests with queries, external URLs and all writes remain untouched.
const source=`const VERSION=${JSON.stringify(version)};
const CORE=${JSON.stringify(core)};
const FILES=${JSON.stringify(all)};
const BASE=new URL(self.registration.scope);
const PREFIX='form-pwa-'+encodeURIComponent(BASE.pathname)+'-';
const CACHE=PREFIX+VERSION;
const urls=new Set(FILES.map(path=>new URL(path,BASE).href));
const index=new URL('index.html',BASE).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try { await cache.addAll(CORE.map(path=>new Request(new URL(path,BASE),{cache:'reload'}))); }
  catch(error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  // Keep the previous build for tabs that are still running it.
  const old=(await caches.keys()).filter(key=>key.startsWith(PREFIX)&&key!==CACHE);
  await Promise.all(old.slice(0,-1).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>{
  if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==BASE.origin||url.search||request.headers.has('range'))return;
  const navigation=request.mode==='navigate'&&(url.pathname===BASE.pathname||url.href===index);
  const oldAsset=url.pathname.startsWith(BASE.pathname+'assets/');
  if(!navigation&&!urls.has(url.href)&&!oldAsset)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    const key=navigation?index:request;
    const saved=await cache.match(key);
    if(saved)return saved;
    if(oldAsset)for(const name of (await caches.keys()).filter(name=>name.startsWith(PREFIX)&&name!==CACHE)){
      const previous=await (await caches.open(name)).match(request);if(previous)return previous;
    }
    const response=await fetch(request);
    if(urls.has(url.href)&&response.ok&&!response.redirected&&response.type==='basic')await cache.put(request,response.clone()).catch(()=>{});
    return response;
  })());
});
`;
await writeFile(join(dist,'sw.js'),source);
console.log(`PWA ${version}: ${core.length} core files; AI assets cached only when used.`);
