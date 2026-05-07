// Open-Meteo client. No API key required.
// Docs: https://open-meteo.com/en/docs
//
// We use this to show per-slot weather (temp, precipitation chance, wind)
// because tennis is outdoor — "73° sunny, 5mph wind" is huge UX.

export interface HourlyForecast {
  time: string;          // ISO local time, e.g. "2026-05-07T15:00"
  tempF: number;
  precipPct: number;     // 0-100
  windMph: number;
  weatherCode: number;   // WMO code, see codeToEmoji below
}

export interface DailyForecast {
  date: string;          // YYYY-MM-DD
  highF: number;
  lowF: number;
  precipPct: number;
  weatherCode: number;
}

// WMO weather code → short label + emoji.
// https://open-meteo.com/en/docs#weathervariables
const WMO: Record<number, { label: string; emoji: string }> = {
  0: { label: 'clear', emoji: '☀️' },
  1: { label: 'mostly clear', emoji: '🌤️' },
  2: { label: 'partly cloudy', emoji: '⛅' },
  3: { label: 'overcast', emoji: '☁️' },
  45: { label: 'fog', emoji: '🌫️' },
  48: { label: 'fog', emoji: '🌫️' },
  51: { label: 'drizzle', emoji: '🌦️' },
  53: { label: 'drizzle', emoji: '🌦️' },
  55: { label: 'drizzle', emoji: '🌦️' },
  61: { label: 'rain', emoji: '🌧️' },
  63: { label: 'rain', emoji: '🌧️' },
  65: { label: 'heavy rain', emoji: '🌧️' },
  80: { label: 'showers', emoji: '🌦️' },
  81: { label: 'showers', emoji: '🌦️' },
  82: { label: 'heavy showers', emoji: '⛈️' },
  95: { label: 'thunderstorm', emoji: '⛈️' },
  96: { label: 'thunderstorm', emoji: '⛈️' },
  99: { label: 'thunderstorm', emoji: '⛈️' },
};

export function describeWeather(code: number): { label: string; emoji: string } {
  return WMO[code] ?? { label: 'unknown', emoji: '·' };
}

export function isPlayable(f: { precipPct: number; windMph: number; weatherCode: number }): boolean {
  // Heuristic: not playable if precip > 50%, wind > 25mph, or thunderstorm code.
  if (f.precipPct >= 50) return false;
  if (f.windMph >= 25) return false;
  if (f.weatherCode >= 95) return false;
  return true;
}

interface OpenMeteoResponse {
  hourly?: {
    time: string[];
    temperature_2m: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    weather_code: number[];
  };
  daily?: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    weather_code: number[];
  };
}

// Cache forecasts in-memory for the lifetime of a serverless invocation,
// keyed by lat/lng rounded to ~1km. Open-Meteo is generous but we don't
// want to hammer it from a hot page.
const cache = new Map<string, { at: number; data: OpenMeteoResponse }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

async function fetchOpenMeteo(lat: number, lng: number): Promise<OpenMeteoResponse> {
  const key = cacheKey(lat, lng);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('timezone', 'America/Los_Angeles');
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('precipitation_unit', 'inch');
  url.searchParams.set(
    'hourly',
    'temperature_2m,precipitation_probability,wind_speed_10m,weather_code'
  );
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code'
  );
  url.searchParams.set('forecast_days', '8');

  const res = await fetch(url, { next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = (await res.json()) as OpenMeteoResponse;
  cache.set(key, { at: Date.now(), data });
  return data;
}

export async function getHourlyForecast(
  lat: number,
  lng: number,
  isoLocalTime: string // "2026-05-07T15:00" (local LA hour)
): Promise<HourlyForecast | null> {
  try {
    const data = await fetchOpenMeteo(lat, lng);
    const h = data.hourly;
    if (!h) return null;
    // Open-Meteo returns hourly times as "YYYY-MM-DDTHH:00" in the requested tz.
    const target = isoLocalTime.slice(0, 13) + ':00';
    const i = h.time.indexOf(target);
    if (i < 0) return null;
    return {
      time: h.time[i],
      tempF: Math.round(h.temperature_2m[i]),
      precipPct: h.precipitation_probability[i] ?? 0,
      windMph: Math.round(h.wind_speed_10m[i] ?? 0),
      weatherCode: h.weather_code[i] ?? 0,
    };
  } catch {
    return null;
  }
}

export async function getDailyForecast(
  lat: number,
  lng: number,
  date: string // YYYY-MM-DD
): Promise<DailyForecast | null> {
  try {
    const data = await fetchOpenMeteo(lat, lng);
    const d = data.daily;
    if (!d) return null;
    const i = d.time.indexOf(date);
    if (i < 0) return null;
    return {
      date,
      highF: Math.round(d.temperature_2m_max[i]),
      lowF: Math.round(d.temperature_2m_min[i]),
      precipPct: d.precipitation_probability_max[i] ?? 0,
      weatherCode: d.weather_code[i] ?? 0,
    };
  } catch {
    return null;
  }
}
