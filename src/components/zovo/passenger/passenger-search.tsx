'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { LocationAutocomplete, type PlaceValue } from '../shared/location-autocomplete'
import { ZovoMap } from '../shared/zovo-map-wrapper'
import { api, type Ride } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { toast } from 'sonner'
import { Search, MapPin, Navigation, Calendar, Clock, Users, IndianRupee, Star, Filter, X, Loader2, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'

export function PassengerSearch() {
  const { user } = useAuthStore()
  const navigate = useUIStore((s) => s.navigate)
  const [pickup, setPickup] = useState<PlaceValue | null>(null)
  const [dest, setDest] = useState<PlaceValue | null>(null)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [seats, setSeats] = useState('1')
  const [maxPrice, setMaxPrice] = useState('')
  const [sortBy, setSortBy] = useState<'relevance' | 'price' | 'departure' | 'distance'>('relevance')
  const [results, setResults] = useState<Ride[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  const search = async () => {
    if (!pickup || !dest) {
      toast.error('Please select pickup and destination')
      return
    }
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams({
        pickupLat: String(pickup.lat),
        pickupLng: String(pickup.lng),
        destLat: String(dest.lat),
        destLng: String(dest.lng),
        seats,
        sortBy,
      })
      if (date) params.set('date', date)
      if (maxPrice) params.set('maxPrice', maxPrice)
      const r = await api.rides.search(params)
      setResults(r.items)
    } catch (e: any) {
      toast.error(e.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const requestBooking = async (ride: Ride) => {
    try {
      const seatsBooked = parseInt(seats)
      const { booking } = await api.bookings.request({ rideId: ride.id, seatsBooked })
      toast.success('Booking request sent!')
      navigate('passenger.current', { bookingId: booking.id })
    } catch (e: any) {
      toast.error(e.message || 'Booking failed')
    }
  }

  const routeCoords = useMemo(() => {
    if (pickup && dest) return [{ lat: pickup.lat, lng: pickup.lng }, { lat: dest.lat, lng: dest.lng }]
    return null
  }, [pickup, dest])

  const mapMarkers = useMemo(() => {
    const arr = []
    if (pickup) arr.push({ id: 'pickup', position: { lat: pickup.lat, lng: pickup.lng }, label: 'A', color: 'primary' as const })
    if (dest) arr.push({ id: 'dest', position: { lat: dest.lat, lng: dest.lng }, label: 'B', color: 'accent' as const })
    return arr
  }, [pickup, dest])

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold">Find a ride</h2>
        <p className="text-muted-foreground mt-1">Search drivers going your way.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Search</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Navigation className="h-3 w-3" /> Pickup</Label>
              <LocationAutocomplete value={pickup} onChange={setPickup} placeholder="Where from?" icon="pickup" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Destination</Label>
              <LocationAutocomplete value={dest} onChange={setDest} placeholder="Where to?" icon="destination" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Users className="h-3 w-3" /> Seats</Label>
                <Select value={seats} onValueChange={setSeats}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showFilters && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Max price per seat</Label>
                  <Input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="No limit" />
                </div>
                <div className="space-y-2">
                  <Label>Sort by</Label>
                  <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevance">Relevance</SelectItem>
                      <SelectItem value="price">Lowest price</SelectItem>
                      <SelectItem value="departure">Earliest departure</SelectItem>
                      <SelectItem value="distance">Closest pickup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowFilters((s) => !s)}>
              {showFilters ? <><X className="h-4 w-4 mr-1" /> Hide filters</> : <><Filter className="h-4 w-4 mr-1" /> Show filters</>}
            </Button>

            <Button onClick={search} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Search rides
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <div className="h-64 sm:h-80">
            <ZovoMap
              markers={mapMarkers}
              route={routeCoords || undefined}
              fitToMarkers={!!routeCoords}
              center={pickup ? { lat: pickup.lat, lng: pickup.lng } : undefined}
            />
          </div>
        </Card>
      </div>

      {/* Results */}
      {searched && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {loading ? 'Searching…' : `${results.length} ride${results.length === 1 ? '' : 's'} found`}
            </h3>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : results.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <h4 className="font-semibold">No rides found</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different date, route, or expand your search radius.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {results.map((ride) => (
                <RideResultCard key={ride.id} ride={ride} seatsWanted={parseInt(seats)} onBook={() => requestBooking(ride)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RideResultCard({ ride, seatsWanted, onBook }: { ride: Ride; seatsWanted: number; onBook: () => void }) {
  const dep = new Date(ride.departureTime)
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="grid sm:grid-cols-[1fr,auto] gap-4">
          <div className="space-y-3 min-w-0">
            {/* Route */}
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className="h-3 w-3 rounded-full bg-primary" />
                <div className="flex-1 w-0.5 bg-border my-1 min-h-8" />
                <div className="h-3 w-3 rounded-full bg-accent-foreground" />
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">PICKUP</div>
                  <div className="font-medium truncate">{ride.pickupAddress.split(',')[0]}</div>
                  {ride.pickupDistKm != null && (
                    <div className="text-xs text-muted-foreground">{ride.pickupDistKm.toFixed(1)} km away</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">DROP</div>
                  <div className="font-medium truncate">{ride.destAddress.split(',')[0]}</div>
                  {ride.destDistKm != null && (
                    <div className="text-xs text-muted-foreground">{ride.destDistKm.toFixed(1)} km from your destination</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(dep, 'EEE, dd MMM')}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(dep, 'HH:mm')}</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {ride.availableSeats} seats left</span>
              {ride.routeDuration && (
                <span className="flex items-center gap-1"><Navigation className="h-3 w-3" /> ~{Math.round(ride.routeDuration / 60)} min</span>
              )}
            </div>
          </div>

          <div className="flex sm:flex-col sm:items-end justify-between sm:justify-start gap-3 sm:gap-2 sm:border-l sm:pl-4">
            <div className="text-right">
              <div className="text-2xl font-bold flex items-center justify-end">
                <IndianRupee className="h-4 w-4" />{ride.pricePerSeat}
              </div>
              <div className="text-xs text-muted-foreground">per seat</div>
            </div>
            {ride.driver && (
              <div className="text-right text-xs">
                <div className="font-medium">{ride.driver.name}</div>
                <div className="flex items-center justify-end gap-0.5 text-muted-foreground">
                  <Star className="h-3 w-3 fill-current text-amber-500" />
                  {ride.driver.driverRating.toFixed(1)}
                </div>
                {ride.vehicle && (
                  <div className="text-muted-foreground">{ride.vehicle.color} {ride.vehicle.make} {ride.vehicle.model}</div>
                )}
              </div>
            )}
            <Button size="sm" onClick={onBook} disabled={ride.availableSeats < seatsWanted}>
              Book {seatsWanted > 1 ? `${seatsWanted} seats` : 'seat'}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
