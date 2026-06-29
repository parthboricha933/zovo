'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api, type Booking } from '@/lib/api-client'
import { useUIStore } from '@/lib/stores/ui-store'
import { useRealtimeStore } from '@/lib/stores/realtime-store'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Check, X, Loader2, Inbox, Star, Phone, Users, IndianRupee, MapPin, Clock } from 'lucide-react'

export function DriverRequests() {
  const { navigate } = useUIStore()
  const [requests, setRequests] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = async () => {
    try {
      const r = await api.bookings.list(new URLSearchParams({ role: 'DRIVER', status: 'REQUESTED' }))
      setRequests(r.items)
    } catch (e: any) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const { on } = useRealtimeStore.getState()
    const off = on('booking:request', () => load())
    return off
  }, [])

  const accept = async (id: string) => {
    setActing(id)
    try {
      await api.bookings.accept(id)
      toast.success('Booking accepted — OTP sent to passenger')
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setActing(null) }
  }

  const reject = async (id: string) => {
    setActing(id)
    try {
      await api.bookings.reject(id, 'Driver declined')
      toast.success('Booking declined')
      load()
    } catch (e: any) { toast.error(e.message) }
    finally { setActing(null) }
  }

  if (loading) {
    return <div className="p-6"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <h2 className="text-2xl font-bold">Ride Requests</h2>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold">No pending requests</h3>
            <p className="text-muted-foreground mt-1">New booking requests will appear here in real time.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((b) => (
            <Card key={b.id}>
              <CardContent className="p-4">
                <div className="grid sm:grid-cols-[auto,1fr,auto] gap-4 items-start">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center font-bold">
                    {b.passenger?.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{b.passenger?.name}</span>
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {b.passenger?.passengerRating.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Phone className="h-3 w-3" /> {b.passenger?.phone || 'No phone'}
                      </span>
                    </div>
                    {b.ride && (
                      <div className="text-sm">
                        <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-primary" /> {b.ride.pickupAddress.split(',')[0]}</div>
                        <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-accent-foreground" /> {b.ride.destAddress.split(',')[0]}</div>
                        <div className="flex items-center gap-1.5 text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" /> {format(new Date(b.ride.departureTime), 'dd MMM, HH:mm')}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-xl font-bold flex items-center justify-end"><IndianRupee className="h-4 w-4" />{b.totalPrice}</div>
                    <Badge variant="secondary"><Users className="h-3 w-3 mr-1" />{b.seatsBooked} seat{b.seatsBooked > 1 ? 's' : ''}</Badge>
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <Button size="sm" className="flex-1" onClick={() => accept(b.id)} disabled={acting === b.id}>
                    {acting === b.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />} Accept
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-destructive" onClick={() => reject(b.id)} disabled={acting === b.id}>
                    <X className="h-4 w-4 mr-1" /> Decline
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
