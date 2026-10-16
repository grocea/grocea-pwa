// Additional lifecycle checks with generated loopback accounts; never print credentials.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const { Browser }=await import(pathToFileURL(process.env.GROCEA_CDP_MODULE))
const browser=await Browser.launch();const origin='http://127.0.0.1:5184';const out='reports/next-phase/task-04-browser';const results=[]
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function wait(p,expr,label){const end=Date.now()+18000;while(Date.now()<end){if(await p.eval(expr))return;await sleep(80)}throw Error('Timed out: '+label)}
const click=(p,text)=>p.eval(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e)throw Error('Missing action');e.click()})()`)
async function register(p){const password='Synthetic-'+randomUUID(),email='fence-'+randomUUID()+'@example.com';const uid=await p.eval(`(async()=>{const r=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:${JSON.stringify(email)},password:${JSON.stringify(password)},display_name:'Synthetic lifecycle check'})});if(!r.ok)throw Error('Register failed');return(await r.json()).account.id})()`);return{password,email,uid}}
async function deleteViaApi(p,fixture){await p.eval(`(async()=>{await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:${JSON.stringify(fixture.email)},password:${JSON.stringify(fixture.password)}})});const a=await fetch('/api/auth/session').then(r=>r.json());const r=await fetch('/api/account',{method:'DELETE',headers:{'Content-Type':'application/json','X-CSRF-Token':a.csrf_token},body:JSON.stringify({current_password:${JSON.stringify(fixture.password)},confirmation:'DELETE'})});if(r.status!==204)throw Error('Fixture cleanup failed')})()`)}
try{
 const p=await browser.newPage({width:1440,height:900});await p.goto(origin+'/login',{settleMs:100});const a=await register(p)
 await p.goto(origin+'/profile',{settleMs:100});await wait(p,"document.body.innerText.includes('Your account data')",'A profile')
 // Hold the decoded export body after fetch resolves; switch cookie and app to B.
 await p.eval("(()=>{const original=window.fetch.bind(window);window.fetch=async(...args)=>{const r=await original(...args);if(String(args[0]).endsWith('/api/account/export')){const json=r.json.bind(r);r.json=()=>new Promise(resolve=>{window.releaseExportBody=async()=>resolve(await json())})}return r}})()")
 let downloads=0;browser.on('','Browser.downloadWillBegin',()=>{downloads++});await browser.send('Browser.setDownloadBehavior',{behavior:'deny',eventsEnabled:true})
 await click(p,'Export account data');await wait(p,"typeof window.releaseExportBody==='function'",'held export body')
 const b=await register(p);await p.eval("window.dispatchEvent(new Event('online'))")
 await wait(p,`JSON.parse(localStorage.getItem('grocea:last-account')||'null')?.id===${JSON.stringify(b.uid)}`,'B activated')
 await p.eval('window.releaseExportBody()');await sleep(300);assert.equal(downloads,0,'old A export cannot download after B activates')
 results.push('held decoded account-A export body rejected after account-B activation; no stale download')
 await deleteViaApi(p,b);await deleteViaApi(p,a);await p.close()
 // Intentionally hold a raw IDB connection without a versionchange handler.
 const q=await browser.newPage({width:390,height:844});await q.goto(origin+'/login',{settleMs:100});const c=await register(q)
 await q.goto(origin+'/profile',{settleMs:100});await wait(q,"document.body.innerText.includes('Your account data')",'C profile')
 await q.eval(`new Promise(resolve=>{const r=indexedDB.open('grocea:${c.uid}');r.onsuccess=()=>{window.fixtureBlocker=r.result;resolve(true)}})`)
 await click(q,'Delete account…')
 await q.eval(`(()=>{const labels=[...document.querySelectorAll('label')];for(const [text,value] of [['Current password to delete',${JSON.stringify(c.password)}],['Type DELETE','DELETE']]){const e=labels.find(l=>l.textContent.includes(text)).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}))}})()`)
 await click(q,'Permanently delete account');await wait(q,"document.body.innerText.includes('Close other Grocea tabs')",'blocked cleanup surfaced')
 await q.send('Page.reload');await wait(q,"document.body.innerText.includes('Finishing account cleanup') || document.body.innerText.includes('Sign in')",'cleanup retry on reload')
 // Reload closes the intentionally blocking connection; persistent marker resumes purge.
 await wait(q,"document.body.innerText.includes('Sign in') && !document.body.innerText.includes('Finishing account cleanup')",'cleanup after reload')
 assert(!await q.eval(`indexedDB.databases().then(d=>d.some(x=>x.name==='grocea:${c.uid}'))`))
 results.push('blocked IndexedDB purge shows recovery; reload resumes persistent cleanup and account DB is gone')
 await q.close()
 // Existing isolated development demo remains functional without auth API.
 const demo=await browser.newPage({width:390,height:844});let authRequests=0
 browser.on(demo.sessionId,'Network.requestWillBeSent',e=>{if(e.request.url.includes('/api/auth/'))authRequests++});await demo.send('Network.enable')
 await demo.goto('http://127.0.0.1:5185/pantry',{settleMs:100});await wait(demo,"!!document.querySelector('.pantry-view-tabs')",'demo load');await demo.send('Page.reload');await wait(demo,"!!document.querySelector('.pantry-view-tabs')",'demo reload');assert.equal(authRequests,0)
 results.push('development demo loads/reloads with isolated account guard and no auth network calls')
 await demo.close();await mkdir(out,{recursive:true});await writeFile(out+'/fencing-results.json',JSON.stringify({checks:results},null,2));console.log(JSON.stringify({passed:results.length,results},null,2))
}finally{await browser.close()}
