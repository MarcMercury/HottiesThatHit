// Unsplash search helper. Free for up to 50 req/hour with the demo key,
// 5,000 req/hour after promoting your app.
//
// Required env: UNSPLASH_ACCESS_KEY
// Sign up: https://unsplash.com/developers
//
// Per Unsplash API guidelines, when you display a photo you MUST also
// trigger the `links.download_location` endpoint and credit the photographer.

export interface UnsplashPhoto {
  id: string;
  url: string;            // raw URL with sizing params
  thumb: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
  downloadTrackUrl: string;
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
    photographerUrl: r.user.links.html,
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
