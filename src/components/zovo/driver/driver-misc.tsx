'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, type Ride } from '@/lib/api-client'
import { useUIStore } from '@/lib/stores/ui-store'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Calendar, Loader2, MapPin, Clock, Users, IndianRupee, PlusCircle, ArrowRight, Car } from 'lucide-react'
import { PassengerProfile as SharedProfile } from '../passenger/passenger-profile'

export function DriverUpcoming() {
  const { navigate } = useUIStore()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.rides.list(new URLSearchParams({ role: 'DRIVER', type: 'upcoming' }))
      .then((r) => setRides(r.items))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Upcoming Rides</h2>
        <Button size="sm" onClick={() => navigate('driver.offer')}>
          <PlusCircle className="h-4 w-4 mr-1.5" /> Offer new
        </Button>
      </div>

      {rides.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">No upcoming rides</h3>
            <p className="text-muted-foreground mt-1">Offer a ride to fill empty seats.</p>
            <Button className="mt-4" onClick={() => navigate('driver.offer')}>Offer a ride</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rides.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-[1fr,auto] gap-3">
                  <div className="space-y-1 min-w-0">
                    <Badge variant="secondary">{r.status}</Badge>
                    <div className="text-sm">
                      <div className="font-medium truncate flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{r.pickupAddress.split(',')[0]}</div>
                      <div className="font-medium truncate flex items-center gap-1"><MapPin className="h-3 w-3 text-accent-foreground" />{r.destAddress.split(',')[0]}</div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(r.departureTime), 'EEE, dd MMM HH:mm')}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.availableSeats}/{r.totalSeats} seats</span>
                      <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" />{r.pricePerSeat}/seat</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate('driver.active', { rideId: r.id })}>
                    Manage <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function DriverHistory() {
  const { navigate } = useUIStore()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.rides.list(new URLSearchParams({ role: 'DRIVER', type: 'history' }))
      .then((r) => setRides(r.items))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Ride History</h2>

      {rides.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">No completed rides yet</h3>
            <p className="text-muted-foreground mt-1">Your past rides will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rides.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-[1fr,auto] gap-3">
                  <div className="space-y-1 min-w-0">
                    <Badge variant={r.status === 'COMPLETED' ? 'default' : 'destructive'}>{r.status}</Badge>
                    <div className="text-sm">
                      <div className="font-medium truncate">{r.pickupAddress.split(',')[0]} → {r.destAddress.split(',')[0]}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(r.departureTime), 'dd MMM yyyy, HH:mm')}</div>
                    </div>
                    {r.bookings && r.bookings.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {r.bookings.filter((b: any) => b.status === 'COMPLETED').length} passenger(s) • ₹{r.bookings.filter((b: any) => b.status === 'COMPLETED').reduce((s: number, b: any) => s + b.totalPrice, 0)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function DriverEarnings() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({ total: 0, today: 0, week: 0, platformFee: 0 })

  useEffect(() => {
    api.bookings.list(new URLSearchParams({ role: 'DRIVER' }))
      .then((r) => {
        const completed = r.items.filter((b) => b.status === 'COMPLETED')
        setPayments(completed)
        const now = new Date()
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        const total = completed.reduce((s, b) => s + b.totalPrice, 0)
        const today = completed.filter((b) => b.completedAt && new Date(b.completedAt) >= todayStart).reduce((s, b) => s + b.totalPrice, 0)
        const week = completed.filter((b) => b.completedAt && new Date(b.completedAt).getTime() >= weekAgo).reduce((s, b) => s + b.totalPrice, 0)
        setSummary({ total, today, week, platformFee: total * 0.1 })
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Earnings</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Today</div><div className="text-xl font-bold">₹{summary.today}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">This week</div><div className="text-xl font-bold">₹{summary.week}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total earnings</div><div className="text-xl font-bold">₹{summary.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Platform fees</div><div className="text-xl font-bold">₹{summary.platformFee.toFixed(0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Recent transactions</h3>
          </div>
          {payments.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No earnings yet</div>
          ) : (
            <div className="divide-y">
              {payments.map((b) => (
                <div key={b.id} className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">
                      {b.ride?.pickupAddress.split(',')[0]} → {b.ride?.destAddress.split(',')[0]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.completedAt ? format(new Date(b.completedAt), 'dd MMM yyyy, HH:mm') : ''} • {b.passenger?.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">₹{b.totalPrice}</div>
                    <div className="text-xs text-muted-foreground">{b.paymentMethod}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function DriverProfile() {
  // Reuse the same profile component (it adapts to active role)
  return <SharedProfile />
}
