// POST /api/ask
// Body: { query: string }
// Uses OpenAI to translate a natural-language tennis-court request like
// "courts tomorrow evening in Santa Monica" into structured filters,
// then queries Supabase the same way /api/slots does and returns matching slots.

import { NextRequest, NextResponse } from 'next/server';
import { addDays, format } from 'date-fns';
import { getServiceClient } from '../../../lib/supabase';
import { getLLM } from '../../../lib/llm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface ParsedFilters {
  date?: string;       // YYYY-MM-DD
  minHour?: number;    // 0-23
  maxHour?: number;    // 0-24
  city?: string;
  source?: string;     // sources.id, e.g. 'la_rec'
}

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

async function parseQuery(query: string): Promise<ParsedFilters> {
  const { client, model } = getLLM();

  const today = todayStr();
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  const system = [
    'You translate a user request for tennis court availability into a JSON filter object.',
    'Output ONLY a JSON object with these optional fields:',
    '  date: string in YYYY-MM-DD format',
    '  minHour: integer 0-23 (inclusive lower bound for slot start hour, local LA time)',
    '  maxHour: integer 1-24 (exclusive upper bound for slot start hour)',
    '  city: string facility city if specified (e.g. "Los Angeles", "Santa Monica", "Beverly Hills", "Culver City", "Pasadena", "Burbank")',
    '  source: one of la_rec | santa_monica | beverly_hills | culver_city | pasadena | burbank | westside_tc when the user names a specific platform/agency',
    '',
    `Today is ${today}. Tomorrow is ${tomorrow}. All times are LA local.`,
    'Heuristics: "morning" = 6-12, "midday"/"lunch" = 11-14, "afternoon" = 12-17, "evening" = 17-22, "night" = 19-23.',
    'If the user does not specify a date, omit the date field.',
    'Return ONLY the JSON object, no prose, no markdown fences.',
  ].join('\n');

  const completion = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: query },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{}';
  let parsed: ParsedFilters = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  // Light validation — drop anything that doesn't fit our shape.
  const out: ParsedFilters = {};
  if (typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) out.date = parsed.date;
  if (typeof parsed.minHour === 'number' && parsed.minHour >= 0 && parsed.minHour <= 23) out.minHour = Math.floor(parsed.minHour);
  if (typeof parsed.maxHour === 'number' && parsed.maxHour >= 1 && parsed.maxHour <= 24) out.maxHour = Math.floor(parsed.maxHour);
  if (typeof parsed.city === 'string' && parsed.city.length < 64) out.city = parsed.city;
  if (typeof parsed.source === 'string' && parsed.source.length < 32) out.source = parsed.source;
  return out;
}

export async function POST(req: NextRequest) {
  let body: { query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const query = (body.query ?? '').trim();
  if (!query) {
    return NextResponse.json({ error: 'Missing "query"' }, { status: 400 });
  }

  let filters: ParsedFilters;
  try {
    filters = await parseQuery(query);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OpenAI request failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const minHour = filters.minHour ?? 6;
  const maxHour = filters.maxHour ?? 22;

  const supabase = getServiceClient();
  let q = supabase
    .from('slots')
    .select(`
      id, court_number, start_time, end_time, available, price_cents, booking_url,
      facility:facilities!inner ( id, name, address, city, source_id, num_courts, lights, surface, lat, lng )
    `)
    .eq('available', true)
    .order('start_time', { ascending: true })
    .limit(500);

  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00`);
    const end = new Date(`${filters.date}T23:59:59`);
    q = q.gte('start_time', start.toISOString()).lte('start_time', end.toISOString());
  } else {
    q = q.gte('start_time', new Date().toISOString());
  }

  if (filters.city) q = q.eq('facility.city', filters.city);
  if (filters.source) q = q.eq('facility.source_id', filters.source);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message, filters }, { status: 500 });

  const filtered = (data ?? []).filter((s) => {
    const h = new Date(s.start_time).getHours();
    return h >= minHour && h < maxHour;
  });

  return NextResponse.json({ query, filters, slots: filtered });
}
