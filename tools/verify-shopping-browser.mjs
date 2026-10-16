// Requires a local CDP helper module; set GROCEA_CDP_MODULE to its absolute path.
// Uses generated disposable loopback accounts only. No credentials are written.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const origin = process.env.GROCEA_UI_ORIGIN ?? 'http://127.0.0.1:5184'
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(origin).hostname), 'Loopback UI required')
assert(process.env.GROCEA_CDP_MODULE, 'Set GROCEA_CDP_MODULE to a local CDP Browser helper')
const { Browser } = await import(pathToFileURL(process.env.GROCEA_CDP_MODULE))
const out = 'reports/next-phase/task-02-browser'
await mkdir(out, { recursive: true })
const browser = await Browser.launch()
const results = []
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
async function wait(page, expression, label) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    if (await page.eval(expression)) return
    await sleep(100)
  }
  throw new Error(`Timed out: ${label}`)
}
const click = (page, label) => page.eval(`(() => { const el = [...document.querySelectorAll('button,a')].find(el => el.textContent.trim() === ${JSON.stringify(label)}); if (!el) throw new Error('Missing action: '+${JSON.stringify(label)}); el.click(); })()`)
const navigate = (page, path) => page.eval(`history.pushState({}, '', ${JSON.stringify(path)}); window.dispatchEvent(new PopStateEvent('popstate'))`)
const setField = (page, selector, value) => page.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if(!el) throw new Error('Missing field'); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input',{bubbles:true})); })()`)
const queue = page => page.eval(`(async () => { const name = (await indexedDB.databases()).find(db=>db.name===${JSON.stringify(page.testDatabaseName)}).name; return await new Promise((resolve,reject)=>{const req=indexedDB.open(name);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('outbox');const rows=tx.objectStore('outbox').getAll();rows.onsuccess=()=>resolve(JSON.parse(JSON.stringify(rows.result,(_,v)=>typeof v==='bigint'?v.toString():v)));tx.oncomplete=()=>db.close();rows.onerror=()=>reject(rows.error)}}) })()`)
try {
 for (const width of [390,1280,320]) {
  const page = await browser.newPage({width,height:width===1280?900:844,mobile:width<600})
  await page.goto(`${origin}/login`,{settleMs:100})
  const suffix = randomUUID()
  const accountId = await page.eval(`(async () => {
   const auth=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'browser-${suffix}@example.com',password:'Synthetic-${suffix}',display_name:'Synthetic browser check'})}).then(r=>r.json());
   if(!auth.csrf_token) throw new Error('Registration failed');
   const state=await fetch('/api/state').then(r=>r.json());
   const ingredient=state.ingredients.find(i=>i.measurement_family==='mass'); window.testIngredient=ingredient;
   let revision=state.revision;
   const mutate=async(path,body,method='PUT')=>{const r=await fetch(path,{method,headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrf_token,'X-Device-ID':crypto.randomUUID(),'Idempotency-Key':crypto.randomUUID(),'X-Expected-State-Revision':String(revision)},body:JSON.stringify(body)});if(!r.ok)throw new Error('Fixture mutation failed '+r.status);revision=Number(r.headers.get('X-State-Revision'))};
   await mutate('/api/pantry-stocks/'+ingredient.id+'/tracking',{tracked:true});
   const recipe=state.recipes.find(r=>r.status==='published');
   await mutate('/api/basket/recipes/'+recipe.id,{servings:recipe.base_servings});
   return auth.account.id;
  })()`)
  page.testDatabaseName = `grocea:${accountId}`
  const ingredient = await page.eval('window.testIngredient')
  await page.goto(`${origin}/groceries`,{settleMs:100})
  await wait(page,"document.querySelector('main')?.innerText.includes('Start shopping list')",'empty groceries')
  await page.screenshot({path:`${out}/empty-${width}.jpg`,quality:85})
  await page.send('Network.enable')
  await page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1})
  if(width===390) {
    await click(page,'Start shopping list')
    await wait(page,"document.querySelector('main')?.innerText.includes('Your shopping list is ready')",'manual empty list')
  }
  await navigate(page,'/pantry')
  await wait(page,"!!document.querySelector('.pantry-view-tabs')",'Pantry')
  await page.eval("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Needs restock')).click()")
  await wait(page,"!!document.querySelector('.stock-row')",'restock row')
  await page.screenshot({path:`${out}/restock-row-${width}.jpg`,quality:85})
  await page.eval("document.querySelector('.stock-row').click()")
  if(width!==390) await wait(page,"document.querySelector('main')?.innerText.includes('Grocea will start a shopping list')",'direct restock no list')
  await wait(page,"!!document.querySelector('.grocery-item-editor')",'restock editor')
  await setField(page,'.grocery-amount-fields input','1.25')
  await setField(page,'.grocery-amount-fields select','kg')
  await page.screenshot({path:`${out}/restock-editor-${width}.jpg`,quality:85})
  await click(page,'Add item')
  await wait(page,"document.querySelector('.grocery-item-copy')?.innerText.includes("+JSON.stringify(ingredient.name)+")",'restock saved offline')
  assert(!await page.eval("document.querySelector('main').innerText.includes('Recipes used for this list')"))
  assert(!await page.eval("document.querySelector('main').innerText.includes('Return recipes to Basket')"))
  await page.screenshot({path:`${out}/shopping-${width}.jpg`,quality:85})
  await click(page,'Add item')
  await wait(page,"!!document.querySelector('.grocery-item-editor')",'custom editor')
  assert(!await page.eval("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Complete list')"))
  await setField(page,'.grocery-item-editor input[maxlength="120"]','Synthetic unknown amount')
  await page.screenshot({path:`${out}/custom-editor-${width}.jpg`,quality:85})
  await page.eval("document.querySelector('.grocery-item-editor').requestSubmit()")
  await wait(page,"document.querySelectorAll('.grocery-item').length===2",'custom unknown saved')
  const beforeQueue=await queue(page)
  const create=beforeQueue.find(row=>row.type==='grocery-list.manual.create')
  assert(create,'manual creation persisted')
  assert(beforeQueue.filter(row=>row.type==='grocery-list.item.create').every(row=>row.dependsOn.includes(create.id)))
  // Reproduce IndexedDB index ordering with tied timestamps and child UUID preceding parent UUID.
  await page.eval(`(async()=>{const name=(await indexedDB.databases()).find(db=>db.name===${JSON.stringify(page.testDatabaseName)}).name;await new Promise((resolve,reject)=>{const req=indexedDB.open(name);req.onsuccess=()=>{const db=req.result;const tx=db.transaction('outbox','readwrite');const store=tx.objectStore('outbox');const r=store.getAll();r.onsuccess=()=>{const rows=r.result;const parent=rows.find(row=>row.type==='grocery-list.manual.create');const old=parent.id;store.delete(old);parent.id='ffffffff-ffff-4fff-8fff-ffffffffffff';rows.forEach(row=>{row.createdAt='2026-10-16T00:00:00.000Z';row.dependsOn=row.dependsOn.map(id=>id===old?parent.id:id);store.put(row)})};tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}})})()`)
  await navigate(page,`/groceries/restock/${ingredient.id}`)
  await wait(page,"document.querySelector('main')?.innerText.includes('Already on your shopping list')",'duplicate feedback')
  await page.screenshot({path:`${out}/already-on-list-${width}.jpg`,quality:85})
  assert.equal((await queue(page)).length,beforeQueue.length,'duplicate did not enqueue')
  await click(page,'Open list')
  await page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})
  await page.eval("window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('grocea:sync'))")
  const deadline=Date.now()+15000
  while((await queue(page)).length && Date.now()<deadline) await sleep(100)
  assert.equal((await queue(page)).length,0,'offline queue drained')
  const remote=await page.eval("fetch('/api/state').then(r=>r.json())")
  assert.equal(remote.grocery_lists.filter(list=>list.status==='active').length,1)
  assert.equal(remote.grocery_lists[0].items.length,2)
  assert.equal(remote.grocery_lists[0].recipes.length,0)
  assert.equal(remote.basket.items.length,1)
  assert.equal(remote.grocery_lists[0].items.find(row=>row.ingredient_id).quantity,'1250.000')
  await wait(page,"document.querySelectorAll('.grocery-item').length===2",'canonical list rendered')
  await page.eval("document.querySelector('.grocery-check input').click()")
  await wait(page,"!!document.querySelector('.grocery-item.checked')",'checked state persisted')
  await click(page,'Complete list')
  await wait(page,"!!document.querySelector('.pantry-completion-dialog[open]')",'completion preview')
  assert(await page.eval("document.querySelector('.pantry-preview')?.innerText.includes('1.25 kg')"))
  await page.screenshot({path:`${out}/completion-${width}.jpg`,quality:85})
  await click(page,'Update Pantry & complete')
  await wait(page,"location.pathname==='/groceries'",'completed')
  const doneDeadline=Date.now()+15000
  while((await queue(page)).length && Date.now()<doneDeadline) await sleep(100)
  const done=await page.eval("fetch('/api/state').then(r=>r.json())")
  assert.equal(done.grocery_lists[0].status,'completed')
  assert.equal(done.pantry_stocks.find(row=>row.ingredient_id===ingredient.id).quantity,'1250.000')
  const metrics=await page.eval("({overflow:document.documentElement.scrollWidth>innerWidth,main:!!document.querySelector('main'),bodyWidth:document.documentElement.scrollWidth})")
  assert(!metrics.overflow,'no horizontal overflow')
  assert.equal(page.consoleErrors.length,0,'no runtime exceptions')
  let staleConflict = 'not run at this width'
  let concurrentWrite = 'not run at this width'
  if(width===390) {
    await page.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1})
    await click(page,'Start shopping list')
    await wait(page,"document.querySelector('main')?.innerText.includes('Your shopping list is ready')",'second offline list')
    await click(page,'Add item')
    await wait(page,"!!document.querySelector('.grocery-item-editor')",'second editor')
    await setField(page,'.grocery-item-editor input[maxlength="120"]','Synthetic conflict item')
    await page.eval("document.querySelector('.grocery-item-editor').requestSubmit()")
    await wait(page,"document.querySelectorAll('.grocery-item').length===1",'conflict item saved')
    const otherPage=await browser.newPage()
    await otherPage.goto(`${origin}/api/health/live`,{settleMs:100})
    await otherPage.eval(`(async()=>{const auth=await fetch('/api/auth/session').then(r=>r.json());const state=await fetch('/api/state').then(r=>r.json());const response=await fetch('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrf_token,'X-Device-ID':crypto.randomUUID(),'Idempotency-Key':crypto.randomUUID(),'X-Expected-State-Revision':String(state.revision)},body:JSON.stringify({display_name:'Synthetic second device',preferred_servings:2})});if(!response.ok)throw new Error('Second device fixture failed '+response.status+' '+JSON.stringify(await response.json()));return true})()`)
    await otherPage.close()
    await page.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1})
    await page.eval("window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('grocea:sync'))")
    const conflictDeadline=Date.now()+15000
    while(!(await queue(page)).some(row=>row.error?.code==='STATE_REVISION_CONFLICT') && Date.now()<conflictDeadline) await sleep(100)
    assert((await queue(page)).some(row=>row.error?.code==='STATE_REVISION_CONFLICT'))
    await page.eval("window.dispatchEvent(new Event('grocea:sync'))")
    const dependentDeadline=Date.now()+15000
    while(!(await queue(page)).some(row=>row.error?.code==='DEPENDENCY_FAILED') && Date.now()<dependentDeadline) await sleep(100)
    assert((await queue(page)).some(row=>row.error?.code==='DEPENDENCY_FAILED'))
    assert.equal((await page.eval("fetch('/api/state').then(r=>r.json())")).grocery_lists.filter(list=>list.status==='active').length,0)
    await navigate(page,'/sync-issues')
    await wait(page,"document.querySelector('main')?.innerText.includes('Account changed elsewhere')",'conflict visible')
    await page.screenshot({path:`${out}/stale-conflict-${width}.jpg`,quality:85})
    staleConflict='passed: explicit issue; dependent item blocked; remote unchanged'
  }
  if(width===1280) {
    let heldRequest
    const unsubscribe=browser.on(page.sessionId,'Fetch.requestPaused',event=>{heldRequest=event.requestId})
    await page.send('Fetch.enable',{patterns:[{urlPattern:'*/api/grocery-lists',requestStage:'Response'}]})
    await click(page,'Start shopping list')
    await wait(page,"document.querySelector('main')?.innerText.includes('Your shopping list is ready')",'online race list')
    const holdDeadline=Date.now()+15000
    while(!heldRequest && Date.now()<holdDeadline) await sleep(100)
    assert(heldRequest,'list response held')
    await click(page,'Add item')
    await wait(page,"!!document.querySelector('.grocery-item-editor')",'online race editor')
    await setField(page,'.grocery-item-editor input[maxlength="120"]','Synthetic concurrent item')
    await page.eval("document.querySelector('.grocery-item-editor').requestSubmit()")
    await wait(page,"document.querySelectorAll('.grocery-item').length===1",'write arrived during sync')
    assert.equal((await queue(page)).length,2)
    await page.send('Fetch.continueResponse',{requestId:heldRequest})
    await page.send('Fetch.disable')
    unsubscribe()
    const raceDeadline=Date.now()+15000
    while((await queue(page)).length && Date.now()<raceDeadline) await sleep(100)
    assert.equal((await queue(page)).length,0,'new snapshot automatically synchronized')
    const raceRemote=await page.eval("fetch('/api/state').then(r=>r.json())")
    assert.equal(raceRemote.grocery_lists.find(list=>list.status==='active').items.length,1)
    concurrentWrite='passed: new write during held creation response synced automatically'
  }
  results.push({width,...metrics,offlineQueue:'passed',duplicate:'passed',completion:'passed',staleConflict,concurrentWrite,runtimeErrors:page.consoleErrors})
  await page.close()
 }
} finally {await browser.close()}
await writeFile(`${out}/results.json`,JSON.stringify(results,null,2))
console.log(JSON.stringify(results,null,2))
