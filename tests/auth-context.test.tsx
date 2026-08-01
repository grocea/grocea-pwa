import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../src/app/auth-context'

function Probe() {
  const { status, account } = useAuth()
  return <output data-testid="auth">{status}:{account?.email ?? ''}</output>
}

afterEach(() => vi.unstubAllGlobals())

describe('AuthProvider', () => {
  it('bootstraps a server-confirmed session without persisting credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      account: { id: 'account-a', email: 'a@example.com' },
      csrf_token: 'csrf-a',
      expires_at: '2026-08-31T00:00:00Z',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('authenticated:a@example.com'))
    expect(localStorage.getItem('grocea:last-account')).toContain('account-a')
    expect(localStorage.getItem('grocea:last-account')).not.toContain('csrf-a')
  })

  it('treats a session 401 as anonymous', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ code: 'AUTHENTICATION_REQUIRED', message: 'Authentication is required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })))
    render(<AuthProvider><Probe /></AuthProvider>)
    await waitFor(() => expect(screen.getByTestId('auth').textContent).toBe('anonymous:'))
  })
})
