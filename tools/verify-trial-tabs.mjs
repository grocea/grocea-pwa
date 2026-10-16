// Real same-origin Chromium Web Locks; synthetic journal-only candidates, not study outcomes.
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const { Browser }=await import(pathToFileURL(process.env.GROCEA_CDP_MODULE))
const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64')
const lifecycle=url(transpile(await readFile('src/app/account-lifecycle.ts','utf8')))
const trial=url(transpile(await readFile('src/app/trial-journal.ts','utf8')).replace("'./account-lifecycle'",JSON.stringify(lifecycle)))
const browser=await Browser.launch(),results=[]
try {
 const a=await browser.newPage({width:768,height:900}),b=await browser.newPage({width:768,height:900})
 for(const page of [a,b]){await page.goto('http://127.0.0.1:5184/welcome',{settleMs:100});await page.eval(`(async()=>{window.life=await import(${JSON.stringify(lifecycle)});window.j=await import(${JSON.stringify(trial)});life.setActiveAccount('synthetic-tab-boundary')})()`)}
 const call=(p,body)=>p.eval(`(async()=>{const id='synthetic-tab-boundary';${body}})()`)
 await call(a,"await j.clearTrial(id);await j.startTrial(id);await j.trialCandidate(id,j.consentPeriod(id),'one','recipe.cook',new Date().toISOString())")
 await Promise.all([call(a,"await j.trialAcknowledge(id,'one')"),call(b,"await j.saveTrialNote(id,'Synthetic concurrency note')")])
 const snapshot=await call(a,'return j.readTrial(id)');assert.equal(snapshot.outcomes.length,1);assert.equal(snapshot.notes.length,1);results.push('simultaneous cross-tab ACK + note retains both under shared Web Lock')
 await call(a,"await j.trialCandidate(id,j.consentPeriod(id),'two','recipe.cook',new Date().toISOString())")
 await Promise.all([call(a,"await j.stopTrial(id)"),call(b,"await j.trialAcknowledge(id,'two')")])
 const stopped=await call(a,'return j.readTrial(id)');assert.equal(stopped.active,false);assert.equal(Object.keys(stopped.pending).length,0);assert(stopped.outcomes.length<=2);await call(b,"await j.trialAcknowledge(id,'two')");assert.equal((await call(a,'return j.readTrial(id)')).outcomes.length,stopped.outcomes.length);results.push('simultaneous cross-tab stop + ACK leaves stopped consent, no candidate resurrection or late promotion')
 // Hold the lock in one tab: kitchen caller remains synchronous/nonblocking; original consent does not change.
 await call(a,'await j.clearTrial(id)')
 await a.eval("window.releaseLock=null;window.held=navigator.locks.request('grocea:trial:synthetic-tab-boundary',()=>new Promise(r=>window.releaseLock=r));void 0")
 await b.eval("window.originalPeriod=j.consentPeriod('synthetic-tab-boundary');window.starting=j.startTrial('synthetic-tab-boundary');void 0")
 assert.equal(await b.eval('window.originalPeriod'),undefined);await a.eval('window.releaseLock()');await b.eval('window.starting');await b.eval("j.trialCandidate('synthetic-tab-boundary',window.originalPeriod,'pre-consent-held','stock.bulk',new Date().toISOString())");assert.equal(Object.keys((await call(a,'return j.readTrial(id)')).pending).length,0);results.push('held journal lock does not grant newly started consent to an originally unconsented action')
 await call(a,'await j.clearTrial(id)')
 await mkdir('reports/next-phase/task-06-browser',{recursive:true});await writeFile('reports/next-phase/task-06-browser/tabs.json',JSON.stringify({environment:'real Chromium tabs + production journal module transpiled without behavior changes; synthetic candidates only',results},null,2));console.log(JSON.stringify({passed:results.length,results}))
}finally{await browser.close()}
