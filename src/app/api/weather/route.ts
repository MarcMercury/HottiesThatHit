// GET /api/weather?lat=34.05&lng=-118.24&date=2026-05-07
// Returns Open-Meteo daily + hourly forecast for a facility.
// Public, no auth — Open-Meteo is free & keyless.

import { NextRequest, NextResponse } from 'next/server';
import { getDailyForecast, getHourlyForecast, describeWeather } from '../../../lib/weather';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lat = Number(sp.get('lat'));
  const lng = Number(sp.get('lng'));
  const date = sp.get('date');
  const hour = sp.get('hour'); // optional, "15" or "15:00"

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });
  }

  const daily = date ? await getDailyForecast(lat, lng, date) : null;

  let hourly = null;
  if (date && hour !== null) {
    const hh = String(hour).padStart(2, '0').slice(0, 2);
    hourly = await getHourlyForecast(lat, lng, `${date}T${hh}:00`);
  }

  return NextResponse.json({
    daily: daily ? { ...daily, ...describeWeather(daily.weatherCode) } : null,
    hourly: hourly ? { ...hourly, ...describeWeather(hourly.weatherCode) } : null,
  });
}
