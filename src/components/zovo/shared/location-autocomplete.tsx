'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { MapPin, Navigation, X, Loader2 } from 'lucide-react'
import { api, type PlaceResult } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export interface PlaceValue {
  label: string
  lat: number
  lng: number
}

interface Props {
  value: PlaceValue | null
  onChange: (v: PlaceValue | null) => void
  placeholder?: string
  icon?: 'pickup' | 'destination' | 'pin'
  className?: string
}

/**
 * Location autocomplete input.
 *
 * Calls /api/location/autocomplete which tries Google Places (New), then Google
 * Places (legacy), then OpenStreetMap Nominatim as a free fallback.
 *
 * For Google places that return lat/lng=0 (predictions only), we resolve via
 * the client-side Google Maps Geocoder (if loaded) or via the server geocode
 * endpoint as a fallback.
 */
export function LocationAutocomplete({ value, onChange, placeholder = 'Search location', icon = 'pin', className }: Props) {
  const [query, setQuery] = useState(value?.label || '')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PlaceResult[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setQuery(value?.label || '')
  }, [value])

  // Debounced search via server proxy
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    if (value && query === value.label) return

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.location.autocomplete(query.trim())
        setResults(r.items)
        setOpen(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, value])

  // When user selects a Google Places prediction (lat/lng=0), resolve via Geocoder
  const selectPlace = async (p: PlaceResult) => {
    if (p.lat === 0 && p.lng === 0) {
      // Try client-side Google Geocoder first
      if (typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
        try {
          const geocoder = new (window as any).google.maps.Geocoder()
          await new Promise<void>((resolve, reject) => {
            geocoder.geocode({ placeId: p.id }, (results: any[], status: any) => {
              if (status === 'OK' && results?.[0]) {
                const loc = results[0].geometry.location
                onChange({ label: p.label, lat: loc.lat(), lng: loc.lng() })
                setQuery(p.label)
                setOpen(false)
                resolve()
              } else {
                reject(new Error('geocode failed'))
              }
            })
          })
          return
        } catch (e) {
          console.warn('[autocomplete] client geocoder failed', e)
        }
      }
      // Fallback: keep label with 0,0 — user can search again
      onChange({ label: p.label, lat: 0, lng: 0 })
      setQuery(p.label)
      setOpen(false)
    } else {
      onChange({ label: p.label, lat: p.lat, lng: p.lng })
      setQuery(p.label)
      setOpen(false)
    }
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await api.location.geocode(pos.coords.latitude, pos.coords.longitude)
          onChange({ label: r.label, lat: r.lat, lng: r.lng })
          setQuery(r.label)
        } catch {
          onChange({ label: 'Current location', lat: pos.coords.latitude, lng: pos.coords.longitude })
          setQuery('Current location')
        } finally {
          setLoading(false)
        }
      },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  const IconCmp = icon === 'pickup' ? Navigation : MapPin

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <IconCmp className={cn('absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground', icon === 'pickup' && 'text-primary')} />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!e.target.value) onChange(null)
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="pl-9 pr-20"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {query && !loading && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                onChange(null)
                setResults([])
              }}
              className="text-muted-foreground hover:text-foreground p-1 rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={useCurrentLocation}
            title="Use current location"
            className="text-muted-foreground hover:text-primary p-1 rounded"
          >
            <MapPin className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (results.length > 0 || loading || query.length >= 2) && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-72 overflow-y-auto zovo-scroll"
          onMouseDown={(e) => e.preventDefault()}
        >
          {results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {loading ? 'Searching…' : query.length < 2 ? 'Type at least 2 characters' : 'No results found'}
            </div>
          ) : (
            <div className="py-1">
              {results.map((r) => (
                <button
                  key={r.id || r.label}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectPlace(r)
                  }}
                  onClick={(e) => {
                    e.preventDefault()
                    selectPlace(r)
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-start gap-2 cursor-pointer"
                >
                  <MapPin className="h-4 w-4 mr-1 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.label.split(',')[0]}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.label.split(',').slice(1).join(',').trim()}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
