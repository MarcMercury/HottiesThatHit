// Server component that renders a single Unsplash photo for a facility,
// with the attribution and download-tracking that the Unsplash API
// Guidelines require for production approval:
//   - Hotlinked image URL from `photo.urls.raw` (handled inside the helper).
//   - "Photo by <Name> on Unsplash" credit, both links UTM-tagged.
//   - A fire-and-forget request to `photo.links.download_location`
//     every time we display the photo.
//
// Docs: https://help.unsplash.com/en/articles/2511315-guideline-attribution

import Image from 'next/image';
import {
  findFacilityPhoto,
  trackUnsplashDownload,
  UNSPLASH_HOME_URL,
} from '@/lib/unsplash';

interface Props {
  query: string;
  /** Optional caption (e.g. the facility name) shown above the credit. */
  caption?: string;
  className?: string;
  priority?: boolean;
}

export default async function FacilityPhoto({
  query,
  caption,
  className,
  priority,
}: Props) {
  const photo = await findFacilityPhoto(query);
  if (!photo) return null;

  // Per Unsplash terms: trigger the download endpoint every time the photo
  // is displayed. Fire and forget — we never block rendering on it.
  void trackUnsplashDownload(photo.downloadTrackUrl);

  return (
    <figure
      className={
        className ??
        'relative overflow-hidden rounded-2xl border border-ink-line bg-ink-soft'
      }
    >
      <div className="relative aspect-[16/9] w-full">
        <Image
          src={photo.url}
          alt={photo.alt}
          fill
          sizes="(max-width: 768px) 100vw, 800px"
          className="object-cover"
          priority={priority}
          unoptimized
        />
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs text-white/60">
        {caption ? <span className="text-white/80">{caption}</span> : <span />}
        <span>
          Photo by{' '}
          <a
            href={photo.photographerUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-hot-300 underline-offset-2 hover:underline"
          >
            {photo.photographer}
          </a>{' '}
          on{' '}
          <a
            href={UNSPLASH_HOME_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="text-hot-300 underline-offset-2 hover:underline"
          >
            Unsplash
          </a>
        </span>
      </figcaption>
    </figure>
  );
}
