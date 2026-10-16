import { assertAccountAvailable, clearTrialStorage, TRIAL_STORAGE_PREFIX } from './account-lifecycle'

export type Milestone = 'pantry_setup' | 'shopping_completed' | 'cooking_completed'
type Candidate = { period: string; action: Milestone; at: string }
export type Trial = {
  version: 1; consentVersion: '2026-10-16'; period: string; startedAt: string; startDate: string
  active: boolean; stoppedAt?: string
  outcomes: { action: Milestone; at: string; acknowledgedAt: string }[]
  returns: string[]; notes: { id: string; at: string; text: string }[]
  pending: Record<string, Candidate>
}
const failures = new Set<string>()
const key = (userId: string) => `${TRIAL_STORAGE_PREFIX}${userId}`
const notify = () => window.dispatchEvent(new Event('grocea:trial-change'))
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
// Optional journal storage must never throw into kitchen writes or sync.
function safely<T>(userId: string, task: () => T): T | undefined {
  try { assertAccountAvailable(userId); return task() } catch { const first = !failures.has(userId); failures.add(userId); if (first) notify(); return undefined }
}
export function trialError(userId: string) { return failures.has(userId) }
export function readTrial(userId: string): Trial | null {
  return safely(userId, () => {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const trial = JSON.parse(raw) as Trial
    const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
    const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
    const action = (value: unknown) => ['pantry_setup', 'shopping_completed', 'cooking_completed'].includes(String(value))
    if (!object(trial) || trial.version !== 1 || trial.consentVersion !== '2026-10-16' || typeof trial.period !== 'string' || !date(trial.startedAt) || typeof trial.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(trial.startDate) || typeof trial.active !== 'boolean' || (trial.stoppedAt !== undefined && !date(trial.stoppedAt))
      || !Array.isArray(trial.returns) || !trial.returns.every(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
      || !Array.isArray(trial.outcomes) || !trial.outcomes.every(value => object(value) && action(value.action) && date(value.at) && date(value.acknowledgedAt))
      || !Array.isArray(trial.notes) || !trial.notes.every(value => object(value) && typeof value.id === 'string' && date(value.at) && typeof value.text === 'string' && value.text.length <= 2000)
      || !object(trial.pending) || !Object.values(trial.pending).every(value => object(value) && typeof value.period === 'string' && action(value.action) && date(value.at))) throw new Error('Invalid journal')
    return trial
  }) ?? null
}
function save(userId: string, trial: Trial) {
  return safely(userId, () => { localStorage.setItem(key(userId), JSON.stringify(trial)); notify(); return true }) ?? false
}
function startTrialLocked(userId: string) {
  // A new period always requires explicit consent; previous data must be cleared first.
  failures.delete(userId)
  if (readTrial(userId)) return false
  return save(userId, { version: 1, consentVersion: '2026-10-16', period: crypto.randomUUID(), startedAt: new Date().toISOString(), startDate: localDate(), active: true, outcomes: [], returns: [], notes: [], pending: {} })
}
function stopTrialLocked(userId: string) {
  const trial = readTrial(userId)
  if (!trial) return false
  trial.active = false; trial.stoppedAt = new Date().toISOString(); trial.pending = {}
  return save(userId, trial)
}
function clearTrialLocked(userId: string) {
  const result = safely(userId, () => { clearTrialStorage(userId); return true }) ?? false
  if (result) failures.delete(userId)
  notify(); return result
}
export function consentPeriod(userId: string) {
  if (failures.has(userId)) return undefined
  const trial = readTrial(userId)
  return trial?.active ? trial.period : undefined
}
export function milestoneFor(type: string): Milestone | undefined {
  if (type === 'stock.operation' || type === 'stock.bulk') return 'pantry_setup'
  if (type === 'grocery-list.complete') return 'shopping_completed'
  if (type === 'recipe.cook') return 'cooking_completed'
}
function trialCandidateLocked(userId: string, period: string | undefined, id: string, type: string, at: string) {
  const action = milestoneFor(type)
  if (!period || !action || failures.has(userId)) return
  const trial = readTrial(userId)
  if (!trial?.active || trial.period !== period) return
  trial.pending[id] = { period, action, at }
  save(userId, trial)
}
function trialAcknowledgeLocked(userId: string, id: string) {
  if (failures.has(userId)) return
  const trial = readTrial(userId), candidate = trial?.pending[id]
  if (!trial?.active || !candidate || candidate.period !== trial.period) return
  // Setup is the first acknowledged stock action; shopping and cooking count each ACK once.
  if (candidate.action !== 'pantry_setup' || !trial.outcomes.some(item => item.action === 'pantry_setup')) {
    trial.outcomes.push({ action: candidate.action, at: candidate.at, acknowledgedAt: new Date().toISOString() })
  }
  delete trial.pending[id]; save(userId, trial)
}
function trialRejectLocked(userId: string, ids: string[]) {
  const trial = readTrial(userId)
  if (!trial || !ids.some(id => id in trial.pending)) return
  ids.forEach(id => { delete trial.pending[id] }); save(userId, trial)
}
function trialReturnLocked(userId: string) {
  if (failures.has(userId)) return
  const trial = readTrial(userId), today = localDate()
  if (!trial?.active || today <= trial.startDate || trial.returns.includes(today)) return
  trial.returns.push(today); save(userId, trial)
}
function saveTrialNoteLocked(userId: string, text: string, id?: string) {
  if (failures.has(userId)) return false
  const trial = readTrial(userId), value = text.trim().slice(0, 2000)
  if (!trial?.active || !value) return false
  const note = trial.notes.find(item => item.id === id)
  if (note) note.text = value
  else trial.notes.push({ id: crypto.randomUUID(), at: new Date().toISOString(), text: value })
  return save(userId, trial)
}
function deleteTrialNoteLocked(userId: string, id: string) {
  const trial = readTrial(userId)
  if (!trial) return false
  trial.notes = trial.notes.filter(note => note.id !== id); return save(userId, trial)
}
export function trialExport(userId: string) {
  if (failures.has(userId)) return null
  const trial = readTrial(userId)
  if (!trial) return null
  // Explicit whitelist: account, consent-period and mutation identifiers never leave storage.
  return { format: 'grocea-local-trial', version: trial.version, consentVersion: trial.consentVersion, startedAt: trial.startedAt, startDate: trial.startDate, active: trial.active, stoppedAt: trial.stoppedAt, outcomes: trial.outcomes.map(({ action, at, acknowledgedAt }) => ({ action, at, acknowledgedAt })), returnDates: [...trial.returns], notes: trial.notes.map(({ at, text }) => ({ at, text })) }
}

// Web Locks serialize short synchronous read/modify/write sections across browser tabs.
// Kitchen operations fire these optional tasks without awaiting the journal lock.
function locked<T>(userId: string, task: () => T): Promise<T | undefined> {
  const failed = () => safely(userId, () => { throw new Error('Journal unavailable') })
  try {
    if (!navigator.locks) return Promise.resolve(failed())
    return navigator.locks.request(key(userId), () => safely(userId, task)).catch(failed)
  } catch { return Promise.resolve(failed()) }
}
export const startTrial = (...args: Parameters<typeof startTrialLocked>) => locked(args[0], () => startTrialLocked(...args))
export const stopTrial = (...args: Parameters<typeof stopTrialLocked>) => locked(args[0], () => stopTrialLocked(...args))
export const clearTrial = (userId: string) => {
  // Removal remains available in browsers that cannot serialize recording.
  if (!navigator.locks) return Promise.resolve(safely(userId, () => clearTrialLocked(userId)))
  return locked(userId, () => clearTrialLocked(userId))
}
export const trialCandidate = (...args: Parameters<typeof trialCandidateLocked>) => locked(args[0], () => trialCandidateLocked(...args))
export const trialAcknowledge = (...args: Parameters<typeof trialAcknowledgeLocked>) => locked(args[0], () => trialAcknowledgeLocked(...args))
export const trialReject = (...args: Parameters<typeof trialRejectLocked>) => locked(args[0], () => trialRejectLocked(...args))
export const trialReturn = (...args: Parameters<typeof trialReturnLocked>) => locked(args[0], () => trialReturnLocked(...args))
export const saveTrialNote = (...args: Parameters<typeof saveTrialNoteLocked>) => locked(args[0], () => saveTrialNoteLocked(...args))
export const deleteTrialNote = (...args: Parameters<typeof deleteTrialNoteLocked>) => locked(args[0], () => deleteTrialNoteLocked(...args))
