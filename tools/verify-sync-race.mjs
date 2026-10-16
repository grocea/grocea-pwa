import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { Browser } = await import(pathToFileURL(process.env.GROCEA_CDP_MODULE))
const mode=process.env.GROCEA_RACE_MODE ?? 'fetch'
const browser = await Browser.launch(), origin = 'http://127.0.0.1:5184'
const wait = async(p,e,label) => { const end=Date.now()+15000; while(Date.now()<end){if(await p.eval(e))return;await new Promise(r=>setTimeout(r,80))}throw Error(label) }
const click=(p,t)=>p.eval(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(t)});if(!e)throw Error('Missing action');e.click()})()`)
const field=(p,s,v)=>p.eval(`(()=>{const e=document.querySelector(${JSON.stringify(s)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(v)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
try {
 const p=await browser.newPage({width:390,height:844});await p.goto(origin+'/login',{settleMs:100});const id=randomUUID()
 const uid=await p.eval(`fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'race-${id}@example.com',password:'Synthetic-${id}',display_name:'Synthetic race'})}).then(r=>r.json()).then(a=>a.account.id)`)
 await p.goto(origin+'/groceries',{settleMs:100});await wait(p,"document.body.innerText.includes('Start shopping list')",'groceries');await click(p,'Start shopping list');await wait(p,"document.body.innerText.includes('Your shopping list is ready')",'list');const listPath=await p.eval('location.pathname');await p.eval("history.pushState({},'','/sync-issues');window.dispatchEvent(new PopStateEvent('popstate'))");await wait(p,"document.body.innerText.includes('Retry now') || document.body.innerText.includes('The local cache and Grocea service are up to date.')",'retry or idle');if(await p.eval("document.body.innerText.includes('Retry now')"))await click(p,'Retry now');await wait(p,"document.body.innerText.includes('The local cache and Grocea service are up to date.')",'settled list');await p.eval(`history.pushState({},'',${JSON.stringify(listPath)});window.dispatchEvent(new PopStateEvent('popstate'))`);await click(p,'Add item');await wait(p,"!!document.querySelector('.grocery-item-editor')",'editor');await field(p,'.grocery-item-editor input[maxlength="120"]','Synthetic race item');await click(p,'Add item');await wait(p,"!!document.querySelector('.grocery-check input')",'item');
 const queue=`new Promise(resolve=>{const r=indexedDB.open('grocea:${uid}');r.onsuccess=()=>{const d=r.result,t=d.transaction('outbox'),q=t.objectStore('outbox').getAll();q.onsuccess=()=>resolve(q.result);t.oncomplete=()=>d.close()}})`
 await p.eval("window.dispatchEvent(new Event('grocea:sync'))");await wait(p,`(async()=>!(await (${queue})).length)()`,'initial drain');await new Promise(r=>setTimeout(r,250))
 await p.eval(`(()=>{const original=window.fetch.bind(window);window.originalFetch=original;window.holdItem=true;window.fetch=async(...args)=>{const path=String(args[0]);if(path.includes('/items/')&&window.holdItem && args[1]?.method==='PUT')throw new TypeError('Synthetic held mutation');const r=await original(...args);if(path==='/api/state'&&!window.heldState){window.heldState=true;return await new Promise(resolve=>window.releaseState=()=>resolve(r))}return r};window.dispatchEvent(new Event('grocea:sync'))})()`)
 await wait(p,"typeof window.releaseState==='function'",'held actual state');
 if(mode==='queued') {
  // Hold the local outbox read before its write transaction is created.
  await p.eval(`(()=>{const native=IDBRequest.prototype.addEventListener;let armed=true;IDBRequest.prototype.addEventListener=function(type,fn,options){if(armed&&type==='success'&&this.source?.name==='by-created-at'){armed=false;return native.call(this,type,event=>{window.releaseLocalRead=()=>fn.call(this,event)},options)}return native.call(this,type,fn,options)}})()`)
  await p.eval("document.querySelector('.grocery-check input').click()");await wait(p,"typeof window.releaseLocalRead==='function'",'queued local intent before durability');
  assert.equal((await p.eval(queue)).length,0,'queued local intent not durable yet');await p.eval('window.releaseState()');await p.eval('window.releaseLocalRead()');
 } else if(mode==='adoption') {
  // IDB commits for real; hold completion delivery to keep adoption in flight.
  await p.eval(`(()=>{const native=IDBTransaction.prototype.addEventListener;let armed=true;IDBTransaction.prototype.addEventListener=function(type,fn,options){if(armed&&type==='complete'&&this.objectStoreNames.contains('canonical')&&this.objectStoreNames.contains('outbox')){armed=false;return native.call(this,type,event=>{window.releaseAdoption=()=>fn.call(this,event)},options)}return native.call(this,type,fn,options)}})()`)
  await p.eval('window.releaseState()');await wait(p,"typeof window.releaseAdoption==='function'",'canonical persistence in flight');await p.eval("document.querySelector('.grocery-check input').click()");await p.eval('window.releaseAdoption()');
 } else {
  if(mode==='retry') {await p.eval("history.pushState({},'','/sync-issues');window.dispatchEvent(new PopStateEvent('popstate'))");await wait(p,"document.body.innerText.includes('Retry now')",'retry during held sync');await click(p,'Retry now');await p.eval(`history.pushState({},'',${JSON.stringify(listPath)});window.dispatchEvent(new PopStateEvent('popstate'))`)}
  await p.eval("document.querySelector('.grocery-check input').click()");await wait(p,"!!document.querySelector('.grocery-item.checked')",'local checked');await wait(p,`(async()=>(await (${queue})).length>0)()`,'durable check');await p.eval('window.releaseState()');
 }
 if(!process.env.EXPECT_RACE)await wait(p,"!!document.querySelector('.grocery-item.checked')",'local checked survives');
 await wait(p,"!document.querySelector('.sync-indicator.syncing')",'sync finished')
 const observed={checked:await p.eval("!!document.querySelector('.grocery-item.checked')"),queue:await p.eval(`(async()=>(await (${queue})).map(x=>({type:x.type,checked:x.payload.item?.checked})))()`)}
 await mkdir('reports/next-phase/task-01-browser',{recursive:true});await writeFile(`reports/next-phase/task-01-browser/race-${process.env.EXPECT_RACE?'before':'after'}-${mode}.json`,JSON.stringify(observed,null,2))
 if(process.env.EXPECT_RACE){assert.equal(observed.checked,false,'baseline overwritten checked state');console.log('REPRODUCED durable check with rolled-back UI',observed)}else{assert(observed.checked,'checked state must survive stale snapshot');assert(observed.queue.some(x=>x.checked));console.log('PASS '+mode+' preserves check',observed);await p.eval("window.holdItem=false;window.dispatchEvent(new Event('grocea:sync'))");await wait(p,`(async()=>!(await (${queue})).length)()`,'eventual check ACK');assert(await p.eval("fetch('/api/state').then(r=>r.json()).then(s=>s.grocery_lists.some(l=>l.items.some(i=>i.label==='Synthetic race item'&&i.checked)))"),'server checked exactly after replay')}
} catch(error) {const targets=(await browser.send('Target.getTargets')).targetInfos;console.log('RACE FAILURE',mode,targets.filter(x=>x.type==='page').map(x=>x.url));throw error} finally { await browser.close() }
