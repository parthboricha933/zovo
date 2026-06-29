import { NextRequest, NextResponse } from 'next/server'

/**
 * Location autocomplete proxy.
 *
 * Strategy:
 *  1. Try Google Places API (New) — POST https://places.googleapis.com/v1/places:autocomplete
 *  2. Fall back to Google Places Autocomplete (legacy REST)
 *  3. Fall back to OpenStreetMap Nominatim (free, no key required)
 *
 * The first one that returns results wins. This makes the endpoint robust to
 * different Google Cloud project configurations.
 */

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  if (q.trim().length < 2) {
    return NextResponse.json({ items: [] })
  }

  // 1. Try Google Places API (New)
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        input: q.trim(),
        includedRegionCodes: ['in'],
      }),
      next: { revalidate: 60 },
    })
    if (r.ok) {
      const data = await r.json()
      if (data.suggestions?.length > 0) {
        const items = data.suggestions
          .filter((s: any) => s.placePrediction)
          .map((s: any) => ({
            id: s.placePrediction.placeId,
            label: s.placePrediction.text?.text || s.placePrediction.structuredFormat?.mainText?.text,
            lat: 0,
            lng: 0,
            type: '',
            category: '',
            placePrediction: s.placePrediction,
          }))
        if (items.length > 0) return NextResponse.json({ items, provider: 'google-places-new' })
      }
    }
  } catch (e) {
    console.warn('[autocomplete] Google Places (New) failed', e)
  }

  // 2. Try Google Places Autocomplete (legacy)
  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&components=country:in&key=${GOOGLE_API_KEY}`
    const r = await fetch(url, { next: { revalidate: 60 } })
    if (r.ok) {
      const data = await r.json()
      if (data.predictions?.length > 0) {
        const items = data.predictions.map((p: any) => ({
          id: p.place_id,
          label: p.description,
          lat: 0,
          lng: 0,
          type: p.types?.[0],
          category: '',
        }))
        return NextResponse.json({ items, provider: 'google-places-legacy' })
      }
    }
  } catch (e) {
    console.warn('[autocomplete] Google Places (legacy) failed', e)
  }

  // 3. Fall back to OpenStreetMap Nominatim (free, no key)
  try {
    const url = `http://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&q=${encodeURIComponent(q)}`
    const r = await fetch(url, {
      headers: { 'User-Agent': 'ZOVO/1.0 (zovo.app)', 'Accept-Language': 'en' },
      next: { revalidate: 3600 },
    })
    if (r.ok) {
      const data = await r.json()
      const items = (data || []).map((d: any) => ({
        id: d.place_id,
        label: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        type: d.type,
        category: d.category,
      }))
      return NextResponse.json({ items, provider: 'osm' })
    }
  } catch (e) {
    console.warn('[autocomplete] OSM Nominatim failed', e)
  }

  return NextResponse.json({ items: [], error: 'all_providers_failed' }, { status: 502 })
}
