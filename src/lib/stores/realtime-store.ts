'use client'

import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'

interface RealtimeState {
  socket: Socket | null
  connected: boolean
  driverLocation: { lat: number; lng: number; heading?: number; speed?: number; ts: number } | null
  init: (token: string) => void
  disconnect: () => void
  subscribeRide: (rideId: string) => void
  leaveRide: (rideId: string) => void
  subscribeBooking: (bookingId: string) => void
  updateLocation: (rideId: string, lat: number, lng: number, heading?: number, speed?: number) => void
  sendChat: (bookingId: string, content: string) => void
  markChatRead: (bookingId: string) => void

  // Event handlers (registered by components via setOnEvent)
  handlers: Record<string, ((data: any) => void)[]>
  on: (event: string, fn: (data: any) => void) => () => void
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  socket: null,
  connected: false,
  driverLocation: null,
  handlers: {},

  init: (token: string) => {
    if (get().socket) return
    // In dev (sandbox): connect via the gateway using XTransformPort=3003
    // In production: connect directly to REALTIME_BASE_URL (e.g. wss://realtime.yourapp.com)
    const remoteUrl = process.env.NEXT_PUBLIC_REALTIME_BASE_URL
    const socket = remoteUrl
      ? io(remoteUrl, {
          transports: ['websocket', 'polling'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1500,
          timeout: 10000,
        })
      : io('/?XTransformPort=3003', {
          transports: ['websocket', 'polling'],
          auth: { token },
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1500,
          timeout: 10000,
        })

    socket.on('connect', () => set({ connected: true }))
    socket.on('disconnect', () => set({ connected: false }))

    const dispatch = (event: string, data: any) => {
      const fns = get().handlers[event] || []
      fns.forEach((f) => f(data))
    }

    socket.on('notification', (n) => {
      dispatch('notification', n)
      toast(n.title, { description: n.body })
    })
    socket.on('booking:request', (d) => dispatch('booking:request', d))
    socket.on('booking:accepted', (d) => dispatch('booking:accepted', d))
    socket.on('booking:rejected', (d) => dispatch('booking:rejected', d))
    socket.on('booking:cancelled', (d) => dispatch('booking:cancelled', d))
    socket.on('otp:generated', (d) => dispatch('otp:generated', d))
    socket.on('otp:verified', (d) => dispatch('otp:verified', d))
    socket.on('ride:started', (d) => dispatch('ride:started', d))
    socket.on('ride:completed', (d) => dispatch('ride:completed', d))
    socket.on('ride:location', (d) => {
      set({ driverLocation: { lat: d.lat, lng: d.lng, heading: d.heading, speed: d.speed, ts: d.ts } })
      dispatch('ride:location', d)
    })
    socket.on('ride:seats', (d) => dispatch('ride:seats', d))
    socket.on('ride:created', (d) => dispatch('ride:created', d))
    socket.on('chat:message', (d) => dispatch('chat:message', d))
    socket.on('chat:read', (d) => dispatch('chat:read', d))

    set({ socket })
  },

  disconnect: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, connected: false })
    }
  },

  subscribeRide: (rideId) => {
    get().socket?.emit('ride:subscribe', { rideId })
  },
  leaveRide: (rideId) => {
    get().socket?.emit('ride:leave', { rideId })
  },
  subscribeBooking: (bookingId) => {
    get().socket?.emit('booking:subscribe', { bookingId })
  },
  updateLocation: (rideId, lat, lng, heading, speed) => {
    get().socket?.emit('ride:location', { rideId, lat, lng, heading, speed })
  },
  sendChat: (bookingId, content) => {
    get().socket?.emit('chat:send', { bookingId, content })
  },
  markChatRead: (bookingId) => {
    get().socket?.emit('chat:read', { bookingId })
  },

  on: (event, fn) => {
    const cur = get().handlers[event] || []
    set({ handlers: { ...get().handlers, [event]: [...cur, fn] } })
    return () => {
      const cur2 = get().handlers[event] || []
      set({ handlers: { ...get().handlers, [event]: cur2.filter((f) => f !== fn) } })
    }
  },
}))
