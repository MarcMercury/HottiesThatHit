// Google Maps helpers — server-safe URL builders + a thin geocoding client.
//
// Required env (server, secret):
//   GOOGLE_MAPS_API_KEY   — used for Geocoding + Static Maps
// Optional env (browser-safe, restrict by HTTP referrer in GCP console):
//   NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY — used by Maps JS / Embed if we ever
//                                         render an interactive map client-side.
//
// Enable in GCP: Geocoding API, Maps Static API, Maps JavaScript API,
// Directions API, Places API (New).

const GEOCODE = 'https://maps.googleapis.com/maps/api/geocode/json';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
  placeId: string;
}

export async function geocode(address: string): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const url = new URL(GEOCODE);
  url.searchParams.set('address', address);
  url.searchParams.set('key', key);
  const res = await fetch(url, { next: { revalidate: 86_400 } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    status: string;
    results: Array<{
      geometry: { location: { lat: number; lng: number } };
      formatted_address: string;
      place_id: string;
    }>;
  };
  if (json.status !== 'OK' || !json.results?.length) return null;
  const r = json.results[0];
  return {
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
    formatted: r.formatted_address,
    placeId: r.place_id,
  };
}

// Universal "Open in Maps" link — works on iOS, Android, desktop, and is keyless.
export function directionsUrl(opts: {
  destLat?: number;
  destLng?: number;
  destAddress?: string;
  destPlaceId?: string;
}): string {
  const u = new URL('https://www.google.com/maps/dir/');
  u.searchParams.set('api', '1');
  if (opts.destPlaceId) u.searchParams.set('destination_place_id', opts.destPlaceId);
  if (opts.destLat != null && opts.destLng != null) {
    u.searchParams.set('destination', `${opts.destLat},${opts.destLng}`);
  } else if (opts.destAddress) {
    u.searchParams.set('destination', opts.destAddress);
  }
  u.searchParams.set('travelmode', 'driving');
  return u.toString();
}

// Static map image URL — server-rendered, no JS bundle cost.
// Keep usage low; the Static Maps API has a per-load price after the free tier.
export function staticMapUrl(opts: {
  lat: number;
  lng: number;
  zoom?: number;
  width?: number;
  height?: number;
  scale?: 1 | 2;
}): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const u = new URL('https://maps.googleapis.com/maps/api/staticmap');
  u.searchParams.set('center', `${opts.lat},${opts.lng}`);
  u.searchParams.set('zoom', String(opts.zoom ?? 15));
  u.searchParams.set('size', `${opts.width ?? 400}x${opts.height ?? 200}`);
  u.searchParams.set('scale', String(opts.scale ?? 2));
  u.searchParams.set('markers', `color:green|${opts.lat},${opts.lng}`);
  u.searchParams.set('key', key);
  return u.toString();
}
