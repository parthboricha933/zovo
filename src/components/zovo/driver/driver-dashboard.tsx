'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, type Booking } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { useRealtimeStore } from '@/lib/stores/realtime-store'
import { toast } from 'sonner'
import { format } from 'date-fns'
import {
  Wallet, Calendar, Car, Users, Star, PlusCircle, Inbox, ArrowRight,
  Loader2, MapPin, Clock, IndianRupee, TrendingUp,
} from 'lucide-react'

export function DriverDashboard() {
  const { user } = useAuthStore()
  const navigate = useUIStore((s) => s.navigate)
  const [stats, setStats] = useState({ today: 0, week: 0, upcoming: 0, total: 0 })
  const [requests, setRequests] = useState<Booking[]>([])
  const [activeRide, setActiveRide] = useState<any>(null)
  const [upcoming, setUpcoming] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const [ridesList, bookingsList] = await Promise.all([
        api.rides.list(new URLSearchParams({ role: 'DRIVER' })),
        api.bookings.list(new URLSearchParams({ role: 'DRIVER' })),
      ])
      const myRides = ridesList.items
      const myBookings = bookingsList.items

      // Active ride (status ACTIVE or ONGOING)
      const active = myRides.find((r: any) => ['ACTIVE', 'ONGOING'].includes(r.status))
      setActiveRide(active || null)

      // Upcoming (SCHEDULED + future)
      const now = new Date()
      const up = myRides
        .filter((r: any) => r.status === 'SCHEDULED' && new Date(r.departureTime) >= now)
        .sort((a: any, b: any) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime())
      setUpcoming(up.slice(0, 5))

      // Pending booking requests on my rides
      const req = myBookings.filter((b) => b.status === 'REQUESTED')
      setRequests(req)

      // Stats
      const completed = myBookings.filter((b) => b.status === 'COMPLETED')
      const now7 = Date.now() - 7 * 24 * 60 * 60 * 1000
      const now1 = new Date()
      now1.setHours(0, 0, 0, 0)
      setStats({
        total: completed.reduce((s, b) => s + b.totalPrice, 0),
        week: completed.filter((b) => b.completedAt && new Date(b.completedAt).getTime() >= now7).reduce((s, b) => s + b.totalPrice, 0),
        today: completed.filter((b) => b.completedAt && new Date(b.completedAt) >= now1).reduce((s, b) => s + b.totalPrice, 0),
        upcoming: up.length,
      })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const { on } = useRealtimeStore.getState()
    const offs = [
      on('booking:request', () => { toast.info('New booking request!'); load() }),
      on('ride:started', () => load()),
      on('ride:completed', () => load()),
      on('ride:seats', () => load()),
    ]
    return () => offs.forEach((o) => o())
  }, [])

  if (loading) {
    return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Welcome, {user?.name.split(' ')[0]}!</h2>
          <p className="text-muted-foreground mt-1">Here's what's happening today.</p>
        </div>
        <Button onClick={() => navigate('driver.offer')}>
          <PlusCircle className="h-4 w-4 mr-2" /> Offer a ride
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Today" value={`₹${stats.today}`} icon={IndianRupee} color="bg-emerald-100 text-emerald-800" />
        <StatCard label="This week" value={`₹${stats.week}`} icon={TrendingUp} color="bg-blue-100 text-blue-800" />
        <StatCard label="Upcoming" value={stats.upcoming} icon={Calendar} color="bg-amber-100 text-amber-800" />
        <StatCard label="Total earned" value={`₹${stats.total}`} icon={Wallet} color="bg-primary/10 text-primary" />
      </div>

      {/* Active ride */}
      {activeRide && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" /> Active Ride
              </CardTitle>
              <Badge className="bg-primary text-primary-foreground">{activeRide.status}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium truncate">{activeRide.pickupAddress.split(',')[0]} → {activeRide.destAddress.split(',')[0]}</div>
                <div className="text-xs text-muted-foreground">{format(new Date(activeRide.departureTime), 'EEE, dd MMM HH:mm')}</div>
              </div>
              <Button size="sm" onClick={() => navigate('driver.active')}>Manage <ArrowRight className="h-3 w-3 ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Booking requests */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Inbox className="h-4 w-4" /> Booking Requests
              </CardTitle>
              <Badge variant="secondary">{requests.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No pending requests.</p>
            ) : (
              requests.slice(0, 4).map((b) => (
                <div key={b.id} className="rounded-lg border p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{b.passenger?.name}</div>
                    <div className="text-xs text-muted-foreground">{b.seatsBooked} seat{b.seatsBooked > 1 ? 's' : ''} • ₹{b.totalPrice}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('driver.requests')}>Review</Button>
                </div>
              ))
            )}
            {requests.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('driver.requests')}>
                View all requests
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Upcoming rides */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Upcoming Rides
              </CardTitle>
              <Badge variant="secondary">{upcoming.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No upcoming rides.</p>
            ) : (
              upcoming.map((r) => (
                <div key={r.id} className="rounded-lg border p-3 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{r.pickupAddress.split(',')[0]} → {r.destAddress.split(',')[0]}</div>
                    <div className="text-xs text-muted-foreground">{format(new Date(r.departureTime), 'EEE, dd MMM HH:mm')} • {r.availableSeats} seats left</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('driver.active', { rideId: r.id })}>View</Button>
                </div>
              ))
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => navigate('driver.upcoming')}>All upcoming rides</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-xl font-bold mt-0.5">{value}</div>
          </div>
          <div className={`h-9 w-9 rounded-lg grid place-items-center ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
