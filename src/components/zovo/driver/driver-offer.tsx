'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LocationAutocomplete, type PlaceValue } from '../shared/location-autocomplete'
import { ZovoMap } from '../shared/zovo-map-wrapper'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useUIStore } from '@/lib/stores/ui-store'
import { toast } from 'sonner'
import { Navigation, MapPin, Calendar, Clock, Users, IndianRupee, PlusCircle, Loader2, Car, FileText } from 'lucide-react'

export function DriverOffer() {
  const { user } = useAuthStore()
  const navigate = useUIStore((s) => s.navigate)
  const [pickup, setPickup] = useState<PlaceValue | null>(null)
  const [dest, setDest] = useState<PlaceValue | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [seats, setSeats] = useState('2')
  const [price, setPrice] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [routeInfo, setRouteInfo] = useState<{ distance: number; duration: number; etaMinutes: number } | null>(null)

  const approvedVehicles = user?.vehicles?.filter((v) => v.status === 'APPROVED') || []

  useEffect(() => {
    if (approvedVehicles.length > 0 && !vehicleId) setVehicleId(approvedVehicles[0].id)
  }, [user])

  // Calculate route when both locations are set (client-side via Google Maps DirectionsService)
  useEffect(() => {
    if (!pickup || !dest) {
      setRouteInfo(null)
      return
    }
    let cancelled = false

    const calculateRoute = async () => {
      // Try client-side Google Maps DirectionsService first
      if (typeof window !== 'undefined' && (window as any).google?.maps?.DirectionsService) {
        try {
          const service = new (window as any).google.maps.DirectionsService()
          const result = await service.route({
            origin: { lat: pickup.lat, lng: pickup.lng },
            destination: { lat: dest.lat, lng: dest.lng },
            travelMode: 'DRIVING',
          })
          if (cancelled) return
          const leg = result.routes?.[0]?.legs?.[0]
          if (leg) {
            setRouteInfo({
              distance: leg.distance?.value || 0,
              duration: leg.duration?.value || 0,
              etaMinutes: Math.round((leg.duration?.value || 0) / 60),
            })
            return
          }
        } catch (e) {
          console.warn('[route] client-side failed, falling back to server', e)
        }
      }
      // Fallback: server-side REST API
      try {
        const r = await api.location.route({ fromLat: pickup.lat, fromLng: pickup.lng, toLat: dest.lat, toLng: dest.lng })
        if (!cancelled) setRouteInfo(r)
      } catch {}
    }
    calculateRoute()
    return () => { cancelled = true }
  }, [pickup, dest])

  const submit = async () => {
    if (!pickup || !dest) { toast.error('Select pickup and destination'); return }
    if (!date || !time) { toast.error('Select departure date and time'); return }
    if (!price) { toast.error('Set a price per seat'); return }
    if (!vehicleId) { toast.error('Select a vehicle'); return }
    if (approvedVehicles.length === 0) {
      toast.error('Add an approved vehicle first')
      navigate('verification')
      return
    }

    const departureTime = new Date(`${date}T${time}`)
    if (departureTime.getTime() < Date.now()) {
      toast.error('Departure time must be in the future')
      return
    }

    setSubmitting(true)
    try {
      const vehicle = approvedVehicles.find((v) => v.id === vehicleId)
      const body = {
        vehicleId,
        pickupAddress: pickup.label,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        destAddress: dest.label,
        destLat: dest.lat,
        destLng: dest.lng,
        departureTime: departureTime.toISOString(),
        totalSeats: parseInt(seats),
        pricePerSeat: parseFloat(price),
        routeDistance: routeInfo?.distance,
        routeDuration: routeInfo?.duration,
        notes: notes || undefined,
      }
      const { ride } = await api.rides.create(body)
      toast.success('Ride published!')
      navigate('driver.upcoming')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const mapMarkers = useMemo(() => {
    const arr = []
    if (pickup) arr.push({ id: 'pickup', position: { lat: pickup.lat, lng: pickup.lng }, label: 'A', color: 'primary' as const })
    if (dest) arr.push({ id: 'dest', position: { lat: dest.lat, lng: dest.lng }, label: 'B', color: 'accent' as const })
    return arr
  }, [pickup, dest])

  if (approvedVehicles.length === 0) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold text-lg">No approved vehicle</h3>
            <p className="text-muted-foreground mt-1">Add a vehicle and complete verification before offering rides.</p>
            <Button className="mt-4" onClick={() => navigate('verification')}>Add vehicle</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Offer a ride</h2>
        <p className="text-muted-foreground mt-1">Publish your trip and let passengers find you.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Trip details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Navigation className="h-3 w-3" /> Pickup location</Label>
              <LocationAutocomplete value={pickup} onChange={setPickup} placeholder="Where are you starting from?" icon="pickup" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Destination</Label>
              <LocationAutocomplete value={dest} onChange={setDest} placeholder="Where are you going?" icon="destination" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Clock className="h-3 w-3" /> Time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Users className="h-3 w-3" /> Seats available</Label>
                <Select value={seats} onValueChange={setSeats}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: Math.max(1, (approvedVehicles.find((v) => v.id === vehicleId)?.totalSeats || 4)) }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} seat{n > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><IndianRupee className="h-3 w-3" /> Price per seat</Label>
                <Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="250" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vehicle</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {approvedVehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.make} {v.model} • {v.plateNumber} ({v.totalSeats} seats)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><FileText className="h-3 w-3" /> Notes (optional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. luggage size, music preference, no smoking" rows={2} />
            </div>

            {routeInfo && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Distance</span>
                  <span className="font-medium">{(routeInfo.distance / 1000).toFixed(1)} km</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Estimated duration</span>
                  <span className="font-medium">~{routeInfo.etaMinutes} min</span>
                </div>
                {price && (
                  <div className="flex items-center justify-between border-t mt-2 pt-2">
                    <span className="text-muted-foreground">Potential earnings (full)</span>
                    <span className="font-bold text-primary">₹{parseFloat(price) * parseInt(seats)}</span>
                  </div>
                )}
              </div>
            )}

            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlusCircle className="h-4 w-4 mr-2" />}
              Publish ride
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden h-[400px] lg:h-auto lg:min-h-[500px]">
          <div className="h-full">
            <ZovoMap
              markers={mapMarkers}
              route={pickup && dest ? [{ lat: pickup.lat, lng: pickup.lng }, { lat: dest.lat, lng: dest.lng }] : undefined}
              fitToMarkers={!!pickup && !!dest}
              center={pickup ? { lat: pickup.lat, lng: pickup.lng } : { lat: 21.0, lng: 72.0 }}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
