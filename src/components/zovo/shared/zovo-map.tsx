'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
  InfoWindow,
} from '@react-google-maps/api'
import { cn } from '@/lib/utils'

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export interface LatLng {
  lat: number
  lng: number
}

export interface MapMarker {
  id: string
  position: LatLng
  label?: string
  color?: 'primary' | 'accent' | 'muted'
  isVehicle?: boolean
}

export interface MapProps {
  center?: LatLng
  zoom?: number
  markers?: MapMarker[]
  route?: LatLng[] // polyline coordinates
  className?: string
  onMapClick?: (lat: number, lng: number) => void
  fitToMarkers?: boolean
  liveMarkerId?: string
  scrollWheelZoom?: boolean
}

const containerStyle = {
  width: '100%',
  height: '100%',
}

const COLORS: Record<string, string> = {
  primary: '#0f766e', // teal-700 (matches our brand)
  accent: '#ca8a04', // warm sand
  muted: '#64748b',
}

const labelColors: Record<string, string> = {
  primary: '#ffffff',
  accent: '#ffffff',
  muted: '#ffffff',
}

export function ZovoMap({
  center,
  zoom = 13,
  markers = [],
  route,
  className,
  onMapClick,
  fitToMarkers = false,
  scrollWheelZoom = true,
}: MapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: API_KEY,
    libraries: ['places', 'geometry'],
  })

  const mapRef = useRef<google.maps.Map | null>(null)
  const [ready, setReady] = useState(false)

  const onLoad = (map: google.maps.Map) => {
    mapRef.current = map
    setReady(true)
  }

  const onUnmount = () => {
    mapRef.current = null
    setReady(false)
  }

  // Fit bounds when markers change
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !ready) return
    const map = mapRef.current

    if (fitToMarkers && markers.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      markers.forEach((m) => bounds.extend({ lat: m.position.lat, lng: m.position.lng }))
      if (route && route.length > 0) {
        route.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
      }
      if (markers.length === 1 && !route) {
        map.setCenter({ lat: markers[0].position.lat, lng: markers[0].position.lng })
        map.setZoom(Math.max(zoom, 13))
      } else {
        map.fitBounds(bounds, 60)
      }
    } else if (center) {
      map.setCenter({ lat: center.lat, lng: center.lng })
      map.setZoom(zoom)
    }
  }, [markers, route, fitToMarkers, center, zoom, isLoaded, ready])

  // Click handler
  const handleClick = (e: google.maps.MapMouseEvent) => {
    if (!onMapClick) return
    if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng())
  }

  if (loadError) {
    return (
      <div className="h-full w-full grid place-items-center bg-muted/30 text-sm text-muted-foreground">
        Failed to load Google Maps. Check API key.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="h-full w-full grid place-items-center bg-muted/30">
        <div className="text-sm text-muted-foreground">Loading map…</div>
      </div>
    )
  }

  const centerPos = center || (markers[0]?.position) || { lat: 21.0, lng: 72.0 }

  return (
    <div className={cn('h-full w-full', className)}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={{ lat: centerPos.lat, lng: centerPos.lng }}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleClick}
        options={{
          scrollwheel: scrollWheelZoom,
          fullscreenControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
            { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
          ],
        }}
      >
        {markers.map((m) => (
          <Marker
            key={m.id}
            position={{ lat: m.position.lat, lng: m.position.lng }}
            label={
              m.label
                ? {
                    text: m.label,
                    color: labelColors[m.color || 'primary'],
                    fontWeight: 'bold',
                    fontSize: '11px',
                  }
                : undefined
            }
            icon={
              m.isVehicle
                ? {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 12,
                    fillColor: COLORS[m.color || 'primary'],
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 3,
                  }
                : undefined
            }
          />
        ))}
        {route && route.length > 1 && (
          <Polyline
            path={route.map((p) => ({ lat: p.lat, lng: p.lng }))}
            options={{
              strokeColor: COLORS.primary,
              strokeWeight: 5,
              strokeOpacity: 0.85,
              geodesic: true,
            }}
          />
        )}
      </GoogleMap>
    </div>
  )
}
