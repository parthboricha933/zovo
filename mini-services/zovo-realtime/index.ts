// ZOVO Real-time service (Socket.IO)
// Port: 3003
// Forwarded by Caddy via /?XTransformPort=3003
//
// Events:
//   client -> server
//     - subscribe: { token }   (auth handshake, joins room "user:<id>")
//     - ride:subscribe: { rideId }
//     - ride:location: { rideId, lat, lng, heading?, speed? }
//     - chat:send: { bookingId, content }
//     - chat:read: { bookingId, lastMessageId? }
//     - booking:subscribe: { bookingId }
//
//   server -> client
//     - notification  { ...notification }
//     - booking:request   { booking, ride, passenger }
//     - booking:accepted  { booking, ride }
//     - booking:rejected  { bookingId, reason }
//     - booking:cancelled { bookingId }
//     - otp:generated     { bookingId, otp (only to passenger) }
//     - otp:verified      { bookingId }
//     - ride:started      { rideId, bookingId }
//     - ride:completed    { rideId, bookingId }
//     - ride:location     { rideId, lat, lng, heading?, speed? }
//     - chat:message      { message }
//     - chat:read         { bookingId, readerId }
//     - ride:seats        { rideId, availableSeats }
//     - ride:created      { ride }

import { createServer } from 'http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'zovo-dev-secret-change-in-production'
const PORT = 3003

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

interface AuthPayload {
  sub: string
  email: string
  role: string
  isAdmin: boolean
}

// socket.id -> userId
const socketsByUser = new Map<string, Set<string>>()
// socket.id -> userId (for cleanup)
const userBySocket = new Map<string, string>()

function emitToUser(userId: string, event: string, data: any) {
  const sockets = socketsByUser.get(userId)
  if (!sockets) return
  for (const sid of sockets) {
    io.to(sid).emit(event, data)
  }
}

// Allow server-side broadcast via internal HTTP endpoint
// POST /broadcast  { userId, event, data }
import { createRequire } from 'module'
// (No need for require — we use the http server itself for broadcast)

httpServer.on('request', (req, res) => {
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = ''
    req.on('data', c => (body += c))
    req.on('end', () => {
      try {
        const { userId, event, data } = JSON.parse(body || '{}')
        if (userId && event) {
          emitToUser(userId, event, data)
          if (data?.broadcastToRide?.rideId) {
            io.to(`ride:${data.broadcastToRide.rideId}`).emit(event, data)
          }
          res.statusCode = 200
          res.end(JSON.stringify({ ok: true, delivered: socketsByUser.get(userId)?.size || 0 }))
        } else {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false, error: 'missing userId/event' }))
        }
      } catch (e) {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
    })
    return
  }
  if (req.method === 'POST' && req.url === '/broadcast-ride') {
    let body = ''
    req.on('data', c => (body += c))
    req.on('end', () => {
      try {
        const { rideId, event, data } = JSON.parse(body || '{}')
        if (rideId && event) {
          io.to(`ride:${rideId}`).emit(event, data)
          res.statusCode = 200
          res.end(JSON.stringify({ ok: true }))
        } else {
          res.statusCode = 400
          res.end(JSON.stringify({ ok: false }))
        }
      } catch (e) {
        res.statusCode = 500
        res.end(JSON.stringify({ ok: false, error: String(e) }))
      }
    })
    return
  }
  res.statusCode = 404
  res.end('Not found')
})

io.use((socket, next) => {
  // Auth handshake
  const token = socket.handshake.auth?.token || socket.handshake.query?.token
  if (!token) {
    return next(new Error('unauthorized'))
  }
  try {
    const payload = jwt.verify(token as string, JWT_SECRET) as AuthPayload
    ;(socket as any).userId = payload.sub
    next()
  } catch {
    next(new Error('unauthorized'))
  }
})

io.on('connection', (socket) => {
  const userId = (socket as any).userId as string
  if (!userId) {
    socket.disconnect(true)
    return
  }

  if (!socketsByUser.has(userId)) socketsByUser.set(userId, new Set())
  socketsByUser.get(userId)!.add(socket.id)
  userBySocket.set(socket.id, userId)

  // join personal room
  socket.join(`user:${userId}`)

  socket.emit('connected', { userId })

  // subscribe to ride room (live tracking)
  socket.on('ride:subscribe', ({ rideId }: { rideId: string }) => {
    if (rideId) socket.join(`ride:${rideId}`)
  })
  socket.on('ride:leave', ({ rideId }: { rideId: string }) => {
    if (rideId) socket.leave(`ride:${rideId}`)
  })
  socket.on('booking:subscribe', ({ bookingId }: { bookingId: string }) => {
    if (bookingId) socket.join(`booking:${bookingId}`)
  })

  // driver publishes location during active ride
  socket.on('ride:location', ({ rideId, lat, lng, heading, speed }: any) => {
    if (!rideId || typeof lat !== 'number') return
    io.to(`ride:${rideId}`).emit('ride:location', {
      rideId, lat, lng, heading, speed, userId, ts: Date.now(),
    })
  })

  // chat send (broadcasts to booking room)
  socket.on('chat:send', (msg: any) => {
    if (!msg?.bookingId || !msg?.content) return
    io.to(`booking:${msg.bookingId}`).emit('chat:message', {
      ...msg,
      senderId: userId,
      ts: Date.now(),
    })
  })
  socket.on('chat:read', ({ bookingId }: { bookingId: string }) => {
    if (!bookingId) return
    socket.to(`booking:${bookingId}`).emit('chat:read', {
      bookingId, readerId: userId, ts: Date.now(),
    })
  })

  socket.on('disconnect', () => {
    const u = userBySocket.get(socket.id)
    if (u) {
      const set = socketsByUser.get(u)
      if (set) {
        set.delete(socket.id)
        if (set.size === 0) socketsByUser.delete(u)
      }
      userBySocket.delete(socket.id)
    }
  })
})

httpServer.listen(PORT, () => {
  console.log(`ZOVO realtime server on port ${PORT}`)
})

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
