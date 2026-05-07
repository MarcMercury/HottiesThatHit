'use client';

// Interactive Leaflet map of every LA tennis court we track.
// - OpenStreetMap tiles (no API key)
// - Marker clustering (>1 court per area) via leaflet.markercluster
// - Custom hot-pink markers tinted by booking status
// - Filter chips for category / region / online-bookable

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LMap, Marker as LMarker, LayerGroup } from 'leaflet';

export interface Facility {
  id: string;
  source_id: string;
  source_name: string;
  external_id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number;
  lng: number;
  num_courts: number | null;
  surface: string | null;
  lights: boolean | null;
  category: string | null;
  region: string | null;
  phone: string | null;
  website: string | null;
  online_booking: boolean;
  booking_url: string | null;
}

interface Props {
  facilities: Facility[];
}

// LA County center
const LA_CENTER: [number, number] = [34.05, -118.35];

const CATEGORY_LABEL: Record<string, string> = {
  'Public Open': 'Free park',
  'Public Managed': 'Reservable center',
};

const CATEGORY_COLOR: Record<string, string> = {
  'Public Managed': '#FF1F8F', // hot pink — reservable
  'Public Open': '#22d3ee', // cyan — free
};

function makeIcon(L: typeof import('leaflet'), color: string, online: boolean) {
  const ring = online ? '#FFD400' : 'rgba(255,255,255,0.45)';
  const html = `
    <span style="
      display:block; width:18px; height:18px; border-radius:9999px;
      background:${color}; border:2px solid ${ring};
      box-shadow:0 0 12px ${color}aa, 0 0 0 1px rgba(0,0,0,0.6);
    "></span>`;
  return L.divIcon({ html, className: 'hth-marker', iconSize: [18, 18], iconAnchor: [9, 9] });
}

