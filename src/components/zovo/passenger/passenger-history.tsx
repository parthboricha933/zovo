'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, type Booking } from '@/lib/api-client'
import { useUIStore } from '@/lib/stores/ui-store'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { History, Loader2, MapPin, Star, Car, ArrowRight } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  STARTED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-red-100 text-red-800',
  REJECTED: 'bg-red-100 text-red-800',
  REQUESTED: 'bg-amber-100 text-amber-800',
}

export function PassengerHistory() {
  const { navigate } = useUIStore()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all')

  useEffect(() => {
    api.bookings.list(new URLSearchParams({ role: 'PASSENGER' }))
      .then((r) => setBookings(r.items))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = bookings.filter((b) => {
    if (filter === 'completed') return b.status === 'COMPLETED'
    if (filter === 'cancelled') return ['CANCELLED', 'REJECTED'].includes(b.status)
    return true
  })

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Booking History</h2>
        <div className="flex gap-1">
          {(['all', 'completed', 'cancelled'] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">No bookings yet</h3>
            <p className="text-muted-foreground mt-1">Your booking history will appear here.</p>
            <Button className="mt-4" onClick={() => navigate('passenger.search')}>Find a ride</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => (
            <Card key={b.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-[1fr,auto] gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLOR[b.status]}>{b.status}</Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(b.requestedAt), 'dd MMM yyyy, HH:mm')}</span>
                    </div>
                    {b.ride && (
                      <div className="text-sm">
                        <div className="font-medium truncate">{b.ride.pickupAddress.split(',')[0]}</div>
                        <div className="flex items-center gap-1 text-muted-foreground text-xs my-0.5">
                          <span className="border-l-2 border-muted h-3" />to
                        </div>
                        <div className="font-medium truncate">{b.ride.destAddress.split(',')[0]}</div>
                      </div>
                    )}
                  </div>
                  <div className="sm:text-right flex sm:flex-col justify-between sm:justify-start gap-2">
                    <div>
                      <div className="font-bold">₹{b.totalPrice}</div>
                      <div className="text-xs text-muted-foreground">{b.seatsBooked} seat{b.seatsBooked > 1 ? 's' : ''}</div>
                    </div>
                    {b.status === 'COMPLETED' && (
                      <Button size="sm" variant="outline" onClick={() => navigate('passenger.current', { bookingId: b.id })}>
                        View <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
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
