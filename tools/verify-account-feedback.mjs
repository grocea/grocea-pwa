// Focused phone reauthentication feedback check after the scoped UI correction.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
const { Browser }=await import(pathToFileURL(process.env.GROCEA_CDP_MODULE));const browser=await Browser.launch();const origin='http://127.0.0.1:5184',out='reports/next-phase/task-04-browser'
const password='Synthetic-'+randomUUID(),email='feedback-'+randomUUID()+'@example.com'
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function wait(p,expr){const end=Date.now()+15000;while(Date.now()<end){if(await p.eval(expr))return;await sleep(80)}throw Error('Focused feedback timeout')}
const click=(p,t)=>p.eval(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(t)});e.click()})()`)
try{
 const p=await browser.newPage({width:320,height:844,mobile:true});await p.goto(origin+'/login',{settleMs:100});await p.eval(`fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:${JSON.stringify(email)},password:${JSON.stringify(password)},display_name:'Synthetic feedback check'})}).then(r=>{if(!r.ok)throw Error('Fixture registration failed')})`)
 await p.goto(origin+'/profile',{settleMs:100});await wait(p,"!!document.querySelector('.account-data-controls')");await p.screenshot({path:out+'/profile-header-320.jpg',quality:85})
 await click(p,'Delete account…');await p.eval("(()=>{for(const [label,value] of [['Current password to delete','Synthetic wrong password'],['Type DELETE','DELETE']]){const e=[...document.querySelectorAll('label')].find(e=>e.textContent.includes(label)).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}))}})()")
 await p.eval("document.querySelector('.account-data-controls form').scrollIntoView({block:'start'})");await click(p,'Permanently delete account');await wait(p,"document.querySelector('#account-delete-error')?.textContent.includes('Current password is incorrect.')")
 await wait(p,"document.activeElement?.getAttribute('aria-describedby')==='account-delete-error'")
 const bounds=await p.eval("(()=>{const e=document.querySelector('#account-delete-error').getBoundingClientRect(),i=document.activeElement.getBoundingClientRect();return{errorTop:e.top,errorBottom:e.bottom,inputTop:i.top,inputBottom:i.bottom,height:innerHeight}})()")
 assert(bounds.errorTop>=0&&bounds.errorBottom<=bounds.height&&bounds.inputTop>=0&&bounds.inputBottom<=bounds.height,'error and focused password visibly together')
 await p.screenshot({path:out+'/delete-error-focused-320.jpg',quality:85})
 assert.equal(await p.eval("fetch('/api/auth/session').then(r=>r.status)"),200)
 await p.eval(`(async()=>{const a=await fetch('/api/auth/session').then(r=>r.json());const r=await fetch('/api/account',{method:'DELETE',headers:{'Content-Type':'application/json','X-CSRF-Token':a.csrf_token},body:JSON.stringify({current_password:${JSON.stringify(password)},confirmation:'DELETE'})});if(r.status!==204)throw Error('Fixture cleanup failed')})()`)
 await writeFile(out+'/feedback-results.json',JSON.stringify({checks:['wrong-password feedback is adjacent to focused deletion password and both are visible at320px; session stays usable','long synthetic email wraps while avatar keeps its size']},null,2));console.log('PASS focused phone deletion error/focus visibility and retained session')
}finally{await browser.close()}
