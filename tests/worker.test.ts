import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleRequest } from '../src/worker'

afterEach(() => vi.restoreAllMocks())

describe('Cloudflare Worker API proxy', () => {
  it('forwards API requests to the backend and preserves the upstream response', async () => {
    const upstream = new Response('{"ok":true}', {
      status: 200,
      headers: [
        ['Content-Type', 'application/json'],
        ['Set-Cookie', 'grocea_session=token; Path=/api; HttpOnly'],
      ],
    })
    const fetchMock = vi.fn().mockResolvedValue(upstream)
    vi.stubGlobal('fetch', fetchMock)
    const assets = { fetch: vi.fn() }
    const request = new Request('https://grocea-pwa.ammar-jmldn.workers.dev/api/auth/login?returnTo=%2F', {
      method: 'POST',
      headers: {
        Cookie: 'grocea_session=old-token',
        Origin: 'https://grocea-pwa.ammar-jmldn.workers.dev',
        'X-CSRF-Token': 'csrf-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'user@example.com', password: 'long-enough-password' }),
    })

    const response = await handleRequest(request, {
      ASSETS: assets,
      BACKEND_ORIGIN: 'https://grocea-backend.vercel.app',
    })
    const forwarded = fetchMock.mock.calls[0][0] as Request

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(forwarded.url).toBe('https://grocea-backend.vercel.app/api/auth/login?returnTo=%2F')
    expect(forwarded.method).toBe('POST')
    expect(forwarded.headers.get('Cookie')).toBe('grocea_session=old-token')
    expect(forwarded.headers.get('Origin')).toBe('https://grocea-pwa.ammar-jmldn.workers.dev')
    expect(await forwarded.json()).toEqual({ email: 'user@example.com', password: 'long-enough-password' })
    expect(response).toBe(upstream)
    expect(response.headers.get('Set-Cookie')).toContain('grocea_session=token')
  })

  it('fails API requests clearly when the backend origin is not configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const response = await handleRequest(
      new Request('https://grocea-pwa.ammar-jmldn.workers.dev/api/state'),
      { ASSETS: { fetch: vi.fn() }, BACKEND_ORIGIN: '' },
    )

    expect(response.status).toBe(500)
    expect(await response.text()).toContain('BACKEND_ORIGIN')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('serves non-API requests from static assets', async () => {
    const assetResponse = new Response('asset', { status: 200 })
    const assets = { fetch: vi.fn().mockResolvedValue(assetResponse) }
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await handleRequest(
      new Request('https://grocea-pwa.ammar-jmldn.workers.dev/'),
      { ASSETS: assets },
    )

    expect(response).toBe(assetResponse)
    expect(assets.fetch).toHaveBeenCalledOnce()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
