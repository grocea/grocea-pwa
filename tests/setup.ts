import 'fake-indexeddb/auto'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

const storedValues = new Map<string, string>()
const testLocalStorage: Storage = {
  get length() { return storedValues.size },
  clear: () => storedValues.clear(),
  getItem: key => storedValues.get(key) ?? null,
  key: index => [...storedValues.keys()][index] ?? null,
  removeItem: key => { storedValues.delete(key) },
  setItem: (key, value) => { storedValues.set(key, String(value)) },
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: testLocalStorage })
Object.defineProperty(window, 'localStorage', { configurable: true, value: testLocalStorage })

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => cleanup())
