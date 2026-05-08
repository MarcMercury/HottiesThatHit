// Apply the regenerated tennismaps seed (supabase/seed_la_courts_full.sql) via
// supabase-js with service role — used when SUPABASE_ACCESS_TOKEN (Management
// API) is unavailable, so scripts/push-sql.sh can't run.
//
// What it does
//   1. Parses the multi-row facility INSERT block from the SQL file.
//   2. Upserts those rows into hotties.facilities on (source_id, external_id),
//      letting Postgres keep existing columns we don't manage (e.g. address).
//
// Usage:  pnpm tsx scripts/push_la_seed.ts
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: process.env.SUPABASE_DB_SCHEMA ?? 'hotties' },
});

const SQL_PATH = path.resolve(__dirname, '../supabase/seed_la_courts_full.sql');

type Facility = {
  source_id: string;
  external_id: string;
  name: string;
  lat: number;
  lng: number;
  num_courts: number | null;
  category: string;
  region: string;
  phone: string | null;
  online_booking: boolean;
  facility_booking_url: string | null;
  tm_id: number | null;
  surface: string;
  lights: boolean;
  active: boolean;
};

// Parse one VALUES tuple. Order matches the seed-generator emit order:
//   (source_id, external_id, name, lat, lng, num_courts, category, region,
//    phone, online_booking, facility_booking_url, tm_id, surface, lights, active)
function parseTuple(line: string): Facility | null {
  const inner = line.trim().replace(/^\(/, '').replace(/\),?$/, '');
  // Tokenise: SQL strings 'foo''bar', numbers, booleans, null. Commas at depth 0 separate.
  const tokens: string[] = [];
  let buf = '';
  let inStr = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (inStr) {
      buf += c;
      if (c === "'") {
        if (inner[i + 1] === "'") { buf += "'"; i++; }
        else { inStr = false; }
      }
    } else {
      if (c === "'") { inStr = true; buf += c; }
      else if (c === ',') { tokens.push(buf.trim()); buf = ''; }
      else { buf += c; }
    }
  }
  if (buf.trim()) tokens.push(buf.trim());
  if (tokens.length !== 15) {
    console.warn('skip (unexpected token count', tokens.length, '):', line.slice(0, 80));
    return null;
  }
  const s = (t: string) => t === 'null' ? null : t.replace(/^'/, '').replace(/'$/, '').replace(/''/g, "'");
  const n = (t: string) => t === 'null' ? null : Number(t);
  const b = (t: string) => t === 'true';
  return {
    source_id:            s(tokens[0]) as string,
    external_id:          s(tokens[1]) as string,
    name:                 s(tokens[2]) as string,
    lat:                  n(tokens[3]) as number,
    lng:                  n(tokens[4]) as number,
    num_courts:           n(tokens[5]),
    category:             s(tokens[6]) as string,
    region:               s(tokens[7]) as string,
    phone:                s(tokens[8]),
    online_booking:       b(tokens[9]),
    facility_booking_url: s(tokens[10]),
    tm_id:                n(tokens[11]),
    surface:              s(tokens[12]) as string,
    lights:               b(tokens[13]),
    active:               b(tokens[14]),
  };
}

function parseFacilities(sql: string): Facility[] {
  // Find the facilities INSERT block: from 'values' to 'on conflict'.
  const start = sql.indexOf('insert into hotties.facilities');
  if (start < 0) throw new Error('facilities INSERT not found');
  const valuesIdx = sql.indexOf('\nvalues\n', start);
  const conflictIdx = sql.indexOf('on conflict', valuesIdx);
  if (valuesIdx < 0 || conflictIdx < 0) throw new Error('VALUES/on conflict markers not found');
  const block = sql.slice(valuesIdx + '\nvalues\n'.length, conflictIdx);
  const rows: Facility[] = [];
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith('(')) continue;
    const f = parseTuple(line);
    if (f) rows.push(f);
  }
  return rows;
}

async function chunkUpsert(rows: Facility[], chunkSize = 100) {
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const slice = rows.slice(i, i + chunkSize);
    const { error, count } = await sb
      .from('facilities')
      .upsert(slice, { onConflict: 'source_id,external_id', count: 'exact', ignoreDuplicates: false });
    if (error) throw new Error(`upsert chunk @${i}: ${error.message}`);
    total += count ?? slice.length;
    console.log(`  upserted ${slice.length} (running total ${total})`);
  }
  return total;
}

async function main() {
  const sql = fs.readFileSync(SQL_PATH, 'utf8');
  const rows = parseFacilities(sql);
  console.log(`parsed ${rows.length} facility rows from ${path.basename(SQL_PATH)}`);

  const { data: before, error: beforeErr } = await sb.from('facilities').select('source_id,external_id', { count: 'exact', head: true });
  if (beforeErr) throw beforeErr;
  console.log(`facilities table before: ${(before as unknown as { length?: number })?.length ?? 'n/a'} rows queried (head=true)`);

  const total = await chunkUpsert(rows);
  console.log(`upserted ${total} rows`);

  const { count: afterCount, error: afterErr } = await sb
    .from('facilities')
    .select('*', { count: 'exact', head: true });
  if (afterErr) throw afterErr;
  console.log(`facilities table after: ${afterCount} rows`);
}

main().catch((e) => { console.error(e); process.exit(1); });
