// Two actual production outputs, stable origin, natural activation and target-wide offline.
import assert from 'node:assert/strict'
import { cp, mkdir, readFile, writeFile, readdir, rename, rm, symlink } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildServiceWorker } from './build-service-worker.mjs'
const { Browser } = await import(pathToFileURL(process.env.GROCEA_CDP_MODULE))
const out=resolve('reports/next-phase/task-01-browser'), fixture=resolve('reports/next-phase/task-01-builds'), origin='http://127.0.0.1:5184'
await mkdir(out,{recursive:true});await rm(fixture,{recursive:true,force:true});await mkdir(fixture,{recursive:true})
const ids={}
for(const label of ['A','B']) {
 const directory=fixture+'/'+label;await cp('dist',directory,{recursive:true})
 let html=(await readFile(directory+'/index.html','utf8')).replace(/<meta name="grocea-build" content="[^"]+" \/>/g,'')
 const old=(await readdir(directory+'/assets')).find(x=>x.endsWith('.js'))
 const js=(await readFile(directory+'/assets/'+old,'utf8'))+`;globalThis.__groceaFixtureBuild=${JSON.stringify(label)};`
 const name='index-'+createHash('sha256').update(js).digest('hex').slice(0,12)+'.js'
 await writeFile(directory+'/assets/'+name,js);await rm(directory+'/assets/'+old);html=html.replace('/assets/'+old,'/assets/'+name);await writeFile(directory+'/index.html',html)
 ids[label]=await buildServiceWorker(directory);assert.equal(await buildServiceWorker(directory),ids[label],'repeat generation deterministic')
}
assert.notEqual(ids.A,ids.B)
await cp(fixture+'/B',fixture+'/C',{recursive:true})
const brokenId='broken-'+ids.B
let broken=(await readFile(fixture+'/C/sw.js','utf8')).replace(ids.B,brokenId).replace('const PRECACHE = [','const PRECACHE = ["/assets/missing-required.js",')
await writeFile(fixture+'/C/sw.js',broken)
await cp(fixture+'/B',fixture+'/M',{recursive:true});await writeFile(fixture+'/M/wrong-mime-fixture','synthetic');await writeFile(fixture+'/M/sw.js',(await readFile(fixture+'/B/sw.js','utf8')).replace(ids.B,'wrongmime-'+ids.B))
const current=fixture+'/current',outage=fixture+'/outage'
await symlink(fixture+'/A',current)
async function switchBuild(label){await symlink(fixture+'/'+label,fixture+'/next');await rename(fixture+'/next',current)}
const server=spawn('python3',['tools/serve-local-build.py','--port','5184','--build',current,'--api-outage-marker',outage],{stdio:['ignore','pipe','pipe']})
const sleep=ms=>new Promise(r=>setTimeout(r,ms)), results=[]
const wait=async(p,e,label)=>{const end=Date.now()+20000;while(Date.now()<end){if(await p.eval(e))return;await sleep(80)}throw Error('Timed out '+label)}
const click=(p,t)=>p.eval(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(t)});if(!e)throw Error('Missing '+${JSON.stringify(t)});e.click()})()`)
const field=(p,s,v)=>p.eval(`(()=>{const e=document.querySelector(${JSON.stringify(s)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(v)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
const navigate=(p,path)=>p.eval(`history.pushState({},'',${JSON.stringify(path)});window.dispatchEvent(new PopStateEvent('popstate'))`)
let browser, debugPage, offline=false
const sessions=new Map(), pendingSetups=new Set(), workerFailures=[]
async function configure(sessionId){await browser.send('Network.enable',{},sessionId,5000);await browser.send('Network.setCacheDisabled',{cacheDisabled:true},sessionId,5000);await browser.send('Network.emulateNetworkConditions',{offline,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId,5000)}
async function network(value,pages){
 offline=value
 for(const page of pages)await configure(page.sessionId)
 const live=new Set((await browser.send('Target.getTargets')).targetInfos.filter(t=>t.type==='service_worker').map(t=>t.targetId))
 const snapshot=[...sessions].filter(([target])=>live.has(target))
 for(const [target,sessionId] of snapshot)try{await configure(sessionId)}catch{sessions.delete(target)}
 await Promise.race([Promise.all([...pendingSetups]),sleep(6000).then(()=>{if(pendingSetups.size)throw Error('worker setup did not settle')})])
}

const version=p=>p.eval(`new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker handshake timed out')),5000);const channel=new MessageChannel();channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data.buildId)};navigator.serviceWorker.controller.postMessage({type:'GROCEA_SHELL_VERSION'},[channel.port2])})`)
try {
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/sw.js')).ok)break}catch{}await sleep(50)}
 browser=await Browser.launch()
 browser.on(undefined,'Target.attachedToTarget',event=>{
  if(event.targetInfo.type!=='service_worker')return
  sessions.set(event.targetInfo.targetId,event.sessionId)
  const task=(async()=>{try{await configure(event.sessionId);await browser.send('Runtime.runIfWaitingForDebugger',{},event.sessionId)}catch(e){workerFailures.push(String(e))}})()
  pendingSetups.add(task);void task.finally(()=>pendingSetups.delete(task))
 })
 await browser.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'service_worker',exclude:false},{exclude:true}]})
 const page=await browser.newPage({width:390,height:844,mobile:true});debugPage=page;await configure(page.sessionId);await page.goto(origin+'/login',{settleMs:100});const suffix=randomUUID()
 const uid=await page.eval(`fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'offline-${suffix}@example.com',password:'Synthetic-${suffix}',display_name:'Synthetic offline'})}).then(r=>r.json()).then(a=>a.account.id)`)
 await page.goto(origin+'/pantry',{settleMs:100});await wait(page,"!!document.querySelector('.pantry-view-tabs')",'first sync')
 await wait(page,"navigator.serviceWorker.ready.then(r=>r.active?.state==='activated')",'A installed')
 await page.send('Page.reload');await wait(page,"!!navigator.serviceWorker.controller && !!document.querySelector('.pantry-view-tabs')",'A controlled')
 assert.equal(await version(page),ids.A);assert.equal(await page.eval('globalThis.__groceaFixtureBuild'),'A')
 const other=await browser.newPage({width:768,height:900});await configure(other.sessionId);await other.goto(origin+'/pantry',{settleMs:100});await wait(other,"!!navigator.serviceWorker.controller",'second A tab');assert.equal(await version(other),ids.A)
 await page.eval("caches.open('unrelated-app-sentinel').then(c=>c.put('/sentinel',new Response('preserve-me')))")
 await navigate(page,'/trial');await wait(page,"!!document.querySelector('.trial-consent input')",'trial opt-in');assert(await page.eval("document.querySelector('.nav-item.active')?.textContent.includes('More')"),'More grouped selection')
 await page.eval("document.querySelector('.trial-consent input').click()");await click(page,'Start my trial');await wait(page,"document.body.innerText.includes('Recording is on')",'consent')
 await network(true,[page,other]);await navigate(page,'/profile');await wait(page,"!!document.querySelector('input[value=\"Synthetic offline\"]')",'profile')
 await field(page,'input[value="Synthetic offline"]','Synthetic offline B');await click(page,'Save changes')
 const queue=`new Promise(resolve=>{const r=indexedDB.open('grocea:${uid}');r.onsuccess=()=>{const db=r.result,tx=db.transaction('outbox'),q=tx.objectStore('outbox').getAll();q.onsuccess=()=>resolve(JSON.parse(JSON.stringify(q.result)));tx.oncomplete=()=>db.close()}})`
 await wait(page,`(async()=>(await (${queue})).length===1)()`,'offline durable mutation');const durable=rows=>rows.map(({id,type,payload,dependsOn})=>({id,type,payload,dependsOn}));const before=durable(await page.eval(queue))
 await writeFile(outage,'synthetic');await network(false,[page,other]);await switchBuild('B');await page.eval("navigator.serviceWorker.getRegistration().then(r=>r.update())")
 await wait(page,"navigator.serviceWorker.getRegistration().then(r=>!!r.waiting)",'B waiting');assert.equal(await version(page),ids.A);assert.equal(await version(other),ids.A)
 await page.send('Page.reload');await wait(page,"globalThis.__groceaFixtureBuild==='A'",'A reload while B waits');assert.equal(await version(page),ids.A)
 await wait(page,"document.body.innerText.includes('Update ready.')",'visible natural update guidance')
 assert(await page.eval("document.querySelector('.shell-update-notice').getBoundingClientRect().top >= document.querySelector('.brand-header,.back-header').getBoundingClientRect().bottom"),'notice below header')
 await page.setViewport({width:1440,height:900});await page.screenshot({path:out+'/update-waiting-1440.jpg',quality:85,fullPage:true});await page.setViewport({width:390,height:844,mobile:true})
 await page.screenshot({path:out+'/update-waiting-390.jpg',quality:85,fullPage:true})
 const aRepair=await page.eval(`(async()=>{const c=await caches.open('grocea-shell-${ids.A}');const old=await c.match('/index.html');const brand=await (await c.match('/brand/grocea-icon.png')).arrayBuffer();await c.delete('/index.html');const response=await new Promise((resolve,reject)=>{const ch=new MessageChannel();const t=setTimeout(()=>reject(Error('repair timeout')),5000);ch.port1.onmessage=e=>{clearTimeout(t);ch.port1.close();resolve(e.data)};navigator.serviceWorker.controller.postMessage({type:'GROCEA_SHELL_VERSION'},[ch.port2])});const result={complete:response.complete,indexAbsent:!(await c.match('/index.html')),brandPreserved:JSON.stringify([...new Uint8Array(brand)])===JSON.stringify([...new Uint8Array(await (await c.match('/brand/grocea-icon.png')).arrayBuffer())])};await c.put('/index.html',old);return result})()`)
 assert.deepEqual(aRepair,{complete:false,indexAbsent:true,brandPreserved:true})
 results.push('A index eviction while origin serves B: repair refuses mismatched generation and preserves remaining A entries; fixture restores saved exact A index before lifecycle continuation')
 await other.close();await page.close()
 // Keep no scoped document clients until B naturally activates. Inspect worker execution directly.
 let activeB=false;const end=Date.now()+20000
 while(Date.now()<end){for(const [target,session] of sessions){try{const r=await browser.send('Runtime.evaluate',{expression:`self.registration.active?.state==='activated' && self.registration.waiting===null && typeof BUILD_ID!=='undefined' && BUILD_ID===${JSON.stringify(ids.B)}`,returnByValue:true},session);if(r.result.value)activeB=true}catch{sessions.delete(target)}}if(activeB)break;await sleep(100)}
 assert(activeB,'B naturally activated after closing A tabs')
 const b=await browser.newPage({width:390,height:844,mobile:true});debugPage=b;await configure(b.sessionId);await b.goto(origin+'/pantry',{settleMs:100});await wait(b,"globalThis.__groceaFixtureBuild==='B' && !!document.querySelector('.pantry-view-tabs')",'B online adopted')
 assert.equal(await version(b),ids.B);assert.equal(await b.eval("document.querySelector('meta[name=grocea-build]').content"),ids.B)
 assert.deepEqual(durable(await b.eval(queue)),before);assert(await b.eval(`JSON.parse(localStorage.getItem('grocea:trial:${uid}')).active`))
 await network(true,[b])
 assert.equal(await b.eval("fetch('/network-only-sentinel').then(()=>false,()=>true)"),true,'page really offline')
 const targets=(await browser.send('Target.getTargets')).targetInfos.filter(x=>x.type==='service_worker'&&x.url.startsWith(origin))
 assert(targets.length)
 for(const target of targets){const session=sessions.get(target.targetId);assert(session,'worker autoattached');const probe=await browser.send('Runtime.evaluate',{expression:"fetch('/network-only-sentinel').then(()=>false,()=>true)",awaitPromise:true,returnByValue:true},session);assert.equal(probe.result.value,true,'worker really offline')}
 // Terminate running B worker so the offline reload must also survive a new target.
 await b.send('ServiceWorker.enable');await b.send('ServiceWorker.stopAllWorkers')
 await b.send('Page.reload');await wait(b,"globalThis.__groceaFixtureBuild==='B' && !!document.querySelector('.pantry-view-tabs')",'true offline B reload with restarted worker');assert.equal(await version(b),ids.B);assert.deepEqual(durable(await b.eval(queue)),before)
 await b.screenshot({path:out+'/offline-B-390.jpg',quality:85,fullPage:true})
 results.push('A→B natural waiting/activation; both old A tabs safe; true page+worker offline B deep reload including worker restart; pending queue and consent unchanged')
 await network(false,[b]);await rm(outage);await b.eval("window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('grocea:sync'))")
 await wait(b,`(async()=>!(await (${queue})).length)()`,'pending replay');assert.equal(await b.eval("fetch('/api/state').then(r=>r.json()).then(s=>s.profile.display_name)"),'Synthetic offline B')
 console.log('PASS lifecycle/offline; replay complete')
 // Exercise private/API and unrelated GETs. No response should enter CacheStorage.
 await b.eval("Promise.all(['/api','/api/auth/session','/api/state','/api/account/export','/unknown-private-json'].map(p=>fetch(p,{signal:AbortSignal.timeout(3000)}).catch(()=>null)))")
 await b.eval("fetch('http://127.0.0.1:8030/not-private-fixture',{mode:'no-cors',signal:AbortSignal.timeout(3000)}).catch(()=>null)")
 const privatePage=await browser.newPage();await privatePage.goto(origin+'/api/account/export',{settleMs:100});await privatePage.close()
 console.log('Privacy requests completed')
 const inventory=await b.eval(`(async()=>{const result=[];for(const key of await caches.keys()){const c=await caches.open(key);result.push({key,urls:(await c.keys()).map(x=>x.url)})}return result})()`)
 const shell=inventory.find(x=>x.key==='grocea-shell-'+ids.B);assert(shell);assert(shell.urls.length===21);assert(shell.urls.every(x=>new URL(x).origin===origin&&!new URL(x).pathname.startsWith('/api')&&!x.includes('unknown')))
 assert(!inventory.some(x=>x.key==='grocea-shell-'+ids.A));assert(await b.eval("caches.open('unrelated-app-sentinel').then(c=>c.match('/sentinel')).then(r=>r.text()).then(t=>t==='preserve-me')"))
 console.log('Privacy inventory complete')
 // Evict just public shell: kitchen DB/outbox/consent must survive and repair.
 await network(true,[b]);await b.eval(`caches.delete('grocea-shell-${ids.B}')`)
 await b.eval("navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))")
 await wait(b,"document.body.innerText.includes('App download incomplete.')",'cache loss unavailable')
 assert.deepEqual(await b.eval(queue),[])
 assert(await b.eval(`JSON.parse(localStorage.getItem('grocea:trial:${uid}')).active`))
 assert(await b.eval("document.querySelector('.shell-update-notice').getBoundingClientRect().top >= document.querySelector('.brand-header,.back-header').getBoundingClientRect().bottom"))
 await b.screenshot({path:out+'/cache-unavailable-390.jpg',quality:85,fullPage:true});await b.setViewport({width:1440,height:900});await b.screenshot({path:out+'/cache-unavailable-1440.jpg',quality:85,fullPage:true});await b.setViewport({width:390,height:844,mobile:true})
 await network(false,[b]);await b.eval("window.dispatchEvent(new Event('online'))")
 await wait(b,"!document.body.innerText.includes('App download incomplete.')",'bounded exact-public repair')
 assert.equal((await b.eval(`caches.open('grocea-shell-${ids.B}').then(c=>c.keys()).then(k=>k.length)`)),21)
 results.push('deleted public shell produces honest unavailable status offline; exact inventory repaired on reconnect; IndexedDB/consent retained')
 await switchBuild('M');await b.eval("(async()=>{const r=await navigator.serviceWorker.getRegistration();window.failedMime=false;r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',e=>{if(e.target.state==='redundant')window.failedMime=true}));await r.update()})()")
 await wait(b,'window.failedMime','wrong MIME installation rejected');assert.equal(await version(b),ids.B);assert(!await b.eval(`caches.has('grocea-shell-wrongmime-${ids.B}')`))
 results.push('200 application/json for required JavaScript rejects update and retains B')
 await switchBuild('C');await b.eval("(async()=>{const r=await navigator.serviceWorker.getRegistration();window.failedInstall=false;r.addEventListener('updatefound',()=>r.installing?.addEventListener('statechange',e=>{if(e.target.state==='redundant')window.failedInstall=true}));await r.update()})()")
 await wait(b,'window.failedInstall','failed partial install');assert.equal(await version(b),ids.B);assert(!await b.eval(`caches.has('grocea-shell-${brokenId}')`));await network(true,[b]);await b.send('Page.reload');await wait(b,"globalThis.__groceaFixtureBuild==='B'",'B retained after failed C')
 results.push('failed partial install removed partial cache and retained active B; API/auth/export navigation/cross-origin/unknown requests absent from CacheStorage; unrelated cache retained; pending profile replayed')
 assert.equal(workerFailures.length,0,workerFailures.join('\n'))
 await writeFile(out+'/offline-results.json',JSON.stringify({ids,results,inventory,workerRestartCovered:true,physicalDeviceInstall:false},null,2));console.log(JSON.stringify({passed:results.length,ids,results},null,2))
} catch(error) {try{console.log('DIAGNOSTIC',await debugPage.eval(`(async()=>{const r=await navigator.serviceWorker.getRegistration();return {text:document.body.innerText.slice(0,700),controller:!!navigator.serviceWorker.controller,active:r?.active?.state,installing:r?.installing?.state,waiting:r?.waiting?.state,caches:await caches.keys(),workerErrors:${JSON.stringify(workerFailures)}}})()`))}catch{}throw error} finally {if(browser)await browser.close();server.kill();await rm(outage,{force:true})}
