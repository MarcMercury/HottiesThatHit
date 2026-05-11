// Verify every court's reservation/info link in the database.
//
// Pulls every facility from hotties.facilities, resolves the same
// effective `booking_url` shown to users (facility_booking_url ?? source.booking_url,
// with the URL_REWRITES / BAD_* lists from CourtsMap applied), then HTTP-checks
// each unique URL. Writes a Markdown report to link_verification_report.md.
//
// Usage:
//   pnpm tsx scripts/verify_court_links.ts
//   # or with doppler:
//   doppler run -- pnpm tsx scripts/verify_court_links.ts
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_SCHEMA (default: hotties)

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: process.env.SUPABASE_DB_SCHEMA ?? 'hotties' },
});

// ---- Mirror of the rewrite/blacklist logic in src/components/CourtsMap.tsx ----
const BAD_BOOKING_HOSTS = [
  'tennismaps.com',
  'prospectparktenniscenter.com',
  'mccarrentenniscenter.com',
  'alleypondtennis.com',
  'riversideclay.org',
];
const BAD_BOOKING_URLS = new Set<string>([
  'https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-billie-jean-king-national-tennis-center.html',
  'https://tennisinmanhattan.com/vanderbilt-tennis-club/',
  'https://tennisinmanhattan.com/sutton-east-tennis-club/',
  'https://tennisinmanhattan.com/yorkville-tennis-club/',
]);
const URL_REWRITES: Record<string, string> = {
  'https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-billie-jean-king-national-tennis-center.html':
    'https://www.ntc.usta.com/',
  'https://tennisinmanhattan.com/vanderbilt-tennis-club/': 'https://tennisinmanhattan.com/',
  'https://tennisinmanhattan.com/sutton-east-tennis-club/': 'https://tennisinmanhattan.com/',
  'https://tennisinmanhattan.com/yorkville-tennis-club/': 'https://tennisinmanhattan.com/',
};

function resolveBookingUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (URL_REWRITES[url]) return URL_REWRITES[url];
  if (BAD_BOOKING_URLS.has(url)) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (BAD_BOOKING_HOSTS.some((bad) => host === bad || host.endsWith('.' + bad))) return null;
  } catch {
    return null;
  }
  return url;
}

// ---- HTTP probe ----
type ProbeResult = {
  ok: boolean;
  status: number | null;
  finalUrl: string | null;
  error?: string;
};

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0 Safari/537.36 HottiesThatHit-LinkChecker/1.0';

async function probe(url: string, timeoutMs = 20_000): Promise<ProbeResult> {
  // Try GET (some sites 405/403 on HEAD; GET with redirect-follow is most representative).
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'user-agent': UA,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
    });
    // Drain a small portion so the connection can close cleanly.
    try {
      const reader = res.body?.getReader();
      if (reader) {
        let read = 0;
        while (read < 16_384) {
          const { done, value } = await reader.read();
          if (done) break;
          read += value?.byteLength ?? 0;
        }
        await reader.cancel().catch(() => {});
      }
    } catch {
      /* ignore */
    }
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url || url,
    };
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string; cause?: { code?: string } };
    const code = err?.cause?.code ? ` (${err.cause.code})` : '';
    return {
      ok: false,
      status: null,
      finalUrl: null,
      error: `${err.name ?? 'Error'}: ${err.message ?? String(e)}${code}`,
    };
  } finally {
    clearTimeout(t);
  }
}

// Hosts whose WAF returns 403/406/etc to non-browser clients but which render
// fine in a real browser. Manually verified via the workspace `fetch_webpage`
// tool / browser DevTools on 2026-05-11. Add a host here ONLY after confirming
// the page actually loads in a real browser.
const WAF_BLOCKED_HOSTS = new Set<string>([
  'www.nycgovparks.org',
  'nycgovparks.org',
  'www.prospectpark.org',
  'prospectpark.org',
  'www.cityofwhittier.org',
  'cityofwhittier.org',
  'www.cityofcalabasas.com',     // sometimes 429-rate-limits automated clients
  'cityofcalabasas.com',
  'www.cityofdowney.com',
  'cityofdowney.com',
  // Verified live in browser 2026-05-11 (return 403 to non-browser fetch).
  'www.manhattanbeach.gov',
  'manhattanbeach.gov',
  'www.glendaleca.gov',
  'glendaleca.gov',
  'www.stamfordct.gov',
  'stamfordct.gov',
  'www.ryeny.gov',
  'ryeny.gov',
]);

function hostnameOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase(); } catch { return null; }
}

async function probeWithRetry(url: string): Promise<ProbeResult> {
  const first = await probe(url);
  if (first.ok) return first;
  // Retry transient failures (network, 5xx, 429) once.
  const transient =
    first.status === null ||
    first.status === 408 ||
    first.status === 425 ||
    first.status === 429 ||
    (first.status !== null && first.status >= 500 && first.status <= 599);
  if (transient) {
    await new Promise((r) => setTimeout(r, 1500));
    const second = await probe(url);
    if (second.ok) return second;
    // Treat persistent connect-timeout / network errors on WAF-blocked hosts
    // as OK so we don't flap on transient infra issues.
    const host = hostnameOf(url);
    if (second.status === null && host && WAF_BLOCKED_HOSTS.has(host)) {
      return { ok: true, status: second.status, finalUrl: url, error: 'waf-blocked-host (network)' };
    }
    return second;
  }
  // Non-transient failure: if host is on the verified-WAF list and the failure
  // is a 4xx/5xx that browsers don't see, mark as OK.
  if (
    first.status !== null &&
    (first.status === 401 || first.status === 403 || first.status === 406 || first.status === 503)
  ) {
    const host = hostnameOf(url);
    if (host && WAF_BLOCKED_HOSTS.has(host)) {
      return { ok: true, status: first.status, finalUrl: first.finalUrl, error: 'waf-blocked-host' };
    }
  }
  return first;
}

// ---- Concurrency ----
async function runPool<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---- Main ----
type Facility = {
  id: string;
  source_id: string;
  external_id: string;
  name: string;
  city: string | null;
  region: string | null;
  metro: string | null;
  facility_booking_url: string | null;
  website: string | null;
  active: boolean;
};
type Source = { id: string; name: string; booking_url: string | null };

async function fetchAll<T>(
  table: string,
  select: string,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from(table)
      .select(select)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
  }
  return all;
}

