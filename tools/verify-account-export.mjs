// Pending-work export and visible account-control captures using synthetic loopback data only.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const { Browser }=await import(pathToFileURL(process.env.GROCEA_CDP_MODULE));const browser=await Browser.launch()
const origin='http://127.0.0.1:5184',out='reports/next-phase/task-04-browser';await mkdir(out,{recursive:true});const results=[]
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function wait(p,expr,label){const end=Date.now()+18000;while(Date.now()<end){if(await p.eval(expr))return;await sleep(80)}throw Error('Timed out: '+label)}
const click=(p,text)=>p.eval(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing action');e.click()})()`)
const fill=(p,label,value)=>p.eval(`(()=>{const e=[...document.querySelectorAll('label')].find(e=>e.textContent.includes(${JSON.stringify(label)})).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
const workerSessions=[]
async function network(p,offline){
 await p.send('Network.enable')
 if(!workerSessions.length){const workers=(await browser.send('Target.getTargets')).targetInfos.filter(t=>t.type==='service_worker'&&t.url.startsWith(origin));assert(workers.length);for(const worker of workers){const{sessionId}=await browser.send('Target.attachToTarget',{targetId:worker.targetId,flatten:true});workerSessions.push(sessionId);await browser.send('Network.enable',{},sessionId)}}
 for(const sessionId of workerSessions)await browser.send('Network.emulateNetworkConditions',{offline,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId)
 await p.send('Network.emulateNetworkConditions',{offline,latency:0,downloadThroughput:-1,uploadThroughput:-1})
}

const password='Synthetic-'+randomUUID(),email='export-'+randomUUID()+'@example.com'
let fixture
try{
 const p=await browser.newPage({width:390,height:844});await p.goto(origin+'/login',{settleMs:100})
 fixture=await p.eval(`(async()=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:${JSON.stringify(email)},password:${JSON.stringify(password)},display_name:'Synthetic export check'})});const a=await r.json();return{uid:a.account.id,csrf:a.csrf_token}})()`)
 const ingredientId=randomUUID()
 for(const [method,path,body] of [['POST','/api/ingredients',{id:ingredientId,name:'Synthetic archived export context',category_id:null,measurement_family:'mass',track_in_pantry:false}],['DELETE','/api/ingredients/'+ingredientId,null]]){
  await p.eval(`(async()=>{const state=await fetch('/api/state').then(r=>r.json());const a=await fetch('/api/auth/session').then(r=>r.json());const body=${JSON.stringify(body)};if(body)body.category_id=state.categories[0].id;const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json','X-CSRF-Token':a.csrf_token,'Idempotency-Key':crypto.randomUUID(),'X-Device-ID':crypto.randomUUID(),'X-Expected-State-Revision':String(state.revision)},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('Archive fixture failed')})()`)
 }
 await p.goto(origin+'/profile',{settleMs:100});await wait(p,"document.body.innerText.includes('Your account data')",'profile');await wait(p,'!!navigator.serviceWorker.controller','service worker')
 const cookies=await p.send('Network.getCookies',{urls:[origin+'/api']});const cookie=cookies.cookies.find(c=>c.name==='grocea_session').value
 await network(p,true);await fill(p,'Display name','Synthetic local pending export');await click(p,'Save changes')
 await wait(p,"document.body.innerText.includes('Profile preferences saved.')",'offline durable profile edit')
 // A genuine second-device write changes the revision while the first page and worker are offline.
 const remote=await fetch('http://127.0.0.1:8000/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json','Cookie':'grocea_session='+cookie,'X-CSRF-Token':fixture.csrf,'Idempotency-Key':randomUUID(),'X-Device-ID':randomUUID()},body:JSON.stringify({display_name:'Synthetic remote export check'})});assert.equal(remote.status,200)
 // Hold this mutation endpoint unavailable while allowing online export; do not
 // mislabel this targeted fixture outage as whole-device offline behavior.
 await p.eval("(()=>{const original=window.fetch.bind(window);window.fetch=async(...args)=>{if(String(args[0]).endsWith('/api/profile')&&args[1]?.method==='PATCH')throw new TypeError('Synthetic mutation endpoint unavailable');const r=await original(...args);if(String(args[0]).endsWith('/api/account/export'))window.fixtureExport=await r.clone().json();return r}})()")
 await network(p,false);await p.eval("window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('grocea:sync'))")
 await wait(p,`new Promise(resolve=>{const r=indexedDB.open('grocea:${fixture.uid}');r.onsuccess=()=>{const db=r.result;const tx=db.transaction('outbox');const q=tx.objectStore('outbox').getAll();q.onsuccess=()=>resolve(q.result.length>0);tx.oncomplete=()=>db.close()}})`,'pending durable work')
 await browser.send('Browser.setDownloadBehavior',{behavior:'deny',eventsEnabled:true})
 await p.eval("document.querySelector('.account-data-controls').scrollIntoView({block:'start'})")
 await wait(p,"[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Export account data'&&!b.disabled)",'online export available');await click(p,'Export account data');await wait(p,"document.body.innerText.includes('Some local changes or import conflicts remain')",'pending export warning')
 assert(!await p.eval("'fixtureExport' in window"),'no server download before explicit exclusion')
 await p.screenshot({path:out+'/export-pending-390.jpg',quality:85})
 await click(p,'Export server data only');await wait(p,"document.body.innerText.includes('Server data exported.')",'explicit server-only export')
 assert.equal(await p.eval("window.fixtureExport.data.users[0].display_name"),'Synthetic remote export check')
 assert(await p.eval(`window.fixtureExport.data.ingredients.some(i=>i.id===${JSON.stringify(ingredientId)}&&i.archived_at)`))
 results.push('real offline profile edit plus targeted mutation-endpoint outage warn before download; explicit server-only snapshot excludes pending name, preserves second-device server edit and includes archive')
 await p.close()
 for(const width of [320,390,1440]){
  const q=await browser.newPage({width,height:900,mobile:width<600});await q.goto(origin+'/profile',{settleMs:100});await wait(q,"!!document.querySelector('.account-data-controls')",'data controls')
  await q.eval("document.querySelector('.account-data-controls').scrollIntoView({block:'start'})");await sleep(120)
  const bounds=await q.eval("(()=>{const c=document.querySelector('.account-data-controls'),page=document.querySelector('.app-page');return{controlWidth:c.scrollWidth,controlClient:c.clientWidth,pageWidth:page.scrollWidth,pageClient:page.clientWidth,documentWidth:document.documentElement.scrollWidth}})()")
  assert(bounds.controlWidth<=bounds.controlClient&&bounds.pageWidth<=bounds.pageClient&&bounds.documentWidth<=width)
  await q.screenshot({path:out+'/data-controls-visible-'+width+'.jpg',quality:85})
  await click(q,'Delete account…');await q.eval("document.querySelector('.account-data-controls form').scrollIntoView({block:'start'})");await q.screenshot({path:out+'/delete-confirm-'+width+'.jpg',quality:85})
  await fill(q,'Current password to delete','synthetic-wrong-password');await fill(q,'Type DELETE','DELETE');await click(q,'Permanently delete account');await wait(q,"document.body.innerText.includes('Current password is incorrect.')",'wrong password visible')
  await q.eval("document.querySelector('.account-data-controls').scrollIntoView({block:'start'})");await q.screenshot({path:out+'/delete-error-'+width+'.jpg',quality:85})
  await click(q,'Cancel deletion');results.push(`visible data/confirmation/error captures and nested no-overflow at ${width}px`);await q.close()
 }
 const cleanup=await browser.newPage();await cleanup.goto(origin+'/login',{settleMs:100});await cleanup.eval(`(async()=>{const a=await fetch('/api/auth/session').then(r=>r.json());const r=await fetch('/api/account',{method:'DELETE',headers:{'Content-Type':'application/json','X-CSRF-Token':a.csrf_token},body:JSON.stringify({current_password:${JSON.stringify(password)},confirmation:'DELETE'})});if(r.status!==204)throw Error('Fixture cleanup failed')})()`);await cleanup.close()
 await writeFile(out+'/export-results.json',JSON.stringify({checks:results},null,2));console.log(JSON.stringify({passed:results.length,results},null,2))
}finally{await browser.close()}
