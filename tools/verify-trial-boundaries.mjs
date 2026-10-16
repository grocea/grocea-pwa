// Focused executable contract checks; no Vitest or fixture kitchen payloads.
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
const temp = await mkdtemp(join(tmpdir(), 'grocea-trial-'))
const data = new Map()
let block = false, blockRead = false
const storage = new Proxy({getItem:k=>{if(blockRead && k.startsWith('grocea:trial:'))throw Error('blocked');return data.get(k)??null}, setItem:(k,v)=>{if(block && k.startsWith('grocea:trial:'))throw Error('quota');data.set(k,v)},removeItem:k=>data.delete(k)}, {ownKeys:()=>[...data.keys()],getOwnPropertyDescriptor:()=>({enumerable:true,configurable:true})})
let lockQueue=Promise.resolve();Object.defineProperty(globalThis,'navigator',{value:{locks:{request:(_key,task)=>{const next=lockQueue.then(task);lockQueue=next.catch(()=>{});return next}}},configurable:true});
globalThis.localStorage=storage
globalThis.window={addEventListener(){},dispatchEvent(){}}
globalThis.BroadcastChannel=undefined
globalThis.CustomEvent=class { constructor(name,props){this.name=name;this.detail=props?.detail} }
try {
 for(const name of ['account-lifecycle','trial-journal']) {
  const source=await readFile(`src/app/${name}.ts`,'utf8')
  await writeFile(join(temp,name+'.mjs'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("'./account-lifecycle'","'./account-lifecycle.mjs'"))
 }
 const life=await import(pathToFileURL(join(temp,'account-lifecycle.mjs')))
 const t=await import(pathToFileURL(join(temp,'trial-journal.mjs')))
 const id='synthetic-a';life.setActiveAccount(id)
 const candidate=async (mid,period=t.consentPeriod(id))=>await t.trialCandidate(id,period,mid,'stock.operation','2026-10-16T00:00:00Z')
 await candidate('before');assert.equal(t.readTrial(id),null)
 assert(await t.startTrial(id));await t.trialAcknowledge(id,'before');assert.equal(t.readTrial(id).outcomes.length,0)
 const period=t.consentPeriod(id);await candidate('pending');assert.equal(t.readTrial(id).outcomes.length,0)
 await t.trialAcknowledge(id,'pending');await t.trialAcknowledge(id,'pending');assert.equal(t.readTrial(id).outcomes.length,1)
 await candidate('rejected');await t.trialReject(id,['rejected']);await t.trialAcknowledge(id,'rejected');assert.equal(t.readTrial(id).outcomes.length,1)
 await t.trialCandidate(id,period,'cook','recipe.cook','2026-10-16T00:00:00Z');await t.stopTrial(id);await t.trialAcknowledge(id,'cook');assert.equal(t.readTrial(id).outcomes.length,1)
 assert(await t.clearTrial(id));assert(await t.startTrial(id));await candidate('old',period);assert.equal(Object.keys(t.readTrial(id).pending).length,0)
 await candidate('clear');await t.clearTrial(id);await t.startTrial(id);await t.trialAcknowledge(id,'clear');assert.equal(t.readTrial(id).outcomes.length,0)
 await t.trialReturn(id);assert.equal(t.readTrial(id).returns.length,0)
 const earlier=t.readTrial(id);earlier.startDate='2026-01-01';storage.setItem(life.TRIAL_STORAGE_PREFIX+id,JSON.stringify(earlier));await t.trialReturn(id);await t.trialReturn(id);assert.equal(t.readTrial(id).returns.length,1)
 await t.saveTrialNote(id,'Self reported');const note=t.readTrial(id).notes[0];await t.saveTrialNote(id,'Edited',note.id);assert.equal(t.readTrial(id).notes[0].text,'Edited')
 const exported=JSON.stringify(t.trialExport(id));assert(!exported.includes(id));assert(!exported.includes('pending'));assert(!exported.includes(note.id));await t.deleteTrialNote(id,note.id);assert.equal(t.readTrial(id).notes.length,0)
 life.setActiveAccount('synthetic-b');assert.equal(t.readTrial('synthetic-b'),null);assert.equal(t.consentPeriod(id),undefined)
 life.setActiveAccount(id);await t.clearTrial(id);await t.startTrial(id);await candidate('quota');block=true;await assert.doesNotReject(async()=>await t.trialAcknowledge(id,'quota'));assert(t.trialError(id));assert.equal(t.consentPeriod(id),undefined);block=false;await t.clearTrial(id);await t.startTrial(id)
 await t.clearTrial(id);await t.startTrial(id);blockRead=true;await assert.doesNotReject(async()=>await t.trialAcknowledge(id,'blocked-read'));assert(t.trialError(id));blockRead=false;await t.clearTrial(id)
 for(const malformed of [{version:1}, {version:1,returns:null}, {...earlier,outcomes:[null]}, {...earlier,pending:{bad:null}}, {...earlier,notes:[null]}]) { storage.setItem(life.TRIAL_STORAGE_PREFIX+id,JSON.stringify(malformed));await assert.doesNotReject(async()=>await t.trialAcknowledge(id,'bad'));await assert.doesNotReject(async()=>await t.trialReturn(id));assert(t.trialError(id));await t.clearTrial(id) }
 const realLocks=navigator.locks;navigator.locks=undefined;await assert.doesNotReject(async()=>await t.startTrial(id));assert(t.trialError(id));assert(await t.clearTrial(id));navigator.locks={request:()=>{throw Error('synchronous lock failure')}};await assert.doesNotReject(async()=>await t.trialAcknowledge(id,'lock-failed'));assert(t.trialError(id));navigator.locks=realLocks;await t.clearTrial(id)
 life.controlAccount(id,'deleted');await assert.doesNotReject(async()=>await candidate('deleted'));assert.equal(t.consentPeriod(id),undefined);life.clearTrialStorage(id);assert.equal(storage.getItem(life.TRIAL_STORAGE_PREFIX+id),null)
 console.log('PASS: off-by-default, consent period, ACK dedup, rejection, stop/clear, later-day return, notes, export whitelist, account guard, quota isolation, deletion namespace')
} finally { await rm(temp,{recursive:true,force:true}) }