export default function CourtsMap({ facilities }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LMap | null>(null);
  const clusterRef = useRef<LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  // Filters
  const allRegions = useMemo(
    () => Array.from(new Set(facilities.map((f) => f.region).filter(Boolean))).sort() as string[],
    [facilities]
  );
  const allSources = useMemo(
    () => Array.from(new Set(facilities.map((f) => f.source_name))).sort(),
    [facilities]
  );

  const [showOpen, setShowOpen] = useState(true);
  const [showManaged, setShowManaged] = useState(true);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [region, setRegion] = useState<string>('');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return facilities.filter((f) => {
      if (!showOpen && f.category === 'Public Open') return false;
      if (!showManaged && f.category === 'Public Managed') return false;
      if (onlineOnly && !f.online_booking) return false;
      if (region && f.region !== region) return false;
      if (q && !(f.name.toLowerCase().includes(q) || (f.city ?? '').toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [facilities, showOpen, showManaged, onlineOnly, region, search]);

  // Init map once on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css' as any);
      await import('leaflet.markercluster');
      await import('leaflet.markercluster/dist/MarkerCluster.css' as any);
      await import('leaflet.markercluster/dist/MarkerCluster.Default.css' as any);
      if (cancelled || !mapEl.current || mapRef.current) return;

      const map = L.map(mapEl.current, {
        center: LA_CENTER,
        zoom: 10,
        zoomControl: true,
        scrollWheelZoom: true,
      });
      // Dark Carto basemap (no API key)
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png',
        {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20,
        }
      ).addTo(map);
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}@2x.png',
        { subdomains: 'abcd', maxZoom: 20, pane: 'shadowPane' }
      ).addTo(map);

      mapRef.current = map;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Re-render markers when filters change
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    let alive = true;
    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet.markercluster');
      if (!alive || !mapRef.current) return;

      // Clear previous cluster
      if (clusterRef.current) {
        mapRef.current.removeLayer(clusterRef.current);
      }
      const cluster: LayerGroup = (L as unknown as { markerClusterGroup: (opts: unknown) => LayerGroup }).markerClusterGroup({
        maxClusterRadius: 45,
        showCoverageOnHover: false,
        iconCreateFunction: (c: any) => {
          const n = c.getChildCount();
          return L.divIcon({
            html: `<div style="
              display:flex; align-items:center; justify-content:center;
              width:38px; height:38px; border-radius:9999px;
              background:rgba(255,31,143,0.85); color:white; font-weight:700;
              border:2px solid rgba(255,255,255,0.7);
              box-shadow:0 0 14px rgba(255,31,143,0.7);
              font-size:13px;
            ">${n}</div>`,
            className: 'hth-cluster',
            iconSize: [38, 38],
          });
        },
      });

      for (const f of visible) {
        const color = CATEGORY_COLOR[f.category ?? ''] ?? '#9ca3af';
        const icon = makeIcon(L, color, f.online_booking);
        const m: LMarker = L.marker([f.lat, f.lng], { icon, title: f.name });
        m.bindPopup(popupHtml(f), { minWidth: 220, maxWidth: 280 });
        cluster.addLayer(m);
      }
      cluster.addTo(mapRef.current);
      clusterRef.current = cluster;
    })();
    return () => {
      alive = false;
    };
  }, [visible, ready]);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Filters */}
      <aside className="card p-4 space-y-4 h-fit lg:sticky lg:top-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">Search</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Court or city…"
            className="w-full rounded-md bg-ink-soft/80 border border-ink-line px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-hot-400"
          />
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-white/50 mb-2">Type</p>
          <label className="flex items-center gap-2 text-sm py-1 cursor-pointer">
            <input type="checkbox" checked={showManaged} onChange={(e) => setShowManaged(e.target.checked)} className="accent-hot-500" />
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLOR['Public Managed'] }} />
            Reservable centers
          </label>
          <label className="flex items-center gap-2 text-sm py-1 cursor-pointer">
            <input type="checkbox" checked={showOpen} onChange={(e) => setShowOpen(e.target.checked)} className="accent-hot-500" />
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLOR['Public Open'] }} />
            Free park courts
          </label>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} className="accent-hot-500" />
            Online booking only
          </label>
          <p className="text-[11px] text-white/40 mt-1">Yellow ring = reservable online.</p>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full rounded-md bg-ink-soft/80 border border-ink-line px-3 py-2 text-sm text-white"
          >
            <option value="">All regions</option>
            {allRegions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="border-t border-ink-line pt-3 text-xs text-white/55">
          Showing <span className="text-hot-300 font-semibold">{visible.length}</span> of {facilities.length} courts.
        </div>

        <details className="text-xs text-white/55">
          <summary className="cursor-pointer text-white/70">Booking systems ({allSources.length})</summary>
          <ul className="mt-2 space-y-1">
            {allSources.map((s) => (
              <li key={s}>· {s}</li>
            ))}
          </ul>
        </details>
      </aside>

      {/* Map */}
      <div className="card overflow-hidden border-ink-line" style={{ height: '70vh', minHeight: 480 }}>
        <div ref={mapEl} className="w-full h-full" />
      </div>
    </div>
  );
}

function popupHtml(f: Facility): string {
  const parts: string[] = [];
  parts.push(`<div style="font:600 14px system-ui;color:#fff;margin-bottom:4px;">${escapeHtml(f.name)}</div>`);
  const meta: string[] = [];
  if (f.num_courts) meta.push(`${f.num_courts} courts`);
  if (f.region) meta.push(f.region);
  if (f.category) meta.push(CATEGORY_LABEL[f.category] ?? f.category);
  parts.push(`<div style="font:12px system-ui;color:#a1a1aa;margin-bottom:6px;">${meta.join(' · ')}</div>`);
  if (f.phone) parts.push(`<div style="font:12px system-ui;"><a style="color:#fda4af" href="tel:${f.phone}">${escapeHtml(f.phone)}</a></div>`);
  if (f.online_booking && f.booking_url) {
    parts.push(`<a href="${escapeHtml(f.booking_url)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:6px 10px;border-radius:9999px;background:#FF1F8F;color:white;font:600 12px system-ui;text-decoration:none;">Book online →</a>`);
  } else if (f.booking_url) {
    parts.push(`<a href="${escapeHtml(f.booking_url)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:6px 10px;border-radius:9999px;border:1px solid #FF1F8F;color:#FF1F8F;font:600 12px system-ui;text-decoration:none;">Info / phone reservation</a>`);
  }
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`;
  parts.push(`<a href="${dirUrl}" target="_blank" rel="noopener" style="display:inline-block;margin:8px 0 0 6px;color:#a1a1aa;font:500 12px system-ui;">Directions ↗</a>`);
  return parts.join('');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
