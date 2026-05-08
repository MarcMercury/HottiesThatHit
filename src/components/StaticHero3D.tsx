'use client';

// Static 3D hero — renders a pre-baked GLB from /public via <model-viewer>.
// Falls back to a still image until the script + model load.

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Props {
  src?: string;
  poster?: string;
  alt?: string;
  size?: number;
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
          'interaction-prompt'?: 'auto' | 'none' | 'when-focused';
          ar?: boolean | string;
          exposure?: string | number;
          'camera-orbit'?: string;
          'field-of-view'?: string;
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
  if (document.querySelector('script[data-mv]')) return;
  const s = document.createElement('script');
  s.type = 'module';
  s.src = MODEL_VIEWER_SRC;
  s.dataset.mv = '1';
  document.head.appendChild(s);
}

export default function StaticHero3D({
  src = '/hero.glb',
  poster = '/logo.png',
  alt = 'Hotties That Hit',
  size = 520,
}: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureModelViewer();
    // Wait until the custom element is defined before rendering it,
    // so we don't get a flash of unstyled <model-viewer>.
    if (typeof window === 'undefined') return;
    if (window.customElements?.get('model-viewer')) {
      setReady(true);
      return;
    }
    let cancelled = false;
    window.customElements
      ?.whenDefined('model-viewer')
      .then(() => !cancelled && setReady(true))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size, maxWidth: '100%' }}>
      <div className="absolute -inset-8 rounded-full bg-hot-500/30 blur-3xl pointer-events-none" />

      {ready ? (
        <model-viewer
          src={src}
          alt={alt}
          poster={poster}
          auto-rotate
          camera-controls
          rotation-per-second="20deg"
          shadow-intensity="0.6"
          exposure="1.1"
          interaction-prompt="none"
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
            src={poster}
            alt={alt}
            width={size}
            height={size}
            priority
            className="relative object-contain drop-shadow-[0_10px_40px_rgba(255,31,143,0.45)]"
          />
        </div>
      )}
    </div>
  );
}
