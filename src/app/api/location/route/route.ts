import { NextRequest, NextResponse } from 'next/server'

/**
 * Route calculation.
 *
 * Strategy:
 *  1. Try Google Directions API (legacy REST)
 *  2. Try Google Routes API (New)
 *  3. Fall back to OSRM public demo server (free, no key)
 *
 * Returns distance (m), duration (s), and decoded polyline as LatLng[].
 *
 * Usage: GET /api/location/route?fromLat=..&fromLng=..&toLat=..&toLng=..
 */

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

// Decode Google's polyline encoding
function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += dlat
    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1)
    lng += dlng
    points.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }
  return points
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fromLat = searchParams.get('fromLat')
  const fromLng = searchParams.get('fromLng')
  const toLat = searchParams.get('toLat')
  const toLng = searchParams.get('toLng')
  if (!fromLat || !fromLng || !toLat || !toLng) {
    return NextResponse.json({ error: 'missing coordinates' }, { status: 400 })
  }

  // 1. Try Google Directions (legacy)
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&key=${GOOGLE_API_KEY}`
    const r = await fetch(url, { next: { revalidate: 60 } })
    if (r.ok) {
      const data = await r.json()
      const leg = data.routes?.[0]?.legs?.[0]
      if (leg) {
        const polyline = data.routes?.[0]?.overview_polyline?.points || ''
        const decoded = decodePolyline(polyline)
        return NextResponse.json({
          distance: leg.distance.value,
          duration: leg.duration.value,
          etaMinutes: Math.round(leg.duration.value / 60),
          geometry: { type: 'LineString', coordinates: decoded.map((p) => [p.lng, p.lat]) },
          polyline: decoded,
          provider: 'google-directions',
        })
      }
    }
  } catch (e) {
    console.warn('[route] Google Directions failed', e)
  }

  // 2. Try Google Routes API (New)
  try {
    const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: parseFloat(fromLat), longitude: parseFloat(fromLng) } } },
        destination: { location: { latLng: { latitude: parseFloat(toLat), longitude: parseFloat(toLng) } } },
        travelMode: 'DRIVE',
      }),
      next: { revalidate: 60 },
    })
    if (r.ok) {
      const data = await r.json()
      const route = data.routes?.[0]
      if (route) {
        const distance = parseFloat(route.distanceMeters)
        const duration = parseFloat(route.duration?.seconds || route.duration || '0')
        const decoded = route.polyline?.encodedPolyline ? decodePolyline(route.polyline.encodedPolyline) : []
        return NextResponse.json({
          distance,
          duration,
          etaMinutes: Math.round(duration / 60),
          geometry: { type: 'LineString', coordinates: decoded.map((p) => [p.lng, p.lat]) },
          polyline: decoded,
          provider: 'google-routes-v2',
        })
      }
    }
  } catch (e) {
    console.warn('[route] Google Routes v2 failed', e)
  }

  // 3. Fall back to OSRM (free, no key) — use HTTP to avoid IPv6/HTTPS issues in some envs
  try {
    const url = `http://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'ZOVO/1.0' },
      next: { revalidate: 60 },
    })
    if (r.ok) {
      const data = await r.json()
      const route = data.routes?.[0]
      if (route) {
        // GeoJSON coordinates are [lng, lat]
        const polyline = (route.geometry?.coordinates || []).map((c: [number, number]) => ({ lat: c[1], lng: c[0] }))
        return NextResponse.json({
          distance: route.distance,
          duration: route.duration,
          etaMinutes: Math.round(route.duration / 60),
          geometry: route.geometry,
          polyline,
          provider: 'osrm',
        })
      }
    }
  } catch (e) {
    console.warn('[route] OSRM failed', e)
  }

  return NextResponse.json({ error: 'no_route' }, { status: 404 })
}
