// Real account plus controlled 503 for initial state only: status/layout negative case.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const { Browser }=await import(pathToFileURL(process.env.GROCEA_CDP_MODULE)),browser=await Browser.launch()
const wait=async(p,e,label)=>{const end=Date.now()+15000;while(Date.now()<end){if(await p.eval(e))return;await new Promise(r=>setTimeout(r,80))}throw Error(label)}
try {
 const p=await browser.newPage({width:320,height:844,mobile:true});await p.goto('http://127.0.0.1:5184/login',{settleMs:100});const id=randomUUID()
 await p.eval(`fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'first-${id}@example.com',password:'Synthetic-${id}',display_name:'Synthetic first sync'})}).then(r=>{if(!r.ok)throw Error('registration')})`)
 browser.on(p.sessionId,'Fetch.requestPaused',async e=>{await p.send('Fetch.fulfillRequest',{requestId:e.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({error:{code:'UNAVAILABLE',message:'Synthetic first-sync outage'}})).toString('base64')})})
 await p.send('Fetch.enable',{patterns:[{urlPattern:'*/api/state',requestStage:'Request'}]});await p.goto('http://127.0.0.1:5184/pantry',{settleMs:100});await wait(p,"document.body.innerText.includes('First sync pending')",'first-sync honest gate')
 assert(await p.eval("document.documentElement.scrollWidth===320"),'320 document no overflow')
 const geometry=await p.eval(`(()=>{const label=document.querySelector('.sync-visible-label'),header=document.querySelector('.brand-header'),action=document.querySelector('.header-action');return {label:label.textContent,labelWidth:label.getBoundingClientRect().width,headerWidth:header.getBoundingClientRect().width,actionLeft:action.getBoundingClientRect().left,wordmarkRight:header.querySelector('.wordmark').getBoundingClientRect().right,labelScroll:label.scrollWidth,labelClient:label.clientWidth}})()`)
 assert(geometry.actionLeft>=geometry.wordmarkRight,'header controls separated')
 await mkdir('reports/next-phase/task-01-browser',{recursive:true});await p.screenshot({path:'reports/next-phase/task-01-browser/first-sync-320.jpg',quality:85,fullPage:true})
 await p.send('Fetch.disable');await p.eval("window.dispatchEvent(new Event('grocea:sync'))");await wait(p,"!!document.querySelector('.sync-indicator.synced')",'first sync recovers')
 await p.send('Page.reload');await wait(p,"!!document.querySelector('.pantry-view-tabs')",'durable first-sync reload')
 // Controlled mutation outage gives a durable pending label at the same320px.
 await p.send('Fetch.enable',{patterns:[{urlPattern:'*/api/profile',requestStage:'Request'}]})
 await p.eval("history.pushState({},'','/profile');window.dispatchEvent(new PopStateEvent('popstate'))")
 await wait(p,"!!document.querySelector('input[value=\"Synthetic first sync\"]')",'profile')
 await p.eval("(()=>{const e=document.querySelector('input[value=\"Synthetic first sync\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Synthetic pending');e.dispatchEvent(new Event('input',{bubbles:true}))})()")
 await p.eval("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save changes').click()")
 await wait(p,"!!document.querySelector('.success-notice')",'pending profile durable')
 await p.eval("history.pushState({},'','/pantry');window.dispatchEvent(new PopStateEvent('popstate'))")
 await wait(p,"document.querySelector('.sync-visible-label')?.textContent.includes('pending')",'pending label')
 assert(await p.eval("document.documentElement.scrollWidth===320"));await p.screenshot({path:'reports/next-phase/task-01-browser/pending-320.jpg',quality:85,fullPage:true})
 await p.send('Fetch.disable');await p.eval("window.dispatchEvent(new Event('grocea:sync'))");await wait(p,"!!document.querySelector('.sync-indicator.synced')",'pending replay')
 // Advance the server revision independently; next local profile write must fail visibly.
 await p.eval(`(async()=>{const auth=await fetch('/api/auth/session').then(r=>r.json());const state=await fetch('/api/state').then(r=>r.json());const r=await fetch('/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json','X-CSRF-Token':auth.csrf_token,'X-Device-ID':crypto.randomUUID(),'Idempotency-Key':crypto.randomUUID(),'X-Expected-State-Revision':String(state.revision)},body:JSON.stringify({display_name:'Synthetic remote',preferred_servings:2})});if(!r.ok)throw Error('remote fixture')})()`)
 await p.eval("history.pushState({},'','/profile');window.dispatchEvent(new PopStateEvent('popstate'))")
 await wait(p,"!!document.querySelector('input[value=\"Synthetic pending\"]')",'cached profile')
 await p.eval("(()=>{const e=document.querySelector('input[value=\"Synthetic pending\"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'Synthetic conflict');e.dispatchEvent(new Event('input',{bubbles:true}))})()")
 await p.eval("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Save changes').click()")
 await wait(p,"!!document.querySelector('.success-notice')",'local conflict saved');await p.eval("history.pushState({},'','/pantry');window.dispatchEvent(new PopStateEvent('popstate'))")
 await wait(p,"!!document.querySelector('.sync-indicator.failed')",'visible rejected conflict')
 assert(await p.eval("document.documentElement.scrollWidth===320"));await p.screenshot({path:'reports/next-phase/task-01-browser/error-320.jpg',quality:85,fullPage:true})
 await writeFile('reports/next-phase/task-01-browser/first-sync-results.json',JSON.stringify({controlledInitial503:true,geometry,recovered:true,pendingAndConflict320:true},null,2));console.log('PASS first-sync actionable gate/320 header and recovery',geometry)
}finally{await browser.close()}
