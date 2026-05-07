import Image from 'next/image';
import Link from 'next/link';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <Link href="/" className="flex items-center gap-2 group" aria-label="Hotties That Hit home">
      <Image
        src="/logo.png"
        alt="Hotties That Hit"
        width={size}
        height={size}
        priority
        className="rounded-full ring-2 ring-hot-500/60 group-hover:ring-hot-400 transition"
      />
      <span className="font-display text-xl text-white tracking-wide hidden sm:block">
        <span className="text-hot-400 neon-text">Hotties</span>{' '}
        <span className="text-white/80">That Hit</span>
      </span>
    </Link>
  );
}
