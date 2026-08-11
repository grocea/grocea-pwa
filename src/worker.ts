export interface WorkerAssets {
  fetch(request: Request): Promise<Response>
}

export interface WorkerEnv {
  ASSETS: WorkerAssets
  BACKEND_ORIGIN: string
}

export function isApiRequest(request: Request): boolean {
  const { pathname } = new URL(request.url)
  return pathname === '/api' || pathname.startsWith('/api/')
}

export function createBackendRequest(request: Request, backendOrigin: string): Request {
  const incomingUrl = new URL(request.url)
  const backendUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backendOrigin.replace(/\/$/, ''))
  const headers = new Headers(request.headers)

  // Let fetch derive the upstream host and content length from the backend URL/body.
  headers.delete('Host')
  headers.delete('Content-Length')

  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  }
  if (init.body) init.duplex = 'half'

  return new Request(backendUrl, init)
}

export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  if (isApiRequest(request)) {
    if (!env.BACKEND_ORIGIN) return new Response('BACKEND_ORIGIN is not configured.', { status: 500 })
    // Return upstream response directly: preserves status, body, and Set-Cookie headers.
    return fetch(createBackendRequest(request, env.BACKEND_ORIGIN))
  }

  return env.ASSETS.fetch(request)
}

export default {
  fetch: handleRequest,
}
