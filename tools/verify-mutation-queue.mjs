import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/app/mutationQueue.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { orderQueuedMutations } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const mutation = (id, dependsOn = [], status = 'pending') => ({ id, dependsOn, status, createdAt: '2026-10-16T00:00:00Z' })
const list = mutation('list')
const item = mutation('item', ['list'])
const edit = mutation('edit', ['item'])
assert.deepEqual(orderQueuedMutations([edit, item, list]).ordered.map(row => row.id), ['list', 'item', 'edit'])
assert.deepEqual(orderQueuedMutations([mutation('item', ['acknowledged-list'])]).ordered.map(row => row.id), ['item'])
assert.deepEqual(orderQueuedMutations([item, mutation('list', [], 'failed')]).ordered.map(row => row.status), ['failed', 'pending'])
const cycle = orderQueuedMutations([mutation('a', ['b']), mutation('b', ['a']), mutation('child', ['a']), mutation('independent')])
assert.deepEqual(cycle.ordered.map(row => row.id), ['independent'])
assert.deepEqual(cycle.blocked.map(row => row.id), ['a', 'b', 'child'])
console.log('PASS: tied/reversed creation ordering, acknowledged dependencies, failed-parent ordering, cycles and downstream blocking.')
