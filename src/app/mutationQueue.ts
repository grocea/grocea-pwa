import type { PendingMutation } from '../domain/types'

// Dependencies absent from the outbox were already acknowledged and removed.
// Timestamp ties must never let an item reach the API before its new list.
export function orderQueuedMutations(queued: PendingMutation[]) {
  const remaining = new Map(queued.map(mutation => [mutation.id, mutation]))
  const ordered: PendingMutation[] = []
  while (remaining.size) {
    const ready = [...remaining.values()].filter(mutation =>
      mutation.dependsOn.every(id => !remaining.has(id)))
    if (!ready.length) break
    ready.forEach(mutation => {
      ordered.push(mutation)
      remaining.delete(mutation.id)
    })
  }
  return { ordered, blocked: [...remaining.values()] }
}
