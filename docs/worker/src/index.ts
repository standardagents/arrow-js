/**
 * Cloudflare Worker for Arrow playground URL shortening.
 *
 * POST /api/play  { snapshot: string }  → { id: string }
 * GET  /api/play/:id                    → { snapshot: string }
 *
 * Snapshots are content-addressed: SHA-256 hash truncated to 32 hex chars.
 * Duplicate content always produces the same ID with no extra KV writes.
 */

export interface Env {
  PLAY_KV: PlayKvNamespace
}

interface PlayKvNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

const HASH_LENGTH = 32
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

async function contentHash(data: string): Promise<string> {
  const encoded = new TextEncoder().encode(data)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  const hex = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.slice(0, HASH_LENGTH)
}

async function handleSave(
  request: Request,
  env: Env,
): Promise<Response> {
  const body = await request.json() as { snapshot?: unknown }
  if (!body?.snapshot || typeof body.snapshot !== 'string') {
    return Response.json(
      { error: 'Missing snapshot field' },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const id = await contentHash(body.snapshot)
  const existing = await env.PLAY_KV.get(id)

  if (!existing) {
    await env.PLAY_KV.put(id, body.snapshot)
  }

  return Response.json({ id }, { headers: CORS_HEADERS })
}

async function handleLoad(
  id: string,
  env: Env,
): Promise<Response> {
  const snapshot = await env.PLAY_KV.get(id)
  if (!snapshot) {
    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: CORS_HEADERS },
    )
  }

  return Response.json({ snapshot }, { headers: CORS_HEADERS })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (request.method === 'POST' && url.pathname === '/api/play') {
      return handleSave(request, env)
    }

    const loadMatch = url.pathname.match(/^\/api\/play\/([a-f0-9]+)$/)
    if (request.method === 'GET' && loadMatch) {
      return handleLoad(loadMatch[1], env)
    }

    return new Response('Not found', { status: 404 })
  },
}
