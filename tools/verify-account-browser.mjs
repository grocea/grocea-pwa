// Real loopback production build/CDP; credentials and reset links stay in memory.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
assert(process.env.GROCEA_CDP_MODULE)
const { Browser } = await import(pathToFileURL(process.env.GROCEA_CDP_MODULE))
const origin='http://127.0.0.1:5184'
const out='reports/next-phase/task-04-browser'
await mkdir(out,{recursive:true})
const browser=await Browser.launch()
const results=[]
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function wait(page,expr,label){const end=Date.now()+15000;while(Date.now()<end){if(await page.eval(expr))return;await sleep(80)}throw new Error('Timed out: '+label)}
const click=(p,label)=>p.eval(`(()=>{const el=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!el)throw Error('Missing action');el.click()})()`)
const set=(p,selector,value)=>p.eval(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
async function fixture(reset=false){return fetch('http://127.0.0.1:8030/fixture',{headers:{'X-Fixture-Action':reset?'reset':''}}).then(r=>r.json())}
async function login(p,email,password){await p.goto(origin+'/login',{settleMs:100});await wait(p,"!!document.querySelector('input[type=email]')",'login');await set(p,'input[type=email]',email);await set(p,'input[type=password]',password);await click(p,'Sign in');await wait(p,"location.pathname==='/pantry' && !!document.querySelector('.pantry-view-tabs')",'signed in and synced')}
try {
 const data=await fixture();let password=data.password
 for(const [index,width] of [320,390,768,1440].entries()){
  const p=await browser.newPage({width,height:900,mobile:width<600})
  if(index===0){
   const reset=await fixture(true)
   await p.goto(origin+'/reset-password#token='+reset.token,{settleMs:100})
   await wait(p,"!!document.querySelector('input[autocomplete=new-password]')",'anonymous recovery after bootstrap')
   await sleep(600)
   assert.equal(await p.eval('location.hash'),'')
   assert.equal(await p.eval("document.querySelector('button[type=submit],form button').disabled"),false,'bootstrap retains memory token')
   await p.screenshot({path:out+'/recovery-'+width+'.jpg',quality:85,fullPage:true})
   password='Synthetic-new-'+randomUUID()
   await set(p,'input[autocomplete=new-password]',password)
   await set(p,'input[autocomplete=new-password]:last-of-type',password) // labels each have input; fill via indexed selector below
   await p.eval(`(()=>{const e=[...document.querySelectorAll('input')][1];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(password)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)
   await click(p,'Reset password')
   await wait(p,"document.body.innerText.includes('Password changed. All previous sessions')",'anonymous reset success retained')
   results.push('anonymous reset link survives bootstrap; fragment stripped; success retained')
  }
  if(index===0) await login(p,data.email,password)
  else { await p.goto(origin+'/pantry',{settleMs:100});await wait(p,"!!document.querySelector('.pantry-view-tabs')",'shared browser session') }
  if(index===0){
   // Authenticated reset link must also stay stable when lock changes auth status.
   const reset=await fixture(true)
   await p.goto(origin+'/reset-password#token='+reset.token,{settleMs:100})
   await wait(p,"!!document.querySelector('input[autocomplete=new-password]')",'authenticated recovery')
   await sleep(500)
   password='Synthetic-next-'+randomUUID()
   await p.eval(`(()=>{for(const e of document.querySelectorAll('input')){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(password)});e.dispatchEvent(new Event('input',{bubbles:true}))}})()`)
   await click(p,'Reset password')
   await wait(p,"document.body.innerText.includes('Password changed. All previous sessions')",'authenticated success retained')
   await login(p,data.email,password)
   results.push('authenticated reset survives bootstrap and lock; normal new-password login')
  }
  await p.goto(origin+'/profile',{settleMs:100});await wait(p,"document.body.innerText.includes('Your account data')",'account controls')
  assert(await p.eval(`document.documentElement.scrollWidth<=${width}`),'profile no horizontal overflow')
  await p.screenshot({path:out+'/controls-'+width+'.jpg',quality:85,fullPage:true})
  await click(p,'Delete account…');await click(p,'Cancel deletion');assert(!await p.eval("document.body.innerText.includes('Type DELETE to confirm')"))
  await click(p,'Delete account…');await set(p,'input[autocomplete=current-password]:last-of-type','wrong-password')
  // Select the deletion form field by its accessible label to avoid password-change form.
  await p.eval("(()=>{const e=[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Current password to delete')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'wrong-password');e.dispatchEvent(new Event('input',{bubbles:true}))})()")
  await p.eval("(()=>{const e=[...document.querySelectorAll('label')].find(l=>l.textContent.includes('Type DELETE')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'DELETE');e.dispatchEvent(new Event('input',{bubbles:true}))})()")
  await click(p,'Permanently delete account')
  await wait(p,"document.body.innerText.includes('Current password is incorrect.')",'inline wrong password')
  assert.equal(await p.eval("fetch('/api/auth/session').then(r=>r.status)"),200)
  assert(await p.eval("!![...document.querySelectorAll('label')].find(l=>l.textContent.includes('Type DELETE'))"),'wrong password retains form/session at width '+width)
  await click(p,'Cancel deletion')
  results.push(`controls, cancellation, inline reauthentication error and no overflow at ${width}px`)
  if(index===3){
   const second=await browser.newPage({width:768,height:900});await second.goto(origin+'/pantry',{settleMs:100});await wait(second,"!!document.querySelector('.pantry-view-tabs')",'second tab')
   await p.eval(`localStorage.setItem('grocea:trial:${data.userId}',JSON.stringify({synthetic:true}));localStorage.setItem('grocea:trial:other-fixture',JSON.stringify({synthetic:true}))`)
   await click(p,'Delete account…')
   await p.eval(`(()=>{const labels=[...document.querySelectorAll('label')];const e=labels.find(l=>l.textContent.includes('Current password to delete')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(password)});e.dispatchEvent(new Event('input',{bubbles:true}));const c=labels.find(l=>l.textContent.includes('Type DELETE')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(c,'DELETE');c.dispatchEvent(new Event('input',{bubbles:true}))})()`)
   await click(p,'Permanently delete account')
   await wait(p,"!!document.querySelector('input[type=email]') && !document.body.innerText.includes('Finishing account cleanup')",'deleted cleanup complete')
   await wait(second,"!!document.querySelector('input[type=email]') && !document.body.innerText.includes('Finishing account cleanup')",'cross-tab invalidation')
   const local=await p.eval(`(async()=>({databases:await indexedDB.databases(),trial:localStorage.getItem('grocea:trial:${data.userId}'),other:localStorage.getItem('grocea:trial:other-fixture'),last:localStorage.getItem('grocea:last-account'),unlock:localStorage.getItem('grocea:local-unlocked')}))()`)
   assert(!local.databases.some(db=>db.name==='grocea:'+data.userId));assert.equal(local.trial,null);assert(local.other);assert.equal(local.last,null);assert.equal(local.unlock,null)
   await second.send('Page.reload');await wait(second,"document.body.innerText.includes('Sign in')",'reload remains signed out')
   await second.close();results.push('successful disposable account deletion; two-tab cache/outbox/trial/auth cleanup; other trial key preserved; reload cannot unlock')
  }
  await p.close()
 }
 await writeFile(out+'/results.json',JSON.stringify({checks:results},null,2));console.log(JSON.stringify({passed:results.length,results},null,2))
} finally {await browser.close()}
