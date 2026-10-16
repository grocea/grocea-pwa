// Production-build + real service-worker scenarios using disposable local accounts only.
// GROCEA_CDP_MODULE=/absolute/path/to/cdp.mjs node tools/verify-bulk-browser.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const origin = process.env.GROCEA_UI_ORIGIN ?? 'http://127.0.0.1:5184'
const url = new URL(origin)
assert(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password && url.pathname === '/', 'Plain loopback UI origin required')
assert(process.env.GROCEA_CDP_MODULE, 'Set GROCEA_CDP_MODULE to a local CDP helper')
const { Browser } = await import(pathToFileURL(process.env.GROCEA_CDP_MODULE))
const out = 'reports/next-phase/task-03-browser'
await mkdir(out, { recursive: true })
const browser = await Browser.launch()
const results = []
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function wait(page, expression, label) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) { if (await page.eval(expression)) return; await sleep(100) }
  throw new Error(`Timed out: ${label}`)
}
const click = (page, text) => page.eval(`(() => { const el = [...document.querySelectorAll('button,a')].find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!el) throw new Error('Missing action'); el.click(); })()`)
const navigate = (page, path) => page.eval(`history.pushState({}, '', ${JSON.stringify(path)}); window.dispatchEvent(new PopStateEvent('popstate'))`)
const setField = (page, selector, value) => page.eval(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el)throw new Error('Missing field');const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); })()`)
const field = (label, tag = 'input') => `${tag}[aria-label=${JSON.stringify(label)}]`
async function keyboard(page, selector, key, code, virtualKey) {
  await page.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`)
  await page.send('Input.dispatchKeyEvent', {type:'keyDown',key,code,windowsVirtualKeyCode:virtualKey,text:key==='Enter'?'\r':key===' '?' ':undefined})
  await page.send('Input.dispatchKeyEvent', {type:'keyUp',key,code,windowsVirtualKeyCode:virtualKey})
}
async function select(page, name, useKeyboard = false) {
  await setField(page,'.bulk-selector .search-field input',name)
  await wait(page,`[...document.querySelectorAll('.bulk-catalog strong')].some(el=>el.textContent===${JSON.stringify(name)})`,'ingredient search')
  const selector = '.bulk-catalog input'
  if(useKeyboard) await keyboard(page, selector, ' ', 'Space', 32)
  else await page.eval(`document.querySelector(${JSON.stringify(selector)}).click()`)
}
const stored = (page, store) => page.eval(`(async()=>await new Promise((resolve,reject)=>{const req=indexedDB.open(${JSON.stringify(page.databaseName)});req.onsuccess=()=>{const db=req.result;const tx=db.transaction(${JSON.stringify(store)});const r=tx.objectStore(${JSON.stringify(store)}).getAll();r.onsuccess=()=>resolve(JSON.parse(JSON.stringify(r.result,(_,v)=>typeof v==='bigint'?v.toString():v)));tx.oncomplete=()=>db.close();r.onerror=()=>reject(r.error)}}))()`)
const queue = page => stored(page,'outbox')
async function metrics(page) {
  return page.eval(`({documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,pageWidth:document.querySelector('.app-page').scrollWidth,pageClient:document.querySelector('.app-page').clientWidth,fonts:[...document.fonts].filter(f=>f.family.includes('Inter')).map(f=>({weight:f.weight,status:f.status})),wordmarkColor:getComputedStyle(document.querySelector('.desktop-wordmark')||document.body).color})`)
}
const remoteMutation = (page, path, body, method = 'POST') => page.eval(`(async()=>{const auth=await fetch('/api/auth/session').then(r=>r.json());const state=await fetch('/api/state').then(r=>r.json());const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrf_token,'X-Device-ID':crypto.randomUUID(),'Idempotency-Key':crypto.randomUUID(),'X-Expected-State-Revision':String(state.revision)},${body ? `body:JSON.stringify(${JSON.stringify(body)})` : ''}});if(!r.ok)throw new Error('Fixture mutation '+r.status);return r.json()})()`)
let activePage
try {
  for (const width of [390,768,1440,320]) {
    const page=await browser.newPage({width,height:width===1440?900:844,mobile:width<600})
    activePage=page
    await page.goto(`${origin}/login`,{settleMs:100})
    const suffix=randomUUID()
    const fixture=await page.eval(`(async()=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'bulk-${suffix}@example.com',password:'Synthetic-${suffix}',display_name:'Synthetic bulk check'})});if(!r.ok)throw new Error('Registration '+r.status);const auth=await r.json();const state=await fetch('/api/state').then(r=>r.json());return {accountId:auth.account.id,mass:state.ingredients.find(i=>i.measurement_family==='mass'),volume:state.ingredients.find(i=>i.measurement_family==='volume'),count:state.ingredients.find(i=>i.measurement_family==='count'),categoryId:state.categories[0].id}})()`)
    page.databaseName=`grocea:${fixture.accountId}`
    const temporaryId=randomUUID()
    await remoteMutation(page,'/api/ingredients',{id:temporaryId,name:'Synthetic temporary ingredient',category_id:fixture.categoryId,measurement_family:'mass',track_in_pantry:false})
    await page.goto(`${origin}/pantry`,{settleMs:100})
    await wait(page,"!!document.querySelector('.pantry-actions')",'online first sync')
    await wait(page,'!!navigator.serviceWorker.controller','production service worker control')
    await page.eval('document.fonts.ready')
    assert(await page.eval("document.fonts.check('400 16px Inter')"),'Inter font loaded')
    assert(!await page.eval("!!document.querySelector('.pantry-pulse')"),'empty Pantry prioritizes setup')
    const pantryMetric=await metrics(page)
    assert(pantryMetric.documentWidth<=width && pantryMetric.pageWidth<=pantryMetric.pageClient,'Pantry overflow')
    if(width===1440) assert.notEqual(pantryMetric.wordmarkColor,'rgb(255, 255, 255)')
    await page.screenshot({path:`${out}/pantry-${width}.jpg`,quality:85})
    await click(page,'Set up pantry')
    await wait(page,"!!document.querySelector('.bulk-selector')",'bulk route')
    assert(await page.eval("document.querySelector('.bulk-save-actions button.primary').disabled"),'empty disabled')
    await select(page,fixture.mass.name,true)
    await select(page,fixture.volume.name)
    await select(page,fixture.count.name)
    await select(page,'Synthetic temporary ingredient')
    await keyboard(page,'button[aria-label="Remove Synthetic temporary ingredient from bulk update"]','Enter','Enter',13)
    await wait(page,"document.querySelectorAll('.bulk-edit-row').length===3",'keyboard removal')
    assert(await page.eval("document.activeElement===document.querySelector('.bulk-selector .search-field input')"),'remove returns focus')
    await setField(page,field(`Operation for ${fixture.mass.name}`,'select'),'add')
    await page.eval(`document.querySelectorAll('.bulk-pack-toggle input')[0].click()`)
    await setField(page,field(`Pack count for ${fixture.mass.name}`),'1.5')
    await setField(page,field(`Amount for ${fixture.mass.name}`),'0.5')
    await setField(page,field(`Unit for ${fixture.mass.name}`,'select'),'kg')
    await setField(page,field(`Amount for ${fixture.volume.name}`),'0.375')
    await setField(page,field(`Amount for ${fixture.count.name}`),'1.5')
    await click(page,'Review 3 ingredients')
    assert.equal(await page.eval('document.activeElement.id'),`bulk-amount-${fixture.mass.id}`)
    assert(await page.eval("document.querySelector('main').innerText.includes('whole pack count')"))
    assert.equal((await queue(page)).length,0,'invalid input enqueues nothing')
    await page.screenshot({path:`${out}/invalid-${width}.jpg`,quality:85})
    await setField(page,field(`Pack count for ${fixture.mass.name}`),'2')
    await click(page,'Review 3 ingredients')
    await wait(page,"!!document.querySelector('.bulk-review')",'review')
    assert(await page.eval("document.querySelector('.bulk-review').innerText.includes('2 × 0.5 kg = 1 kg')"),'exact packs preview')
    assert.equal(await page.eval('document.activeElement.id'),'bulk-review-heading')
    await click(page,'Back to editing')
    assert.equal(await page.eval(`document.querySelector(${JSON.stringify(field(`Amount for ${fixture.mass.name}`))}).value`),'0.5','draft retained')
    await page.screenshot({path:`${out}/editor-${width}.jpg`,quality:85,fullPage:true})
    await click(page,'Review 3 ingredients')
    await page.screenshot({path:`${out}/review-${width}.jpg`,quality:85,fullPage:true})
    const reviewMetric=await metrics(page)
    assert(reviewMetric.documentWidth<=width && reviewMetric.pageWidth<=reviewMetric.pageClient,'review overflow')
    await page.send('Network.enable')
    const workers=(await browser.send('Target.getTargets')).targetInfos.filter(target=>target.type==='service_worker' && target.url.startsWith(origin))
    assert(workers.length,'production service worker target exists')
    const workerSessions=[]
    for(const worker of workers) {
      const {sessionId}=await browser.send('Target.attachToTarget',{targetId:worker.targetId,flatten:true})
      workerSessions.push(sessionId)
      await browser.send('Network.enable',{},sessionId)
      await browser.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId)
    }
    await page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1})
    await click(page,'Save 3 ingredients')
    await wait(page,"location.pathname==='/pantry' && document.querySelector('.success-notice')?.innerText.includes('Saved 3 ingredients on this device')",'durable local success')
    const pending=await queue(page)
    assert.equal(pending.length,1,'one persisted mutation')
    assert.equal(pending[0].type,'stock.bulk')
    assert.equal(pending[0].payload.rows.length,3)
    const localState=(await stored(page,'state')).find(row=>row.key==='current')?.value ?? (await stored(page,'state'))[0].value
    assert.equal(localState.activity.length,1,'one local event')
    assert.equal(localState.activity[0].changes.length,3)
    await page.send('Page.reload')
    await wait(page,"!!document.querySelector('.stock-row')",'real offline production reload')
    const reloaded=await queue(page)
    assert.equal(reloaded.length,1)
    assert.equal(reloaded[0].id,pending[0].id,'same durable id after reload')
    assert.deepEqual(reloaded[0].payload,pending[0].payload,'all rows survive reload')
    const reloadedState=(await stored(page,'state'))[0].value
    for(const field of ['categories','ingredients','balances','activity','trackedIngredientIds']) assert.deepEqual(reloadedState[field],localState[field],`account ${field} unchanged across offline reload`)
    assert(reloadedState.ingredients.every(item=>/^[0-9a-f-]{36}$/i.test(item.id)),'no bundled fixture IDs in authenticated catalog')
    const pulse=await page.eval(`(()=>{const el=document.querySelector('.pantry-pulse');const action=el?.querySelector('.pulse-action');return el && action ? {width:el.clientWidth,scroll:el.scrollWidth,actionRight:action.getBoundingClientRect().right,right:el.getBoundingClientRect().right}:null})()`)
    assert(pulse && pulse.scroll<=pulse.width && pulse.actionRight<=pulse.right,'nonempty pulse fits intrinsically')
    await page.screenshot({path:`${out}/offline-reload-${width}.jpg`,quality:85})
    for(const sessionId of workerSessions) await browser.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},sessionId)
    await page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})
    await page.eval("window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('grocea:sync'))")
    const deadline=Date.now()+20000
    while((await queue(page)).length && Date.now()<deadline) await sleep(100)
    assert.equal((await queue(page)).length,0,'reconnect drained bulk')
    const remote=await page.eval("fetch('/api/state').then(r=>r.json())")
    assert.equal(remote.activity.length,1,'one server event')
    assert.equal(remote.activity[0].changes.length,3)
    const stock=Object.fromEntries(remote.pantry_stocks.map(row=>[row.ingredient_id,row.quantity]))
    assert.equal(stock[fixture.mass.id],'1000.000')
    assert.equal(stock[fixture.volume.id],'375.000')
    assert.equal(stock[fixture.count.id],'1.500')
    // Existing single-item route and the measured hidden sr-only sizing defect.
    await navigate(page,`/pantry/stock/new?ingredient=${fixture.mass.id}`)
    await wait(page,"!!document.querySelector('.stock-adjustment-form')",'single form retained')
    const single=await page.eval(`({width:document.documentElement.scrollWidth,pageWidth:document.querySelector('.app-page').scrollWidth,pageClient:document.querySelector('.app-page').clientWidth,hiddenWidth:document.querySelector('[data-testid="stock-projection-announcement"]').getBoundingClientRect().width})`)
    assert(single.width<=width && single.pageWidth<=single.pageClient,'single form overflow')
    assert.equal(single.hiddenWidth,1,'screen-reader announcement stays 1px')
    await page.screenshot({path:`${out}/single-${width}.jpg`,quality:85})
    let unavailable='not repeated at this viewport', stale='not repeated at this viewport'
    if(width===768) {
      await navigate(page,'/pantry/bulk')
      await wait(page,"!!document.querySelector('.bulk-selector')",'new bulk')
      await select(page,'Synthetic temporary ingredient')
      await setField(page,field('Amount for Synthetic temporary ingredient'),'1')
      await select(page,fixture.mass.name)
      await setField(page,field(`Amount for ${fixture.mass.name}`),'2')
      await click(page,'Review 2 ingredients')
      await remoteMutation(page,`/api/ingredients/${temporaryId}`,undefined,'DELETE')
      await page.eval("window.dispatchEvent(new Event('grocea:sync'))")
      await wait(page,"document.querySelector('.bulk-review')?.innerText.includes('Unavailable ingredient')",'archived selected ingredient rendered')
      assert(await page.eval("document.querySelector('.bulk-save-actions button.primary').disabled"))
      await page.screenshot({path:`${out}/unavailable-review-${width}.jpg`,quality:85})
      await click(page,'Back to editing')
      assert(await page.eval("document.querySelector('.bulk-editor').innerText.includes('Unavailable ingredient')"))
      assert.equal(await page.eval(`document.querySelector(${JSON.stringify(field(`Amount for ${fixture.mass.name}`))}).value`),'2')
      await click(page,'Remove unavailable ingredient')
      await click(page,'Review 1 ingredient')
      unavailable='passed: archive during review disables save, editable fallback preserves other rows'
      // Mutate another device after review; the local Set must fail atomically at the server.
      await remoteMutation(page,`/api/pantry-stocks/${fixture.mass.id}/operations`,{event_id:randomUUID(),operation:'add',amount:'1',reason:'Synthetic concurrent change'})
      await click(page,'Save 1 ingredient')
      await wait(page,"location.pathname==='/pantry'",'stale locally saved')
      const conflictDeadline=Date.now()+20000
      let conflicts=[]
      while(Date.now()<conflictDeadline) { conflicts=await queue(page);if(conflicts.some(row=>row.status==='failed'))break;await sleep(100) }
      assert.equal(conflicts[0].error.code,'STATE_REVISION_CONFLICT')
      const staleState=await page.eval("fetch('/api/state').then(r=>r.json())")
      assert.equal(staleState.activity.length,2,'stale batch created no event')
      assert.equal(staleState.pantry_stocks.find(row=>row.ingredient_id===fixture.mass.id).quantity,'1001.000')
      await navigate(page,'/sync-issues')
      await wait(page,"document.querySelector('main')?.innerText.includes('Account changed elsewhere')",'visible conflict')
      await page.screenshot({path:`${out}/stale-conflict-${width}.jpg`,quality:85})
      stale='passed: failed atomic Set retained as one sync issue; server stock/event unchanged'
    }
    assert.equal(page.consoleErrors.length,0,'no runtime JavaScript exceptions')
    results.push({width,pantryMetric,reviewMetric,single,productionServiceWorker:true,realOfflineReload:'passed with unchanged account categories, ingredients, balances, activity and tracking',oneMutationAndEvent:'passed',keyboardSelectionRemoval:'passed',validationFocus:'passed',unavailable,stale,runtimeErrors:page.consoleErrors})
    await page.close()
  }
} catch(error) {
  if(activePage) {
    await activePage.screenshot({path:`${out}/failure.jpg`,quality:85}).catch(()=>{})
    const details=await activePage.eval(`(async()=>({location:location.pathname,text:document.body.innerText.slice(0,4000),cacheKeys:await Promise.all((await caches.keys()).map(async name=>({name,keys:(await (await caches.open(name)).keys()).map(request=>new URL(request.url).pathname)})))}))()`).catch(()=>null)
    await writeFile(`${out}/failure.json`,JSON.stringify({message:error.message,details,runtimeErrors:activePage.consoleErrors},null,2))
  }
  throw error
} finally { await browser.close() }
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2))
console.log(JSON.stringify(results,null,2))
