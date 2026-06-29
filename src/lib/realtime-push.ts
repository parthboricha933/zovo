/**
 * Push events from Next.js API routes to the ZOVO realtime mini-service.
 * The realtime service exposes two HTTP endpoints:
 *   POST /broadcast        { userId, event, data }      -> emits to a single user's sockets
 *   POST /broadcast-ride   { rideId, event, data }      -> emits to all sockets in ride:<rideId> room
 *
 * In dev: the realtime server runs on localhost:3003 (set REALTIME_BASE_URL).
 * In production (Vercel): deploy the realtime service separately (Render/Railway/Fly.io)
 * and set REALTIME_BASE_URL to its public URL.
 */

const RT_BASE = process.env.REALTIME_BASE_URL || 'http://127.0.0.1:3003'

async function post(path: string, body: any) {
  try {
    await fetch(`${RT_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (e) {
    // Non-fatal — real-time server may be down during dev
    console.warn('[realtime-push] failed', path, String(e))
  }
}

export function pushToUser(userId: string, event: string, data: any) {
  return post('/broadcast', { userId, event, data })
}

export function pushToRide(rideId: string, event: string, data: any) {
  return post('/broadcast-ride', { rideId, event, data })
}

/** Convenience: push the same event to a list of users (e.g. driver + passenger). */
export function pushToUsers(userIds: string[], event: string, data: any) {
  return Promise.all(userIds.map((u) => post('/broadcast', { userId: u, event, data })))
}
