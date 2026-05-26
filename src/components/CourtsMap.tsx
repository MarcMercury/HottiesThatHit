'use client';

// Interactive Leaflet map of every LA tennis court we track.
// - OpenStreetMap tiles (no API key)
// - Marker clustering (>1 court per area) via leaflet.markercluster
// - Custom hot-pink markers tinted by booking status
// - Filter chips for category / region / online-bookable

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LMap, Marker as LMarker, LayerGroup } from 'leaflet';
import { useFavorites } from '@/lib/favorites';
import { getBrowserClient } from '@/lib/supabase-browser';

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
  metro: string | null;
  phone: string | null;
  website: string | null;
  online_booking: boolean;
  booking_url: string | null;
}

interface Props {
  facilities: Facility[];
}

// Default map view (US east-west span — auto-fits to visible markers on first render).
const DEFAULT_CENTER: [number, number] = [39.5, -96.0];
const DEFAULT_ZOOM = 4;

const CATEGORY_LABEL: Record<string, string> = {
  'Public Open': 'Free park',
  'Public Managed': 'Reservable center',
};

const CATEGORY_COLOR: Record<string, string> = {
  'Public Managed': '#FF1F8F', // hot pink — reservable
  'Public Open': '#22d3ee', // cyan — free
};

// Pull a 5-digit US ZIP out of a free-form address string.
function extractZip(address: string | null): string | null {
  if (!address) return null;
  const m = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}

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

  // Favorites: keep a ref so popup click handlers always see the latest set.
  const { favorites, isFavorite, toggle, signedIn } = useFavorites();
  const favRef = useRef(favorites);
  favRef.current = favorites;
  const signedInRef = useRef(signedIn);
  signedInRef.current = signedIn;

  // Filters
  const allMetros = useMemo(
    () => Array.from(new Set(facilities.map((f) => f.metro).filter(Boolean))).sort() as string[],
    [facilities]
  );
  const [metro, setMetro] = useState<string>('');

  const allRegions = useMemo(
    () =>
      Array.from(
        new Set(
          facilities
            .filter((f) => !metro || f.metro === metro)
            .map((f) => f.region)
            .filter(Boolean)
        )
      ).sort() as string[],
    [facilities, metro]
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
  const [view, setView] = useState<'map' | 'list'>('map');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    // If the search is purely digits, treat it as a ZIP prefix match.
    const zipQuery = /^\d{3,5}$/.test(q) ? q : null;
    return facilities.filter((f) => {
      if (metro && f.metro !== metro) return false;
      if (!showOpen && f.category === 'Public Open') return false;
      if (!showManaged && f.category === 'Public Managed') return false;
      if (onlineOnly && !f.online_booking) return false;
      if (region && f.region !== region) return false;
      if (q) {
        if (zipQuery) {
          const zip = extractZip(f.address);
          if (!zip || !zip.startsWith(zipQuery)) return false;
        } else {
          const hay = `${f.name} ${f.city ?? ''} ${f.address ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
      }
      return true;
    });
  }, [facilities, metro, showOpen, showManaged, onlineOnly, region, search]);

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
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
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
        m.bindPopup(popupHtml(f, favRef.current.has(f.id)), { minWidth: 220, maxWidth: 280 });
        m.on('popupopen', () => {
          const el = m.getPopup()?.getElement();
          if (!el) return;
          const btn = el.querySelector<HTMLButtonElement>('[data-fav]');
          if (btn) {
            const paint = (active: boolean) => {
              btn.setAttribute('aria-pressed', String(active));
              btn.title = !signedInRef.current
                ? 'Sign in to save this court'
                : active
                  ? 'Remove from favorites'
                  : 'Save to favorites';
              btn.innerHTML = favoriteButtonInner(active);
            };
            paint(favRef.current.has(f.id));
            btn.onclick = async (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const next = await toggle(f.id);
              paint(next);
            };
          }
          // Async: fetch + render rating stars and lazy-load court notes.
          wireRatingAndNotes(el, f.id, signedInRef.current).catch(() => undefined);
        });
        cluster.addLayer(m);
      }
      cluster.addTo(mapRef.current);
      clusterRef.current = cluster;

      // Auto-fit the map to the visible markers (with sane bounds for empties).
      if (visible.length > 0) {
        const bounds = L.latLngBounds(visible.map((f) => [f.lat, f.lng] as [number, number]));
        mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
      }
    })();
    return () => {
      alive = false;
    };
    // `toggle` is stable enough across renders; `favorites` only repaints
    // already-open popups so it doesn't belong in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, ready]);

  // When the favorite set changes, just repaint the currently-open popup
  // (if any) without re-creating every marker on the map.
  useEffect(() => {
    const container = mapEl.current;
    if (!container) return;
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-fav]');
    buttons.forEach((btn) => {
      const id = btn.dataset.fav;
      if (!id) return;
      const active = favorites.has(id);
      btn.setAttribute('aria-pressed', String(active));
      btn.innerHTML = favoriteButtonInner(active);
    });
  }, [favorites]);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Filters */}
      <aside className="card p-4 space-y-4 h-fit lg:sticky lg:top-4">
        <details className="lg:hidden -m-1 mb-1 group" open={false}>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-1 py-1 text-sm font-semibold text-white/90">
            <span>
              Filters
              <span className="ml-2 text-xs font-normal text-white/50">
                ({visible.length}/{facilities.length})
              </span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition group-open:rotate-180">
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="mt-3 space-y-4">
            <FilterControls
              search={search} setSearch={setSearch}
              showManaged={showManaged} setShowManaged={setShowManaged}
              showOpen={showOpen} setShowOpen={setShowOpen}
              onlineOnly={onlineOnly} setOnlineOnly={setOnlineOnly}
              region={region} setRegion={setRegion}
              metro={metro} setMetro={setMetro} allMetros={allMetros}
              allRegions={allRegions} allSources={allSources}
              visibleCount={visible.length} totalCount={facilities.length}
            />
          </div>
        </details>

        <div className="hidden lg:block space-y-4">
          <FilterControls
            search={search} setSearch={setSearch}
            showManaged={showManaged} setShowManaged={setShowManaged}
            showOpen={showOpen} setShowOpen={setShowOpen}
            onlineOnly={onlineOnly} setOnlineOnly={setOnlineOnly}
            region={region} setRegion={setRegion}
            metro={metro} setMetro={setMetro} allMetros={allMetros}
            allRegions={allRegions} allSources={allSources}
            visibleCount={visible.length} totalCount={facilities.length}
          />
        </div>
      </aside>

      {/* Map + List */}
      <div className="space-y-3">
        <ViewToggle view={view} setView={setView} mapRef={mapRef} />
        <div className={view === 'map' ? 'block' : 'hidden'}>
          <div className="card overflow-hidden border-ink-line h-[60vh] min-h-[360px] sm:h-[65vh] lg:h-[70vh] lg:min-h-[480px]">
            <div ref={mapEl} className="w-full h-full" />
          </div>
        </div>
        {view === 'list' && (
          <CourtsList facilities={visible} isFavorite={isFavorite} toggleFavorite={toggle} />
        )}
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  setView,
  mapRef,
}: {
  view: 'map' | 'list';
  setView: (v: 'map' | 'list') => void;
  mapRef: React.MutableRefObject<LMap | null>;
}) {
  const switchTo = (next: 'map' | 'list') => {
    setView(next);
    if (next === 'map') {
      // Leaflet needs a size invalidation after being un-hidden so tiles render correctly.
      requestAnimationFrame(() => mapRef.current?.invalidateSize());
    }
  };
  return (
    <div className="inline-flex rounded-full border border-ink-line bg-ink-soft/60 p-1 text-xs font-semibold">
      <button
        type="button"
        onClick={() => switchTo('map')}
        className={`px-3 py-1.5 rounded-full transition ${
          view === 'map' ? 'bg-hot-500 text-white' : 'text-white/70 hover:text-white'
        }`}
      >
        Map
      </button>
      <button
        type="button"
        onClick={() => switchTo('list')}
        className={`px-3 py-1.5 rounded-full transition ${
          view === 'list' ? 'bg-hot-500 text-white' : 'text-white/70 hover:text-white'
        }`}
      >
        List
      </button>
    </div>
  );
}

function CourtsList({
  facilities,
  isFavorite,
  toggleFavorite,
}: {
  facilities: Facility[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void | Promise<boolean>;
}) {
  if (facilities.length === 0) {
    return (
      <div className="card p-8 text-center text-white/60">
        <p>No courts match those filters.</p>
      </div>
    );
  }
  return (
    <ul className="card divide-y divide-ink-line/60">
      {facilities.map((f) => {
        const usableBookingUrl = resolveBookingUrl(f.booking_url);
        const fallbackCity = f.metro === 'NYC' ? 'New York' : f.metro === 'LA' ? 'Los Angeles' : '';
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
          f.name + ' tennis ' + (f.city ?? fallbackCity)
        )}`;
        const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`;
        const meta = [
          f.region ?? f.city ?? f.metro,
          f.num_courts ? `${f.num_courts} courts` : null,
          f.surface,
          f.lights ? 'lights' : null,
          f.category ? CATEGORY_LABEL[f.category] ?? f.category : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const fav = isFavorite(f.id);
        return (
          <li
            key={f.id}
            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <div className="min-w-0 flex items-start gap-2">
              <button
                type="button"
                onClick={() => toggleFavorite(f.id)}
                aria-pressed={fav}
                aria-label={fav ? 'Remove from favorites' : 'Save to favorites'}
                title={fav ? 'Remove from favorites' : 'Save to favorites'}
                className="mt-0.5 shrink-0 text-hot-400 hover:text-hot-300"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill={fav ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{f.name}</p>
                <p className="text-xs text-white/50">{meta}</p>
                {f.address && (
                  <p className="text-[11px] text-white/40 truncate">{f.address}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-2 sm:shrink-0">
              <a
                href={dirHref}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-white/60 hover:text-white"
              >
                Directions ↗
              </a>
              {f.online_booking && usableBookingUrl ? (
                <a
                  href={usableBookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs whitespace-nowrap px-3 py-1.5 rounded-md bg-hot-500/20 text-hot-100 border border-hot-500/30 hover:bg-hot-500/40 hover:text-white transition"
                >
                  Reserve ↗
                </a>
              ) : usableBookingUrl && f.category !== 'Public Open' ? (
                <a
                  href={usableBookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs whitespace-nowrap px-3 py-1.5 rounded-md border border-hot-500/30 text-hot-200 hover:text-white hover:border-hot-500/60 transition"
                >
                  Info ↗
                </a>
              ) : (
                <a
                  href={searchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs whitespace-nowrap px-3 py-1.5 rounded-md border border-cyan-500/30 text-cyan-200 hover:text-white hover:border-cyan-400/60 transition"
                >
                  Search ↗
                </a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FilterControls({
  search, setSearch,
  showManaged, setShowManaged,
  showOpen, setShowOpen,
  onlineOnly, setOnlineOnly,
  region, setRegion,
  metro, setMetro, allMetros,
  allRegions, allSources,
  visibleCount, totalCount,
}: {
  search: string; setSearch: (v: string) => void;
  showManaged: boolean; setShowManaged: (v: boolean) => void;
  showOpen: boolean; setShowOpen: (v: boolean) => void;
  onlineOnly: boolean; setOnlineOnly: (v: boolean) => void;
  region: string; setRegion: (v: string) => void;
  metro: string; setMetro: (v: string) => void; allMetros: string[];
  allRegions: string[]; allSources: string[];
  visibleCount: number; totalCount: number;
}) {
  return (
    <>
      {allMetros.length > 1 && (
        <div>
          <p className="text-xs uppercase tracking-wider text-white/50 mb-2">City</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => { setMetro(''); setRegion(''); }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                metro === ''
                  ? 'bg-hot-500 border-hot-400 text-white'
                  : 'bg-ink-soft/60 border-ink-line text-white/70 hover:text-white hover:border-hot-500/60'
              }`}
            >
              All
            </button>
            {allMetros.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMetro(m); setRegion(''); }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                  metro === m
                    ? 'bg-hot-500 border-hot-400 text-white'
                    : 'bg-ink-soft/60 border-ink-line text-white/70 hover:text-white hover:border-hot-500/60'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs uppercase tracking-wider text-white/50 mb-1">Search</label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Court, city, or ZIP…"
          inputMode="search"
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
        Showing <span className="text-hot-300 font-semibold">{visibleCount}</span> of {totalCount} courts.
      </div>

      <details className="text-xs text-white/55">
        <summary className="cursor-pointer text-white/70">Booking systems ({allSources.length})</summary>
        <ul className="mt-2 space-y-1">
          {allSources.map((s) => (
            <li key={s}>· {s}</li>
          ))}
        </ul>
      </details>
    </>
  );
}

// Booking URLs that we know are unreliable (expired SSL, dead pages, etc.)
// Fall through to a Google search instead of linking the user to a broken site.
const BAD_BOOKING_HOSTS = [
  'tennismaps.com',
  'prospectparktenniscenter.com',   // domain expired/parked
  'mccarrentenniscenter.com',       // does not exist (correct is mccarrentennisnyc.com)
  'alleypondtennis.com',            // domain expired
  'riversideclay.org',              // domain expired (use riversideparknyc.org)
];

// Specific URLs that 404 even when the host is fine.
const BAD_BOOKING_URLS = new Set<string>([
  // USTA reorg moved the NTC page; old slug now 404s.
  'https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-billie-jean-king-national-tennis-center.html',
  // tennisinmanhattan.com sub-club pages 404 — only the root resolves.
  'https://tennisinmanhattan.com/vanderbilt-tennis-club/',
  'https://tennisinmanhattan.com/sutton-east-tennis-club/',
  'https://tennisinmanhattan.com/yorkville-tennis-club/',
]);

// In-place rewrites for known-broken URLs that have a clean replacement.
const URL_REWRITES: Record<string, string> = {
  'https://www.usta.com/en/home/play/adult-tennis/programs/national/usta-billie-jean-king-national-tennis-center.html':
    'https://www.ntc.usta.com/',
  'https://tennisinmanhattan.com/vanderbilt-tennis-club/': 'https://tennisinmanhattan.com/',
  'https://tennisinmanhattan.com/sutton-east-tennis-club/': 'https://tennisinmanhattan.com/',
  'https://tennisinmanhattan.com/yorkville-tennis-club/': 'https://tennisinmanhattan.com/',
};

function resolveBookingUrl(url: string | null): string | null {
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

function favoriteButtonInner(active: boolean): string {
  const color = active ? '#FF1F8F' : 'transparent';
  const stroke = active ? '#FF1F8F' : '#525252';
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="${color}" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

function popupHtml(f: Facility, isFav: boolean): string {
  const parts: string[] = [];
  parts.push(`<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:4px;">`);
  parts.push(`<div style="font:600 14px system-ui;color:#0a0a0a;">${escapeHtml(f.name)}</div>`);
  parts.push(`<button type="button" data-fav="${f.id}" aria-pressed="${isFav}" title="Save to favorites" style="flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;border:1px solid #e5e5e5;background:white;cursor:pointer;padding:0;">${favoriteButtonInner(isFav)}</button>`);
  parts.push(`</div>`);
  const meta: string[] = [];
  if (f.num_courts) meta.push(`${f.num_courts} courts`);
  if (f.region) meta.push(f.region);
  if (f.category) meta.push(CATEGORY_LABEL[f.category] ?? f.category);
  if (meta.length) parts.push(`<div style="font:12px system-ui;color:#525252;margin-bottom:6px;">${meta.join(' · ')}</div>`);
  if (f.address) {
    parts.push(`<div style="font:12px system-ui;color:#737373;margin-bottom:6px;">${escapeHtml(f.address)}</div>`);
  }
  if (f.phone) parts.push(`<div style="font:12px system-ui;"><a style="color:#be185d" href="tel:${f.phone}">${escapeHtml(f.phone)}</a></div>`);

  const usableBookingUrl = resolveBookingUrl(f.booking_url);
  const fallbackCity = f.metro === 'NYC' ? 'New York' : f.metro === 'LA' ? 'Los Angeles' : '';
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(f.name + ' tennis ' + (f.city ?? fallbackCity))}`;

  if (f.online_booking && usableBookingUrl) {
    parts.push(`<a href="${escapeHtml(usableBookingUrl)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:6px 10px;border-radius:9999px;background:#FF1F8F;color:white;font:600 12px system-ui;text-decoration:none;">Book online →</a>`);
  } else if (usableBookingUrl && f.category !== 'Public Open') {
    parts.push(`<a href="${escapeHtml(usableBookingUrl)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:6px 10px;border-radius:9999px;border:1px solid #FF1F8F;color:#FF1F8F;font:600 12px system-ui;text-decoration:none;">Info / phone reservation</a>`);
  } else {
    // No reliable booking URL — fall back to a Google search so the link always works.
    parts.push(`<a href="${searchUrl}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;padding:6px 10px;border-radius:9999px;border:1px solid #22d3ee;color:#0891b2;font:600 12px system-ui;text-decoration:none;">Search ↗</a>`);
  }
  const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`;
  parts.push(`<a href="${dirUrl}" target="_blank" rel="noopener" style="display:inline-block;margin:8px 0 0 6px;color:#525252;font:500 12px system-ui;">Directions ↗</a>`);

  // --- Star rating + notes section (populated asynchronously on popupopen) ---
  parts.push(`
    <div data-rating-block style="margin-top:10px;padding-top:8px;border-top:1px solid #f1f1f1;font:12px system-ui;color:#525252;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span data-rating-stars style="display:inline-flex;gap:1px;cursor:default;color:#d4d4d4;font-size:16px;line-height:1;">
          ${'★'.repeat(0)}${'☆'.repeat(5)}
        </span>
        <span data-rating-summary style="font-size:11px;color:#737373;">…</span>
      </div>
    </div>
    <div data-notes-block style="margin-top:8px;font:12px system-ui;color:#525252;">
      <button type="button" data-notes-toggle style="background:none;border:none;padding:0;color:#be185d;cursor:pointer;font:600 12px system-ui;">
        Court notes ▾
      </button>
      <div data-notes-body style="display:none;margin-top:6px;"></div>
    </div>
  `);

  return parts.join('');
}

// Lightweight DOM helpers shared by popupopen wiring.
function setStarsDisplay(
  starsEl: HTMLElement,
  value: number,
  hover: number | null,
) {
  const v = hover ?? value;
  starsEl.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const span = document.createElement('span');
    span.textContent = i <= v ? '★' : '☆';
    span.dataset.star = String(i);
    span.style.cursor = 'pointer';
    span.style.color = i <= v ? '#FF1F8F' : '#d4d4d4';
    span.style.padding = '0 1px';
    starsEl.appendChild(span);
  }
}

async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await getBrowserClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function wireRatingAndNotes(
  popupEl: HTMLElement,
  facilityId: string,
  signedIn: boolean,
) {
  // ----- Rating -----
  const ratingBlock = popupEl.querySelector<HTMLElement>('[data-rating-block]');
  const starsEl = popupEl.querySelector<HTMLElement>('[data-rating-stars]');
  const summaryEl = popupEl.querySelector<HTMLElement>('[data-rating-summary]');
  if (ratingBlock && starsEl && summaryEl) {
    const token = signedIn ? await getAuthToken() : null;
    try {
      const res = await fetch(`/api/facilities/${facilityId}/rating`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        avg_stars: number | null;
        rating_count: number;
        my_stars: number | null;
      };
      let myStars = json.my_stars ?? 0;
      const renderSummary = (avg: number | null, count: number) => {
        if (count === 0) {
          summaryEl.textContent = signedIn ? 'Tap to rate' : 'No ratings yet';
        } else {
          summaryEl.textContent = `${(avg ?? 0).toFixed(1)} (${count})`;
        }
      };
      renderSummary(json.avg_stars, json.rating_count);
      setStarsDisplay(starsEl, myStars, null);
      if (signedIn) {
        starsEl.title = 'Your rating';
        starsEl.style.cursor = 'pointer';
        starsEl.addEventListener('mouseleave', () => setStarsDisplay(starsEl, myStars, null));
        starsEl.addEventListener('mousemove', (e) => {
          const target = e.target as HTMLElement;
          const n = Number(target.dataset?.star);
          if (n >= 1 && n <= 5) setStarsDisplay(starsEl, myStars, n);
        });
        starsEl.addEventListener('click', async (e) => {
          const target = e.target as HTMLElement;
          const n = Number(target.dataset?.star);
          if (!n) return;
          // Click same star again to clear.
          const next = n === myStars ? null : n;
          const t = await getAuthToken();
          const r = await fetch(`/api/facilities/${facilityId}/rating`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...(t ? { Authorization: `Bearer ${t}` } : {}),
            },
            body: JSON.stringify({ stars: next }),
          });
          if (!r.ok) return;
          myStars = next ?? 0;
          setStarsDisplay(starsEl, myStars, null);
          // Refresh summary.
          const r2 = await fetch(`/api/facilities/${facilityId}/rating`, { cache: 'no-store' });
          if (r2.ok) {
            const j2 = (await r2.json()) as { avg_stars: number | null; rating_count: number };
            renderSummary(j2.avg_stars, j2.rating_count);
          }
        });
      } else {
        starsEl.title = 'Sign in to rate this court';
      }
    } catch {
      summaryEl.textContent = '';
    }
  }

  // ----- Notes (lazy: only fetch when toggled open) -----
  const toggle = popupEl.querySelector<HTMLButtonElement>('[data-notes-toggle]');
  const body = popupEl.querySelector<HTMLElement>('[data-notes-body]');
  if (!toggle || !body) return;
  let loaded = false;
  toggle.addEventListener('click', async () => {
    const open = body.style.display !== 'none';
    if (open) {
      body.style.display = 'none';
      toggle.textContent = 'Court notes ▾';
      return;
    }
    body.style.display = 'block';
    toggle.textContent = 'Court notes ▴';
    if (loaded) return;
    loaded = true;
    body.innerHTML = '<div style="color:#737373;font-size:11px;">Loading…</div>';

    const t = signedIn ? await getAuthToken() : null;
    const res = await fetch(`/api/facilities/${facilityId}/notes`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => ({}))) as {
      notes?: Array<{ id: string; body: string; approved_at: string | null }>;
      my_pending?: Array<{ id: string; body: string; status: string }>;
    };
    const notes = json.notes ?? [];
    const pending = json.my_pending ?? [];

    const list = document.createElement('div');
    if (notes.length === 0) {
      const p = document.createElement('div');
      p.style.cssText = 'color:#737373;font-size:11px;margin-bottom:6px;';
      p.textContent = 'No approved notes yet.';
      list.appendChild(p);
    } else {
      for (const n of notes) {
        const item = document.createElement('div');
        item.style.cssText =
          'background:#fafafa;border:1px solid #f1f1f1;border-radius:6px;padding:6px 8px;margin-bottom:6px;color:#262626;font-size:12px;white-space:pre-wrap;';
        item.textContent = n.body;
        list.appendChild(item);
      }
    }
    if (pending.length > 0) {
      const head = document.createElement('div');
      head.style.cssText = 'font-size:10px;color:#737373;margin-top:4px;';
      head.textContent = 'Your pending notes (awaiting admin):';
      list.appendChild(head);
      for (const n of pending) {
        const item = document.createElement('div');
        item.style.cssText =
          'background:#fff7ed;border:1px dashed #fbbf24;border-radius:6px;padding:6px 8px;margin-top:4px;color:#92400e;font-size:11px;white-space:pre-wrap;';
        item.textContent = n.body;
        list.appendChild(item);
      }
    }
    body.innerHTML = '';
    body.appendChild(list);

    if (signedIn) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'margin-top:6px;';
      const ta = document.createElement('textarea');
      ta.rows = 2;
      ta.maxLength = 1000;
      ta.placeholder = 'Share something useful about this court…';
      ta.style.cssText =
        'width:100%;box-sizing:border-box;border:1px solid #e5e5e5;border-radius:6px;padding:6px 8px;font:12px system-ui;color:#0a0a0a;background:#fff;resize:vertical;';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Submit for review';
      btn.style.cssText =
        'margin-top:4px;padding:5px 10px;border-radius:9999px;background:#FF1F8F;color:#fff;border:none;font:600 11px system-ui;cursor:pointer;';
      const msg = document.createElement('div');
      msg.style.cssText = 'font-size:11px;color:#737373;margin-top:4px;';
      btn.addEventListener('click', async () => {
        const text = ta.value.trim();
        if (!text) return;
        btn.disabled = true;
        msg.textContent = 'Submitting…';
        const t2 = await getAuthToken();
        const r = await fetch(`/api/facilities/${facilityId}/notes`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(t2 ? { Authorization: `Bearer ${t2}` } : {}),
          },
          body: JSON.stringify({ body: text }),
        });
        btn.disabled = false;
        if (!r.ok) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          msg.textContent = j.error ?? 'Submit failed';
          msg.style.color = '#dc2626';
          return;
        }
        ta.value = '';
        msg.textContent = 'Submitted — pending admin approval.';
        msg.style.color = '#16a34a';
        // Append to pending list.
        const j = (await r.json()) as { note: { body: string } };
        const item = document.createElement('div');
        item.style.cssText =
          'background:#fff7ed;border:1px dashed #fbbf24;border-radius:6px;padding:6px 8px;margin-top:4px;color:#92400e;font-size:11px;white-space:pre-wrap;';
        item.textContent = j.note.body;
        list.appendChild(item);
      });
      wrap.appendChild(ta);
      wrap.appendChild(btn);
      wrap.appendChild(msg);
      body.appendChild(wrap);
    } else {
      const p = document.createElement('div');
      p.style.cssText = 'font-size:11px;color:#737373;margin-top:6px;';
      p.innerHTML =
        '<a href="/login" style="color:#be185d;">Sign in</a> to add a note about this court.';
      body.appendChild(p);
    }
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
