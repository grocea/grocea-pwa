// Real production build + service worker, generated disposable loopback accounts only.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const origin = process.env.GROCEA_UI_ORIGIN ?? 'http://127.0.0.1:5184'
const url = new URL(origin)
assert(url.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname) && !url.username && !url.password && url.pathname === '/')
assert(process.env.GROCEA_CDP_MODULE)
const { Browser } = await import(pathToFileURL(process.env.GROCEA_CDP_MODULE))
const out = 'reports/next-phase/task-05-browser'
await mkdir(out,{recursive:true})
const browser = await Browser.launch()
const results=[]
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function wait(page,expr,label) { const end=Date.now()+20000; while(Date.now()<end) { if(await page.eval(expr))return; await sleep(100) } throw new Error(`Timed out: ${label}`) }
const click=(page,text)=>page.eval(`(()=>{const el=[...document.querySelectorAll('button,a')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!el)throw new Error('Missing action '+${JSON.stringify(text)});el.click()})()`)
const navigate=(page,path)=>page.eval(`history.pushState({},'',${JSON.stringify(path)});window.dispatchEvent(new PopStateEvent('popstate'))`)
const set=(page,selector,value)=>page.eval(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Missing field');const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`)
const stored=(page,store)=>page.eval(`(async()=>await new Promise((resolve,reject)=>{const req=indexedDB.open(${JSON.stringify(page.databaseName)});req.onsuccess=()=>{const db=req.result;const tx=db.transaction(${JSON.stringify(store)});const r=tx.objectStore(${JSON.stringify(store)}).getAll();r.onsuccess=()=>resolve(JSON.parse(JSON.stringify(r.result,(_,v)=>typeof v==='bigint'?v.toString():v)));tx.oncomplete=()=>db.close();r.onerror=()=>reject(r.error)}}))()`)
const queue=page=>stored(page,'outbox')
async function drain(page) { const end=Date.now()+20000;while(Date.now()<end){if(!(await queue(page)).length)return;await sleep(100)}throw new Error('Outbox did not drain') }
const remote=(page,path,body,method='POST')=>page.eval(`(async()=>{const auth=await fetch('/api/auth/session').then(r=>r.json());const state=await fetch('/api/state').then(r=>r.json());const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrf_token,'X-Device-ID':crypto.randomUUID(),'Idempotency-Key':crypto.randomUUID(),'X-Expected-State-Revision':String(state.revision)},body:JSON.stringify(${JSON.stringify(body)})});if(!r.ok)throw new Error('Mutation '+r.status);return r.json()})()`)
async function metric(page,width) {const m=await page.eval(`({width:document.documentElement.scrollWidth,pageWidth:document.querySelector('.app-page').scrollWidth,pageClient:document.querySelector('.app-page').clientWidth})`);assert(m.width<=width&&m.pageWidth<=m.pageClient,'no horizontal overflow');return m}
let active
try {
 for(const width of [390,768,1440,320]) {
  const page=await browser.newPage({width,height:width===1440?900:844,mobile:width<600});active=page
  await page.goto(`${origin}/login`,{settleMs:100})
  const suffix=randomUUID()
  const fixture=await page.eval(`(async()=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'restock-${suffix}@example.com',password:'Synthetic-${suffix}',display_name:'Synthetic restock check'})});if(!r.ok)throw new Error('Register '+r.status);const auth=await r.json();const state=await fetch('/api/state').then(r=>r.json());return{accountId:auth.account.id,mass:state.ingredients.find(i=>i.measurement_family==='mass'),volume:state.ingredients.find(i=>i.measurement_family==='volume'),count:state.ingredients.find(i=>i.measurement_family==='count')}})()`)
  page.databaseName=`grocea:${fixture.accountId}`
  await remote(page,`/api/pantry-stocks/${fixture.mass.id}/operations`,{event_id:randomUUID(),operation:'set',amount:'500',reason:'Synthetic balance'})
  await page.goto(`${origin}/pantry`,{settleMs:100})
  await wait(page,"!!document.querySelector('.stock-row')",'first online sync')
  await wait(page,'!!navigator.serviceWorker.controller','production SW control')
  await page.eval('document.fonts.ready')
  assert(await page.eval("document.querySelector('.page-heading p').innerText.includes('0 running low')"),'legacy default depleted-only')
  await navigate(page,`/pantry/${fixture.mass.id}/preferences`)
  await wait(page,"!!document.querySelector('.restock-preferences')",'settings')
  assert(!await page.eval("document.querySelector('.preference-toggle input').checked"))
  // Keyboard toggling supports the settings checkbox.
  await page.eval("document.querySelector('.preference-toggle input').focus()")
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space',windowsVirtualKeyCode:32,text:' '})
  await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space',windowsVirtualKeyCode:32})
  await wait(page,"document.querySelectorAll('.restock-preferences input').length===3",'threshold enabled')
  await set(page,'.restock-preferences .grocery-amount-fields input','-1')
  await click(page,'Save preferences')
  await wait(page,"!!document.querySelector('.field-error')",'negative validation')
  assert.equal((await queue(page)).length,0)
  await set(page,'.restock-preferences .grocery-amount-fields input','500')
  await set(page,'.restock-preferences .grocery-amount-fields:nth-of-type(2) input','1234.567')
  // Exactly two compatible unit menus, no incompatible family units.
  assert.deepEqual(await page.eval("[...document.querySelectorAll('.restock-preferences select')][0].innerText.split('\\n')"),['mg','g','kg'])
  await page.screenshot({path:`${out}/settings-${width}.jpg`,quality:85,fullPage:true})
  const settingsMetric=await metric(page,width)
  await page.send('Network.enable')
  const workerSessions=[]
  const workers=(await browser.send('Target.getTargets')).targetInfos.filter(t=>t.type==='service_worker'&&t.url.startsWith(origin))
  assert(workers.length)
  for(const worker of workers){const{sessionId}=await browser.send('Target.attachToTarget',{targetId:worker.targetId,flatten:true});workerSessions.push(sessionId);await browser.send('Network.enable',{},sessionId);await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId)}
  await page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1})
  await click(page,'Save preferences')
  await wait(page,"location.pathname==='/pantry' && !!document.querySelector('.success-notice')",'offline durable save')
  const pending=await queue(page);assert.equal(pending.length,1);assert.equal(pending[0].type,'pantry.preferences');assert.equal(pending[0].payload.refillQuantity,'1234567')
  await page.send('Page.reload')
  await wait(page,"!!document.querySelector('.pantry-view-tabs')",'real offline reload')
  const again=await queue(page);assert.equal(again[0].id,pending[0].id);assert.deepEqual(again[0].payload,pending[0].payload)
  assert(await page.eval("document.querySelector('.page-heading p').innerText.includes('1 running low')"),'positive at threshold running-low copy')
  await click(page,'Needs restock1')
  await wait(page,"document.querySelector('.stock-name small')?.innerText==='Running low'",'running-low row')
  const pantryMetric=await metric(page,width)
  const tabs=await page.eval(`([...document.querySelectorAll('.pantry-view-tabs button')].map(el=>({width:el.clientWidth,scroll:el.scrollWidth})))`)
  assert(tabs.every(t=>t.scroll<=t.width),'count fits tab at 320')
  await page.screenshot({path:`${out}/restock-${width}.jpg`,quality:85,fullPage:true})
  await navigate(page,`/groceries/restock/${fixture.mass.id}`)
  await wait(page,"!!document.querySelector('.grocery-item-editor')",'restock editor')
  assert.equal(await page.eval("document.querySelector('.grocery-amount-fields input').value"),'1234.567','fixed refill not balance subtraction')
  await page.screenshot({path:`${out}/prefill-${width}.jpg`,quality:85,fullPage:true})
  await metric(page,width)
  for(const sessionId of workerSessions)await browser.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId)
  await page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})
  await page.eval("window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('grocea:sync'))")
  await drain(page)
  let state=await page.eval("fetch('/api/state').then(r=>r.json())")
  assert.equal(state.pantry_stocks.find(s=>s.ingredient_id===fixture.mass.id).refill_quantity,'1234.567')
  assert.equal(state.activity.length,1,'settings do not alter immutable stock history')
  // A fresh page gets the same server-backed preferences.
  const second=await browser.newPage({width:width,height:844})
  await second.goto(`${origin}/pantry/${fixture.mass.id}/preferences`,{settleMs:100})
  await wait(second,"!!document.querySelector('.restock-preferences')",'another page settings')
  assert.equal(await second.eval("document.querySelector('.grocery-amount-fields input').value"),'500')
  assert.equal(await second.eval("document.querySelector('.grocery-amount-fields:nth-of-type(2) input').value"),'1234.567')
  await second.close()
  // Buy an edited amount and complete: preferences remain and shopping history stays separate.
  await set(page,'.grocery-amount-fields input','1000.001')
  await click(page,'Add item')
  await wait(page,"location.pathname.startsWith('/groceries/')&&!location.pathname.includes('/restock/')",'restock list')
  await drain(page)
  state=await page.eval("fetch('/api/state').then(r=>r.json())")
  assert.equal(state.grocery_lists[0].items[0].quantity,'1000.001')
  // Boundary and disabling threshold are covered at every size.
  await remote(page,`/api/pantry-stocks/${fixture.mass.id}/operations`,{event_id:randomUUID(),operation:'set',amount:'501',reason:'Synthetic boundary'})
  await page.goto(`${origin}/pantry`,{settleMs:100})
  await wait(page,"document.querySelector('.page-heading p')?.innerText.includes('0 running low')",'501 above threshold')
  await navigate(page,`/pantry/${fixture.mass.id}/preferences`)
  await wait(page,"!!document.querySelector('.preference-toggle input')",'settings clear')
  await page.eval("document.querySelector('.preference-toggle input').click()")
  await set(page,'.grocery-amount-fields input','')
  await click(page,'Save preferences');await wait(page,"location.pathname==='/pantry'",'cleared');await drain(page)
  state=await page.eval("fetch('/api/state').then(r=>r.json())")
  const cleared=state.pantry_stocks.find(s=>s.ingredient_id===fixture.mass.id)
  assert.equal(cleared.low_stock_threshold,null);assert.equal(cleared.refill_quantity,null)
  if(width===390) {
   // Archived tracked rows stay on the server but must not invalidate visible account cache.
   const archivedId=randomUUID()
   const categoryId=state.categories[0].id
   await remote(page,'/api/ingredients',{id:archivedId,name:'Synthetic archived staple',category_id:categoryId,measurement_family:'mass',track_in_pantry:true})
   await remote(page,`/api/pantry-stocks/${archivedId}/preferences`,{measurement_family:'mass',low_stock_threshold:'0',refill_quantity:'1000.001'},'PUT')
   await remote(page,`/api/ingredients/${archivedId}`,undefined,'DELETE')
   await page.goto(`${origin}/pantry`,{settleMs:100})
   await wait(page,"!!document.querySelector('.pantry-view-tabs')",'archived state loaded')
   const cached=(await stored(page,'state'))[0].value
   assert(!cached.ingredients.some(i=>i.id===archivedId))
   assert(!Object.hasOwn(cached.pantryPreferences,archivedId),'archived preferences absent from visible cache')
   for(const sessionId of workerSessions)await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId)
   await page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1})
   await page.send('Page.reload')
   await wait(page,"!!document.querySelector('.pantry-view-tabs')",'archived account cache real offline reload')
   assert(!await page.eval("document.body.innerText.includes('storage could not')"))
   assert.equal((await stored(page,'state'))[0].value.ingredients.length,cached.ingredients.length)
   for(const sessionId of workerSessions)await browser.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId)
   await page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})
   await remote(page,`/api/ingredients/${archivedId}/restore`,{},'POST')
   await page.goto(`${origin}/pantry/${archivedId}/preferences`,{settleMs:100})
   await wait(page,"!!document.querySelector('.restock-preferences')",'restored settings')
   assert.equal(await page.eval("document.querySelector('.grocery-amount-fields input').value"),'0')
   assert.equal(await page.eval("document.querySelector('.grocery-amount-fields:nth-of-type(2) input').value"),'1000.001')
   // Zero is explicitly no suggestion, and does not prefill an invalid buy quantity.
   await remote(page,`/api/pantry-stocks/${archivedId}/preferences`,{measurement_family:'mass',low_stock_threshold:null,refill_quantity:'0'},'PUT')
   await page.goto(`${origin}/groceries/restock/${archivedId}`,{settleMs:100})
   await wait(page,"document.querySelector('.grocery-amount-fields input')?.value === ''",'zero refill editor refreshed')
   assert.equal(await page.eval("document.querySelector('.grocery-amount-fields input').value"),'')
   // Old IndexedDB state without new preferences normalizes safely on offline reload.
   await page.eval(`(async()=>await new Promise((resolve,reject)=>{const r=indexedDB.open(${JSON.stringify(page.databaseName)});r.onsuccess=()=>{const db=r.result;const tx=db.transaction(['state','canonical'],'readwrite');for(const name of ['state','canonical']){const store=tx.objectStore(name);const req=store.get('current');req.onsuccess=()=>{const row=req.result;if(row){delete row.value.pantryPreferences;store.put(row)}}}tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}))()`)
   for(const sessionId of workerSessions)await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId)
   await page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1})
   await page.send('Page.reload')
   await wait(page,"!!document.querySelector('.grocery-item-editor')",'legacy cached state offline')
   assert.equal(await page.eval("document.querySelector('.grocery-amount-fields input').value"),'')
   for(const sessionId of workerSessions)await browser.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId)
   await page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})
  }
  results.push({width,settingsMetric,pantryMetric,checks:'settings keyboard/validation; true offline save/reload/durable replay; running-low semantics; exact editable fixed refill; server synchronization; fresh-page settings; boundary; clear'})
  await page.close();active=null
 }
 await writeFile(`${out}/results.json`,JSON.stringify({results},null,2)+'\n')
 console.log('PASS restock browser: 390/768/1440/320, production SW offline reload and reconnect, exact fixed refill, boundary, settings clear and counts')
} catch(error) {if(active)await active.screenshot({path:`${out}/failure.jpg`,quality:85,fullPage:true}).catch(()=>{});throw error} finally {await browser.close()}
