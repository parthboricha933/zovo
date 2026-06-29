import { NextRequest, NextResponse } from 'next/server'

/**
 * Reverse geocode: lat/lng -> address.
 *
 * Strategy:
 *  1. Try Google Geocoding API
 *  2. Fall back to OpenStreetMap Nominatim
 *
 * Usage: GET /api/location/geocode?lat=21.0&lng=72.0
 */

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  // 1. Try Google Geocoding
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`
    const r = await fetch(url, { next: { revalidate: 60 } })
    if (r.ok) {
      const data = await r.json()
      const result = data.results?.[0]
      if (result) {
        return NextResponse.json({
          label: result.formatted_address,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          address: result.address_components,
        })
      }
    }
  } catch (e) {
    console.warn('[geocode] Google failed', e)
  }

  // 2. Fall back to OSM Nominatim
  try {
    const url = `http://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'ZOVO/1.0 (zovo.app)' },
      next: { revalidate: 300 },
    })
    if (r.ok) {
      const data = await r.json()
      return NextResponse.json({
        label: data.display_name,
        lat: parseFloat(data.lat),
        lng: parseFloat(data.lon),
        address: data.address,
      })
    }
  } catch (e) {
    console.warn('[geocode] OSM failed', e)
  }

  return NextResponse.json({ error: 'no_result' }, { status: 404 })
}
