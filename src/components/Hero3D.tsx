'use client';

// 3D hero element rendered with Google's <model-viewer> web component.
// - Polls /api/meshy/asset?slug=hero until the Meshy task finishes
// - Falls back to the static logo image until/unless a GLB is ready
// - Web component is loaded once via a single <script type="module"> tag

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface AssetResponse {
  slug: string;
  status: string;
  glb_url: string | null;
  thumbnail_url: string | null;
}

interface Props {
  slug?: string;
  fallbackSrc?: string;
  fallbackAlt?: string;
  size?: number;
  poster?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          poster?: string;
          'auto-rotate'?: boolean | string;
          'camera-controls'?: boolean | string;
          'shadow-intensity'?: string | number;
          'environment-image'?: string;
          'rotation-per-second'?: string;
          ar?: boolean | string;
          exposure?: string | number;
          loading?: 'auto' | 'lazy' | 'eager';
          reveal?: 'auto' | 'interaction' | 'manual';
          'disable-zoom'?: boolean | string;
          style?: React.CSSProperties;
        },
        HTMLElement
      >;
    }
  }
}

const MODEL_VIEWER_SRC =
  'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js';

function ensureModelViewer() {
  if (typeof window === 'undefined') return;
  if (document.querySelector(`script[data-mv]`)) return;
  const s = document.createElement('script');
  s.type = 'module';
  s.src = MODEL_VIEWER_SRC;
  s.dataset.mv = '1';
  document.head.appendChild(s);
}

export default function Hero3D({
  slug = 'hero',
  fallbackSrc = '/logo.png',
  fallbackAlt = 'Hotties That Hit',
  size = 520,
  poster,
}: Props) {
  const [asset, setAsset] = useState<AssetResponse | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    ensureModelViewer();
  }, []);

  // Poll the asset endpoint. Backs off after first success or terminal failure.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const res = await fetch(`/api/meshy/asset?slug=${encodeURIComponent(slug)}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as AssetResponse;
        if (cancelled) return;
        setAsset(json);
        const done =
          json.status === 'SUCCEEDED' ||
          json.status === 'FAILED' ||
          json.status === 'NOT_CONFIGURED' ||
          json.status === 'EXPIRED';
        if (!done && tries < 60) {
          // Meshy preview tasks usually finish in 30–90s. Poll every 5s.
          timer = setTimeout(() => setTries((n) => n + 1), 5000);
        }
      } catch {
        if (!cancelled && tries < 60) {
          timer = setTimeout(() => setTries((n) => n + 1), 8000);
        }
      }
    }
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tries]);

  const glb = asset?.glb_url ?? null;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size, maxWidth: '100%' }}>
      <div className="absolute -inset-8 rounded-full bg-hot-500/30 blur-3xl pointer-events-none" />

      {glb ? (
        <model-viewer
          src={glb}
          alt={fallbackAlt}
          poster={poster ?? asset?.thumbnail_url ?? fallbackSrc}
          auto-rotate
          camera-controls
          rotation-per-second="20deg"
          shadow-intensity="1"
          exposure="1.1"
          loading="eager"
          reveal="auto"
          disable-zoom
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            filter: 'drop-shadow(0 10px 40px rgba(255,31,143,0.45))',
          }}
        />
      ) : (
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src={fallbackSrc}
            alt={fallbackAlt}
            width={size}
            height={size}
            priority
            className="relative drop-shadow-[0_10px_40px_rgba(255,31,143,0.45)]"
          />
          {asset && asset.status !== 'SUCCEEDED' && asset.status !== 'NOT_CONFIGURED' && (
            <span className="absolute bottom-2 right-2 chip text-[10px] opacity-80">
              {asset.status === 'PENDING' || asset.status === 'IN_PROGRESS'
                ? 'rendering 3D…'
                : asset.status}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
