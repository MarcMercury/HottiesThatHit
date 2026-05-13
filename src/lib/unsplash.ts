// Unsplash search helper. Free for up to 50 req/hour with the demo key,
// 5,000 req/hour after promoting your app.
//
// Required env: UNSPLASH_ACCESS_KEY
// Sign up: https://unsplash.com/developers
//
// Per Unsplash API guidelines (https://help.unsplash.com/en/articles/2511315):
//   1. Use the hotlinked URLs returned under `photo.urls`.
//   2. When displaying a photo, ping `photo.links.download_location` so the
//      photographer's download counter increments.
//   3. Credit the photographer and Unsplash with UTM-tagged links back to
//      their profile and unsplash.com (utm_source = your app, utm_medium = referral).

// Identifies our app to Unsplash for the required UTM attribution links.
// Must match the application name registered at
// https://unsplash.com/oauth/applications/945424 (currently "HottieThatHit").
export const UNSPLASH_UTM_SOURCE = 'HottieThatHit';

function withUtm(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    u.searchParams.set('utm_source', UNSPLASH_UTM_SOURCE);
    u.searchParams.set('utm_medium', 'referral');
    return u.toString();
  } catch {
    return rawUrl;
  }
}

// Public link to unsplash.com itself, UTM-tagged for attribution.
export const UNSPLASH_HOME_URL = withUtm('https://unsplash.com');

export interface UnsplashPhoto {
  id: string;
  url: string;            // raw URL with sizing params (hotlinked from images.unsplash.com)
  thumb: string;
  alt: string;
  photographer: string;
  photographerUrl: string;       // UTM-tagged link to photographer's Unsplash profile
  unsplashUrl: string;           // UTM-tagged link to unsplash.com
  downloadTrackUrl: string;      // ping this once per display (see trackUnsplashDownload)
}

interface UnsplashSearchResp {
  results: Array<{
    id: string;
    alt_description: string | null;
    description: string | null;
    urls: { raw: string; regular: string; thumb: string };
    user: { name: string; links: { html: string } };
    links: { download_location: string };
  }>;
}

const cache = new Map<string, { at: number; data: UnsplashPhoto | null }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function findFacilityPhoto(query: string): Promise<UnsplashPhoto | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const hit = cache.get(query);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '1');
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('content_filter', 'high');

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${key}` },
    next: { revalidate: 86_400 },
  });
  if (!res.ok) {
    cache.set(query, { at: Date.now(), data: null });
    return null;
  }
  const json = (await res.json()) as UnsplashSearchResp;
  const r = json.results?.[0];
  if (!r) {
    cache.set(query, { at: Date.now(), data: null });
    return null;
  }
  const photo: UnsplashPhoto = {
    id: r.id,
    url: `${r.urls.raw}&w=800&fit=crop&q=80`,
    thumb: r.urls.thumb,
    alt: r.alt_description ?? r.description ?? query,
    photographer: r.user.name,
    photographerUrl: withUtm(r.user.links.html),
    unsplashUrl: UNSPLASH_HOME_URL,
    downloadTrackUrl: r.links.download_location,
  };
  cache.set(query, { at: Date.now(), data: photo });
  return photo;
}

// Per Unsplash terms: ping this when actually displaying the image.
export async function trackUnsplashDownload(downloadTrackUrl: string): Promise<void> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return;
  try {
    await fetch(downloadTrackUrl, {
      headers: { Authorization: `Client-ID ${key}` },
    });
  } catch {
    /* non-fatal */
  }
}
