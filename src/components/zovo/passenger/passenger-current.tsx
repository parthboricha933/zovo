'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { api, type Booking, type Message } from '@/lib/api-client'
import { useUIStore } from '@/lib/stores/ui-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useRealtimeStore } from '@/lib/stores/realtime-store'
import { ZovoMap } from '../shared/zovo-map-wrapper'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  MapPin, Navigation, Clock, Users, Star, Phone, MessageCircle, Send,
  Loader2, ShieldCheck, X, ArrowLeft, CheckCircle2, Car,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function PassengerCurrent() {
  const { params, navigate } = useUIStore()
  const { user } = useAuthStore()
  const { subscribeRide, leaveRide, subscribeBooking, on, connected: socketConnected } = useRealtimeStore()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(params.bookingId || null)
  const [loading, setLoading] = useState(true)
  const [showChat, setShowChat] = useState(false)

  const load = async () => {
    try {
      // Get all active bookings for this passenger
      const r = await api.bookings.list(new URLSearchParams({ role: 'PASSENGER' }))
      const active = r.items.filter((b) =>
        ['REQUESTED', 'CONFIRMED', 'STARTED'].includes(b.status)
      )
      setBookings(active)
      if (!selectedId && active.length > 0) setSelectedId(active[0].id)
    } catch (e: any) {
      toast.error(e.message || 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  // Poll for booking status updates when socket isn't connected (Vercel fallback)
  useEffect(() => {
    load()
    if (socketConnected) return // socket will push updates
    const i = setInterval(load, 5000) // poll every 5s
    return () => clearInterval(i)
  }, [socketConnected])

  // Live updates
  useEffect(() => {
    const offs = [
      on('booking:accepted', (d) => { toast.success('Booking accepted!'); load() }),
      on('booking:rejected', (d) => { toast.error('Booking rejected'); load() }),
      on('booking:cancelled', (d) => { toast.info('Booking cancelled'); load() }),
      on('otp:generated', (d) => { toast.success('OTP generated'); load() }),
      on('ride:started', () => { toast.success('Ride started!'); load() }),
      on('ride:completed', () => { toast.success('Ride completed!'); load() }),
      on('ride:seats', () => load()),
    ]
    return () => offs.forEach((o) => o())
  }, [])

  if (loading) {
    return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (bookings.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">No active bookings</h3>
            <p className="text-muted-foreground mt-1">Search for a ride to get started.</p>
            <Button className="mt-4" onClick={() => navigate('passenger.search')}>Find a ride</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selected = bookings.find((b) => b.id === selectedId) || bookings[0]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Current Booking</h2>
        {bookings.length > 1 && (
          <BookingSelect
            bookings={bookings}
            selectedId={selected.id}
            onSelect={setSelectedId}
          />
        )}
      </div>

      <BookingDetail booking={selected} onChatOpen={() => setShowChat(true)} onUpdate={load} />

      {showChat && selected.status === 'CONFIRMED' && (
        <ChatDrawer bookingId={selected.id} onClose={() => setShowChat(false)} />
      )}
    </div>
  )
}

function BookingSelect({ bookings, selectedId, onSelect }: { bookings: Booking[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <select
      className="border rounded-md px-3 py-1.5 text-sm bg-background"
      value={selectedId}
      onChange={(e) => onSelect(e.target.value)}
    >
      {bookings.map((b) => (
        <option key={b.id} value={b.id}>
          {b.ride?.pickupAddress.split(',')[0]} → {b.ride?.destAddress.split(',')[0]} ({b.status})
        </option>
      ))}
    </select>
  )
}

function BookingDetail({ booking, onChatOpen, onUpdate }: { booking: Booking; onChatOpen: () => void; onUpdate: () => void }) {
  const { navigate } = useUIStore()
  const { user } = useAuthStore()
  const { subscribeRide, leaveRide, subscribeBooking, on } = useRealtimeStore()
  const [liveLoc, setLiveLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [showRate, setShowRate] = useState(false)

  useEffect(() => {
    if (!booking.ride) return
    if (booking.status === 'CONFIRMED' || booking.status === 'STARTED') {
      subscribeRide(booking.rideId)
      subscribeBooking(booking.id)
    }
    return () => {
      if (booking.ride) leaveRide(booking.rideId)
    }
  }, [booking.id, booking.status, booking.rideId])

  useEffect(() => {
    const off = on('ride:location', (d) => {
      if (d.rideId === booking.rideId) setLiveLoc({ lat: d.lat, lng: d.lng })
    })
    return off
  }, [booking.rideId])

  const dep = booking.ride ? new Date(booking.ride.departureTime) : null

  const statusColor: Record<string, any> = {
    REQUESTED: 'bg-amber-100 text-amber-800',
    CONFIRMED: 'bg-emerald-100 text-emerald-800',
    STARTED: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-zinc-100 text-zinc-800',
    CANCELLED: 'bg-red-100 text-red-800',
    REJECTED: 'bg-red-100 text-red-800',
  }

  const markers = []
  if (booking.ride) {
    markers.push({ id: 'pickup', position: { lat: booking.ride.pickupLat, lng: booking.ride.pickupLng }, label: 'A', color: 'primary' as const })
    markers.push({ id: 'dest', position: { lat: booking.ride.destLat, lng: booking.ride.destLng }, label: 'B', color: 'accent' as const })
  }
  if (liveLoc) {
    markers.push({ id: 'driver', position: liveLoc, color: 'primary' as const, isVehicle: true })
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Booking Status</CardTitle>
              <Badge className={statusColor[booking.status]}>{booking.status}</Badge>
            </div>
            <CardDescription>Booked {format(new Date(booking.requestedAt), 'dd MMM, HH:mm')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {booking.ride && (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-1">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <div className="flex-1 w-0.5 bg-border my-1 min-h-8" />
                    <div className="h-3 w-3 rounded-full bg-accent-foreground" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <div className="text-xs text-muted-foreground">PICKUP</div>
                      <div className="font-medium">{booking.ride.pickupAddress}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">DROP</div>
                      <div className="font-medium">{booking.ride.destAddress}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                  <div>
                    <div className="text-xs text-muted-foreground">Departure</div>
                    <div className="text-sm font-medium">{dep && format(dep, 'dd MMM, HH:mm')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Seats</div>
                    <div className="text-sm font-medium">{booking.seatsBooked}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="text-sm font-medium">₹{booking.totalPrice}</div>
                  </div>
                </div>
              </>
            )}

            {/* OTP display for confirmed bookings */}
            {booking.status === 'CONFIRMED' && booking.otpCode && (
              <div className="rounded-lg border-2 border-dashed border-primary bg-primary/5 p-4 text-center">
                <div className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Share this OTP with your driver at pickup
                </div>
                <div className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">{booking.otpCode}</div>
              </div>
            )}

            {booking.status === 'STARTED' && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800 flex items-center gap-2">
                <Car className="h-4 w-4" /> Ride in progress — enjoy your trip!
              </div>
            )}

            {booking.status === 'REQUESTED' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                Waiting for driver to accept your request…
              </div>
            )}

            <div className="flex gap-2">
              {booking.status === 'CONFIRMED' && (
                <Button variant="outline" size="sm" onClick={onChatOpen} className="flex-1">
                  <MessageCircle className="h-4 w-4 mr-1.5" /> Chat with driver
                </Button>
              )}
              {['REQUESTED', 'CONFIRMED'].includes(booking.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={async () => {
                    if (!confirm('Cancel this booking?')) return
                    try {
                      await api.bookings.cancel(booking.id, 'Cancelled by passenger')
                      toast.success('Booking cancelled')
                      onUpdate()
                    } catch (e: any) { toast.error(e.message) }
                  }}
                >
                  Cancel
                </Button>
              )}
              {booking.status === 'COMPLETED' && !showRate && (
                <Button size="sm" onClick={() => setShowRate(true)}>
                  <Star className="h-4 w-4 mr-1.5" /> Rate ride
                </Button>
              )}
            </div>

            {showRate && (
              <RateForm bookingId={booking.id} onDone={() => { setShowRate(false); onUpdate() }} />
            )}
          </CardContent>
        </Card>

        {/* Driver info */}
        {booking.ride?.driver && (
          <Card>
            <CardHeader><CardTitle className="text-base">Driver</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center font-bold">
                  {booking.ride.driver.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{booking.ride.driver.name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Star className="h-3 w-3 fill-current text-amber-500" />
                    {booking.ride.driver.driverRating.toFixed(1)} • {booking.ride.driver.phone}
                  </div>
                </div>
                {booking.ride.vehicle && (
                  <div className="text-right text-xs">
                    <div className="font-medium">{booking.ride.vehicle.make} {booking.ride.vehicle.model}</div>
                    <div className="text-muted-foreground">{booking.ride.vehicle.color} • {booking.ride.vehicle.plateNumber}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Live map */}
      <Card className="overflow-hidden h-[400px] lg:h-auto lg:min-h-[500px]">
        <div className="h-full">
          <ZovoMap
            markers={markers}
            route={booking.ride ? [{ lat: booking.ride.pickupLat, lng: booking.ride.pickupLng }, { lat: booking.ride.destLat, lng: booking.ride.destLng }] : undefined}
            fitToMarkers
          />
        </div>
      </Card>
    </div>
  )
}

function RateForm({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      await api.bookings.rate(bookingId, rating, comment)
      toast.success('Thanks for your feedback!')
      onDone()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="text-sm font-medium">Rate your ride</div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} className="p-1">
            <Star className={cn('h-6 w-6', n <= rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground')} />
          </button>
        ))}
      </div>
      <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Leave a comment (optional)" />
      <Button size="sm" onClick={submit} disabled={submitting}>
        {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Submit
      </Button>
    </div>
  )
}

export function ChatDrawer({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { user } = useAuthStore()
  const { subscribeBooking, on, sendChat, markChatRead } = useRealtimeStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const r = await api.chat.messages(bookingId)
      setMessages(r.items)
      await markChatRead(bookingId)
      await api.chat.markRead(bookingId)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    subscribeBooking(bookingId)
    const off = on('chat:message', (m) => {
      if (m.bookingId === bookingId) {
        setMessages((prev) => {
          if (prev.some((p) => p.id === m.id)) return prev
          return [...prev, m]
        })
        if (m.senderId !== user?.id) {
          markChatRead(bookingId)
          api.chat.markRead(bookingId).catch(() => {})
        }
      }
    })
    return off
  }, [bookingId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const send = async () => {
    if (!input.trim()) return
    const content = input.trim()
    setInput('')
    // Optimistic
    const optimistic: Message = {
      id: 'tmp-' + Date.now(),
      bookingId,
      senderId: user!.id,
      content,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      const r = await api.chat.send(bookingId, content)
      setMessages((prev) => prev.map((m) => m.id === optimistic.id ? r.message : m))
    } catch (e: any) {
      toast.error(e.message)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
    }
  }

  return (
    <Card className="fixed inset-x-4 bottom-4 lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96 z-40 shadow-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> Chat
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div ref={scrollRef} className="h-72 overflow-y-auto zovo-scroll space-y-2 pr-1">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground py-8">Loading messages…</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">Say hello to start the conversation!</div>
          ) : (
            messages.map((m) => {
              const mine = m.senderId === user?.id
              return (
                <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  <div className={cn(
                    'rounded-2xl px-3 py-2 max-w-[80%] text-sm',
                    mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary rounded-bl-sm'
                  )}>
                    {m.content}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {format(new Date(m.createdAt), 'HH:mm')}
                    {mine && m.readAt && ' • Read'}
                  </div>
                </div>
              )
            })
          )}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Type a message…"
          />
          <Button size="icon" onClick={send} disabled={!input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