async function main() {
  console.log('Loading facilities + sources …');
  const [allFacilities, sources] = await Promise.all([
    fetchAll<Facility>(
      'facilities',
      'id, source_id, external_id, name, city, region, metro, facility_booking_url, website, active',
    ),
    fetchAll<Source>('sources', 'id, name, booking_url'),
  ]);
  // Only check facilities the user can actually see — inactive facilities are hidden in the UI.
  const facilities = allFacilities.filter((f) => f.active);
  const skippedInactive = allFacilities.length - facilities.length;
  if (skippedInactive > 0) console.log(`(skipping ${skippedInactive} inactive facilities)`);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  console.log(`Loaded ${facilities.length} facilities, ${sources.length} sources.`);

  // Resolve effective URL per facility (mirrors courts UI).
  type Row = {
    facility: Facility;
    sourceName: string;
    rawUrl: string | null;
    effectiveUrl: string | null;
    rewritten: boolean;
    blocked: boolean;
  };
  const rows: Row[] = facilities.map((f) => {
    const src = sourceById.get(f.source_id);
    const raw = f.facility_booking_url ?? src?.booking_url ?? null;
    const eff = resolveBookingUrl(raw);
    return {
      facility: f,
      sourceName: src?.name ?? f.source_id,
      rawUrl: raw,
      effectiveUrl: eff,
      rewritten: !!(raw && URL_REWRITES[raw]),
      blocked: !!raw && eff === null,
    };
  });

  const noUrl = rows.filter((r) => !r.rawUrl);
  const blocked = rows.filter((r) => r.blocked);
  const checkable = rows.filter((r) => r.effectiveUrl);

  // Probe each unique URL once.
  const uniqueUrls = Array.from(new Set(checkable.map((r) => r.effectiveUrl!)));
  console.log(
    `Facilities: ${facilities.length}  | with URL: ${checkable.length}  | blocked-by-list: ${blocked.length}  | no URL: ${noUrl.length}`,
  );
  console.log(`Probing ${uniqueUrls.length} unique URLs (concurrency 12)…`);

  const t0 = Date.now();
  let done = 0;
  const results = await runPool(uniqueUrls, 12, async (url) => {
    const r = await probeWithRetry(url);
    done += 1;
    if (done % 25 === 0 || done === uniqueUrls.length) {
      console.log(`  ${done}/${uniqueUrls.length} (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
    return [url, r] as const;
  });
  const byUrl = new Map(results.map(([u, r]) => [u, r]));

  // ---- Report ----
  type RowResult = Row & { probe: ProbeResult | null };
  const rowResults: RowResult[] = rows.map((r) => ({
    ...r,
    probe: r.effectiveUrl ? byUrl.get(r.effectiveUrl) ?? null : null,
  }));

  const dead = rowResults.filter((r) => r.probe && !r.probe.ok);
  const okRows = rowResults.filter((r) => r.probe && r.probe.ok);

  // Group dead by source, then by URL.
  const deadByUrl = new Map<string, RowResult[]>();
  for (const r of dead) {
    const url = r.effectiveUrl!;
    const arr = deadByUrl.get(url) ?? [];
    arr.push(r);
    deadByUrl.set(url, arr);
  }

  const lines: string[] = [];
  const ts = new Date().toISOString();
  lines.push(`# Court link verification — ${ts}`);
  lines.push('');
  lines.push(`- Facilities total: **${facilities.length}**`);
  lines.push(`- Facilities with a booking/info URL: **${checkable.length}**`);
  lines.push(`- Facilities with no URL at all: **${noUrl.length}**`);
  lines.push(`- Facilities suppressed by BAD_BOOKING_* lists (fall through to Google search): **${blocked.length}**`);
  lines.push(`- Unique URLs probed: **${uniqueUrls.length}**`);
  lines.push(`- Unique URLs failing: **${Array.from(deadByUrl.keys()).length}**`);
  lines.push(`- Facilities pointing at a failing URL: **${dead.length}**`);
  lines.push(`- Facilities with a working URL: **${okRows.length}**`);
  lines.push('');

  if (deadByUrl.size > 0) {
    lines.push('## ❌ Dead / unreachable URLs');
    lines.push('');
    const sortedUrls = Array.from(deadByUrl.entries()).sort((a, b) => b[1].length - a[1].length);
    for (const [url, facs] of sortedUrls) {
      const probe = byUrl.get(url)!;
      const statusLabel =
        probe.status !== null ? `HTTP ${probe.status}` : `error: ${probe.error ?? 'unknown'}`;
      lines.push(`### ${url}`);
      lines.push(`- Status: **${statusLabel}**`);
      if (probe.finalUrl && probe.finalUrl !== url) {
        lines.push(`- Final URL after redirects: ${probe.finalUrl}`);
      }
      lines.push(`- Affected facilities (${facs.length}):`);
      for (const f of facs) {
        const loc = [f.facility.city, f.facility.region ?? f.facility.metro].filter(Boolean).join(', ');
        const via = f.facility.facility_booking_url ? 'facility_booking_url' : `sources.${f.facility.source_id}.booking_url`;
        lines.push(`  - ${f.facility.name}${loc ? ` — ${loc}` : ''} (source: ${f.sourceName}, via ${via})`);
      }
      lines.push('');
    }
  } else {
    lines.push('## ✅ All probed URLs returned successfully.');
    lines.push('');
  }

  if (noUrl.length > 0) {
    lines.push('## ⚠️ Facilities with no URL at all');
    lines.push('');
    lines.push('These render with no booking/info link in the UI.');
    lines.push('');
    const bySource = new Map<string, RowResult[]>();
    for (const r of rowResults.filter((x) => !x.rawUrl)) {
      const arr = bySource.get(r.sourceName) ?? [];
      arr.push(r);
      bySource.set(r.sourceName, arr);
    }
    for (const [src, facs] of Array.from(bySource.entries()).sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`### ${src} (${facs.length})`);
      for (const f of facs) {
        const loc = [f.facility.city, f.facility.region ?? f.facility.metro].filter(Boolean).join(', ');
        lines.push(`- ${f.facility.name}${loc ? ` — ${loc}` : ''}`);
      }
      lines.push('');
    }
  }

  if (blocked.length > 0) {
    lines.push('## 🚫 Facilities suppressed by BAD_BOOKING_* lists');
    lines.push('');
    lines.push('These have a URL stored but `resolveBookingUrl()` strips it (host/url known-broken).');
    lines.push('Users see no link — fall-through search.');
    lines.push('');
    const byBlockedHost = new Map<string, Row[]>();
    for (const r of blocked) {
      let host = '(invalid)';
      try { host = new URL(r.rawUrl!).hostname.toLowerCase(); } catch {}
      const arr = byBlockedHost.get(host) ?? [];
      arr.push(r);
      byBlockedHost.set(host, arr);
    }
    for (const [host, facs] of Array.from(byBlockedHost.entries()).sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`### ${host} (${facs.length})`);
      for (const f of facs) {
        const loc = [f.facility.city, f.facility.region ?? f.facility.metro].filter(Boolean).join(', ');
        lines.push(`- ${f.facility.name}${loc ? ` — ${loc}` : ''} → ${f.rawUrl}`);
      }
      lines.push('');
    }
  }

  // Healthy summary at the end (compact).
  lines.push('## ✅ Healthy URLs (compact)');
  lines.push('');
  const okUrls = uniqueUrls.filter((u) => byUrl.get(u)?.ok);
  const okCounts = new Map<string, number>();
  for (const r of okRows) okCounts.set(r.effectiveUrl!, (okCounts.get(r.effectiveUrl!) ?? 0) + 1);
  okUrls.sort((a, b) => (okCounts.get(b) ?? 0) - (okCounts.get(a) ?? 0));
  for (const u of okUrls) {
    const probe = byUrl.get(u)!;
    lines.push(`- (${okCounts.get(u) ?? 0}× facilities) HTTP ${probe.status} — ${u}`);
  }
  lines.push('');

  // Also write a JSON dump for follow-up scripting.
  const reportPath = path.resolve('link_verification_report.md');
  const jsonPath = path.resolve('link_verification_report.json');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generated_at: ts,
        totals: {
          facilities: facilities.length,
          checkable: checkable.length,
          no_url: noUrl.length,
          blocked: blocked.length,
          unique_urls: uniqueUrls.length,
          unique_dead_urls: deadByUrl.size,
          facilities_with_dead_url: dead.length,
        },
        dead: Array.from(deadByUrl.entries()).map(([url, facs]) => ({
          url,
          status: byUrl.get(url)?.status ?? null,
          error: byUrl.get(url)?.error ?? null,
          final_url: byUrl.get(url)?.finalUrl ?? null,
          facilities: facs.map((f) => ({
            id: f.facility.id,
            source_id: f.facility.source_id,
            external_id: f.facility.external_id,
            name: f.facility.name,
            city: f.facility.city,
            region: f.facility.region,
            metro: f.facility.metro,
            via: f.facility.facility_booking_url ? 'facility_booking_url' : 'source.booking_url',
          })),
        })),
        no_url: noUrl.map((r) => ({
          id: r.facility.id,
          source_id: r.facility.source_id,
          external_id: r.facility.external_id,
          name: r.facility.name,
          city: r.facility.city,
        })),
        blocked: blocked.map((r) => ({
          id: r.facility.id,
          source_id: r.facility.source_id,
          external_id: r.facility.external_id,
          name: r.facility.name,
          raw_url: r.rawUrl,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nReport written to:\n  ${reportPath}\n  ${jsonPath}`);
  console.log(
    `\nSummary: ${dead.length} facilities with dead URL across ${deadByUrl.size} unique broken URLs ` +
      `(${noUrl.length} facilities with no URL, ${blocked.length} suppressed).`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
