'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, type Ride, type Booking } from '@/lib/api-client'
import { useUIStore } from '@/lib/stores/ui-store'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useRealtimeStore } from '@/lib/stores/realtime-store'
import { ZovoMap } from '../shared/zovo-map-wrapper'
import { ChatDrawer } from '../passenger/passenger-current'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Car, Loader2, ShieldCheck, Play, CheckCircle2, X, MapPin,
  Users, IndianRupee, Star, Phone, MessageCircle, Navigation,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function DriverActive() {
  const { params, navigate } = useUIStore()
  const { user } = useAuthStore()
  const { subscribeRide, leaveRide, on, updateLocation } = useRealtimeStore()
  const [rides, setRides] = useState<Ride[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(params.rideId || null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [chatBookingId, setChatBookingId] = useState<string | null>(null)

  const load = async () => {
    try {
      const r = await api.rides.list(new URLSearchParams({ role: 'DRIVER' }))
      const relevant = r.items.filter((ride: any) => ['SCHEDULED', 'ACTIVE', 'ONGOING'].includes(ride.status))
      setRides(relevant)
      if (!selectedId && relevant.length > 0) setSelectedId(relevant[0].id)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  // Live updates
  useEffect(() => {
    const offs = [
      on('otp:verified', (d) => { toast.success('OTP verified — ride starting'); load() }),
      on('ride:started', () => load()),
      on('ride:completed', () => load()),
      on('ride:seats', () => load()),
      on('booking:cancelled', () => load()),
    ]
    return () => offs.forEach((o) => o())
  }, [])

  // Driver publishes location periodically while ride is active/ongoing
  useEffect(() => {
    const selected = rides.find((r) => r.id === selectedId)
    if (!selected || !['ACTIVE', 'ONGOING'].includes(selected.status)) return
    if (!('geolocation' in navigator)) return
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        updateLocation(selected.id, pos.coords.latitude, pos.coords.longitude, pos.coords.heading || undefined, pos.coords.speed || undefined)
        api.location.update({ rideId: selected.id, lat: pos.coords.latitude, lng: pos.coords.longitude, heading: pos.coords.heading, speed: pos.coords.speed }).catch(() => {})
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [selectedId, rides])

  if (loading) {
    return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (rides.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">No active rides</h3>
            <p className="text-muted-foreground mt-1">Offer a ride to get started.</p>
            <Button className="mt-4" onClick={() => navigate('driver.offer')}>Offer a ride</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const selected = rides.find((r) => r.id === selectedId) || rides[0]

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Active Ride</h2>
        {rides.length > 1 && (
          <select
            className="border rounded-md px-3 py-1.5 text-sm bg-background"
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {rides.map((r) => (
              <option key={r.id} value={r.id}>
                {r.pickupAddress.split(',')[0]} → {r.destAddress.split(',')[0]} ({r.status})
              </option>
            ))}
          </select>
        )}
      </div>

      <ActiveRideDetail
        ride={selected}
        verifying={verifying}
        onVerify={async (bookingId, otp) => {
          setVerifying(true)
          try {
            await api.bookings.verifyOtp(bookingId, otp)
            toast.success('OTP verified — ride started')
            load()
          } catch (e: any) { toast.error(e.message) }
          finally { setVerifying(false) }
        }}
        onActivate={async () => {
          try {
            await api.rides.start(selected.id)
            toast.success('Ride activated — passengers notified')
            load()
          } catch (e: any) { toast.error(e.message) }
        }}
        onComplete={async () => {
          if (!confirm('Mark this ride as completed?')) return
          try {
            await api.rides.complete(selected.id)
            toast.success('Ride completed')
            navigate('driver.history')
          } catch (e: any) { toast.error(e.message) }
        }}
        onCancel={async () => {
          if (!confirm('Cancel this ride? Passengers will be notified.')) return
          try {
            await api.rides.cancel(selected.id)
            toast.success('Ride cancelled')
            navigate('driver.upcoming')
          } catch (e: any) { toast.error(e.message) }
        }}
        onChat={(bookingId) => { setChatBookingId(bookingId); setShowChat(true) }}
      />

      {showChat && chatBookingId && (
        <ChatDrawer bookingId={chatBookingId} onClose={() => setShowChat(false)} />
      )}
    </div>
  )
}

function ActiveRideDetail({ ride, verifying, onVerify, onActivate, onComplete, onCancel, onChat }: any) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [liveLocs, setLiveLocs] = useState<Record<string, { lat: number; lng: number }>>({})
  const { subscribeRide, leaveRide, on, connected: socketConnected } = useRealtimeStore()

  const loadBookings = async () => {
    try {
      const r = await api.bookings.list(new URLSearchParams({ role: 'DRIVER' }))
      const mine = r.items.filter((b) => (b.rideId || b.ride?.id) === ride.id)
      setBookings(mine)
    } catch {}
  }

  useEffect(() => {
    let cancelled = false
    const doLoad = async () => {
      try {
        const r = await api.bookings.list(new URLSearchParams({ role: 'DRIVER' }))
        if (!cancelled) {
          const mine = r.items.filter((b) => (b.rideId || b.ride?.id) === ride.id)
          setBookings(mine)
        }
      } catch {}
    }
    doLoad()
    subscribeRide(ride.id)
    // Poll for booking updates when socket isn't connected (Vercel fallback)
    let i: any
    if (!socketConnected) {
      i = setInterval(doLoad, 5000)
    }
    return () => { cancelled = true; leaveRide(ride.id); if (i) clearInterval(i) }
  }, [ride.id, socketConnected])

  useEffect(() => {
    const off = on('ride:location', (d) => {
      if (d.rideId === ride.id && d.userId !== ride.driverId) {
        setLiveLocs((prev) => ({ ...prev, [d.userId]: { lat: d.lat, lng: d.lng } }))
      }
    })
    return off
  }, [ride.id])

  const confirmed = bookings.filter((b) => ['CONFIRMED', 'STARTED'].includes(b.status))
  const requested = bookings.filter((b) => b.status === 'REQUESTED')
  const started = bookings.filter((b) => b.status === 'STARTED')

  const markers = useMemo(() => {
    const arr: any[] = [
      { id: 'pickup', position: { lat: ride.pickupLat, lng: ride.pickupLng }, label: 'A', color: 'primary' },
      { id: 'dest', position: { lat: ride.destLat, lng: ride.destLng }, label: 'B', color: 'accent' },
    ]
    Object.entries(liveLocs).forEach(([uid, loc]) => {
      arr.push({ id: `p-${uid}`, position: loc, label: 'P', color: 'muted' })
    })
    return arr
  }, [ride, liveLocs])

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Ride</CardTitle>
              <Badge className={
                ride.status === 'ONGOING' ? 'bg-blue-100 text-blue-800' :
                ride.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                ride.status === 'COMPLETED' ? 'bg-zinc-100 text-zinc-800' :
                'bg-amber-100 text-amber-800'
              }>{ride.status}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Stage progression indicator */}
            <div className="flex items-center gap-1 text-[11px] font-medium">
              {[
                { key: 'SCHEDULED', label: 'Scheduled' },
                { key: 'ACTIVE', label: 'Pickup' },
                { key: 'ONGOING', label: 'In Transit' },
                { key: 'COMPLETED', label: 'Completed' },
              ].map((stage, i, arr) => {
                const order = ['SCHEDULED', 'ACTIVE', 'ONGOING', 'COMPLETED']
                const currentIdx = order.indexOf(ride.status)
                const stageIdx = order.indexOf(stage.key)
                const done = stageIdx < currentIdx
                const current = stageIdx === currentIdx
                return (
                  <div key={stage.key} className="flex items-center flex-1">
                    <div className={cn(
                      'flex-1 text-center py-1.5 px-1 rounded-md transition-colors',
                      done ? 'bg-primary/15 text-primary' :
                      current ? 'bg-primary text-primary-foreground' :
                      'bg-muted text-muted-foreground'
                    )}>
                      {stage.label}
                    </div>
                    {i < arr.length - 1 && <div className={cn('w-1 h-0.5', done ? 'bg-primary' : 'bg-border')} />}
                  </div>
                )
              })}
            </div>

            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <div className="flex-1 w-0.5 bg-border my-1 min-h-8" />
                <div className="h-3 w-3 rounded-full bg-accent-foreground" />
              </div>
              <div className="flex-1 space-y-2">
                <div><div className="text-xs text-muted-foreground">PICKUP</div><div className="font-medium">{ride.pickupAddress}</div></div>
                <div><div className="text-xs text-muted-foreground">DROP</div><div className="font-medium">{ride.destAddress}</div></div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
              <div>
                <div className="text-xs text-muted-foreground">Departure</div>
                <div className="text-sm font-medium">{format(new Date(ride.departureTime), 'dd MMM, HH:mm')}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Booked</div>
                <div className="text-sm font-medium">{ride.totalSeats - ride.availableSeats}/{ride.totalSeats} seats</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Per seat</div>
                <div className="text-sm font-medium">₹{ride.pricePerSeat}</div>
              </div>
            </div>

            {/* Action buttons — change based on ride status */}
            <div className="flex flex-wrap gap-2 pt-2">
              {ride.status === 'SCHEDULED' && (
                <>
                  <Button size="sm" className="flex-1" onClick={onActivate}>
                    <Play className="h-4 w-4 mr-1.5" /> Activate &amp; Go to Pickup
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={onCancel}>
                    <X className="h-4 w-4 mr-1.5" /> Cancel
                  </Button>
                </>
              )}
              {ride.status === 'ACTIVE' && (
                <>
                  <div className="flex-1 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                    At pickup — ask passenger for OTP, enter it below to start the ride.
                  </div>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={onCancel}>
                    <X className="h-4 w-4 mr-1.5" /> Cancel
                  </Button>
                </>
              )}
              {ride.status === 'ONGOING' && (
                <Button size="sm" className="flex-1" onClick={onComplete}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> Drop &amp; Complete Ride
                </Button>
              )}
              {ride.status === 'COMPLETED' && (
                <div className="flex-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Ride completed. Earnings recorded.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bookings list */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Passengers ({bookings.length})
              </CardTitle>
              {bookings.length > 0 && (
                <div className="flex gap-2 text-xs">
                  {requested.length > 0 && <Badge variant="secondary">{requested.length} pending</Badge>}
                  {confirmed.length > 0 && <Badge className="bg-emerald-100 text-emerald-800">{confirmed.length} confirmed</Badge>}
                  {started.length > 0 && <Badge className="bg-blue-100 text-blue-800">{started.length} in ride</Badge>}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No bookings yet. Share your ride link to get passengers.</p>
            ) : (
              bookings.map((b) => (
                <PassengerRow
                  key={b.id}
                  booking={b}
                  ride={ride}
                  verifying={verifying}
                  onVerify={(otp: string) => onVerify(b.id, otp)}
                  onChat={() => onChat(b.id)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden h-[400px] lg:h-auto lg:min-h-[600px]">
        <div className="h-full">
          <ZovoMap
            markers={markers}
            route={[{ lat: ride.pickupLat, lng: ride.pickupLng }, { lat: ride.destLat, lng: ride.destLng }]}
            fitToMarkers
          />
        </div>
      </Card>
    </div>
  )
}

function PassengerRow({ booking, ride, verifying, onVerify, onChat }: any) {
  const [localOtp, setLocalOtp] = useState('')
  const statusColor: Record<string, string> = {
    REQUESTED: 'bg-amber-100 text-amber-800',
    CONFIRMED: 'bg-emerald-100 text-emerald-800',
    STARTED: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-zinc-100 text-zinc-800',
    CANCELLED: 'bg-red-100 text-red-800',
  }
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">
          {booking.passenger?.name?.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{booking.passenger?.name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-amber-500 text-amber-500" />{booking.passenger?.passengerRating.toFixed(1)}</span>
            <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{booking.passenger?.phone || 'No phone'}</span>
          </div>
        </div>
        <div className="text-right">
          <Badge className={statusColor[booking.status]}>{booking.status}</Badge>
          <div className="text-xs text-muted-foreground mt-1">{booking.seatsBooked} seat{booking.seatsBooked > 1 ? 's' : ''} • ₹{booking.totalPrice}</div>
        </div>
      </div>

      {booking.status === 'CONFIRMED' && (
        <div className="mt-2 pt-2 border-t space-y-2">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Ask the passenger for their 6-digit OTP, then enter it below to start the ride.
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-xs flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Enter OTP from passenger</Label>
              <Input
                value={localOtp}
                onChange={(e) => setLocalOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6-digit OTP"
                className="font-mono tracking-widest text-lg"
                inputMode="numeric"
              />
            </div>
            <Button size="sm" onClick={() => onVerify(localOtp)} disabled={verifying || localOtp.length !== 6}>
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              <span className="ml-1">Verify &amp; Start</span>
            </Button>
          </div>
        </div>
      )}

      {booking.status === 'STARTED' && (
        <div className="mt-2 pt-2 border-t">
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ride in progress — passenger picked up.
          </div>
        </div>
      )}

      {['CONFIRMED', 'STARTED'].includes(booking.status) && (
        <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={onChat}>
          <MessageCircle className="h-4 w-4 mr-1.5" /> Chat with passenger
        </Button>
      )}
    </div>
  )
}
