const BACKEND_ORIGIN = 'https://grocea-backend.vercel.app'

export interface WorkerAssets {
  fetch(request: Request): Promise<Response>
}

export interface WorkerEnv {
  ASSETS: WorkerAssets
}

export function isApiRequest(request: Request): boolean {
  const { pathname } = new URL(request.url)
  return pathname === '/api' || pathname.startsWith('/api/')
}

export function createBackendRequest(request: Request): Request {
  const incomingUrl = new URL(request.url)
  const backendUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, BACKEND_ORIGIN)
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
    // Return upstream response directly: preserves status, body, and Set-Cookie headers.
    return fetch(createBackendRequest(request))
  }

  return env.ASSETS.fetch(request)
}

export default {
  fetch: handleRequest,
}
