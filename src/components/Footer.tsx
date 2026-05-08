import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-line bg-ink/70">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <p className="font-display text-2xl text-hot-400 neon-text">Hotties That Hit</p>
          <p className="mt-2 text-white/60">
            Every open court in LA. One screen.
          </p>
        </div>
        <div>
          <p className="text-white/90 font-semibold mb-2">Play</p>
          <ul className="space-y-1.5 text-white/60">
            <li><Link href="/slots" className="hover:text-hot-300">Reservations</Link></li>
            <li><Link href="/courts" className="hover:text-hot-300">Find a Court</Link></li>
            <li><Link href="/players" className="hover:text-hot-300">Find Players</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-white/90 font-semibold mb-2">Company</p>
          <ul className="space-y-1.5 text-white/60">
            <li><Link href="/about" className="hover:text-hot-300">About</Link></li>
            <li><a href="mailto:hello@hottiesthathit.com" className="hover:text-hot-300">Contact</a></li>
          </ul>
        </div>
        <div>
          <p className="text-white/90 font-semibold mb-2">Legal</p>
          <ul className="space-y-1.5 text-white/60">
            <li><Link href="/privacy" className="hover:text-hot-300">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-hot-300">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-line">
        <div className="mx-auto max-w-6xl px-4 py-4 text-xs text-white/40 flex justify-between">
          <span>© {new Date().getFullYear()} Hotties That Hit</span>
          <span>Made in LA · Pink courts only 💗</span>
        </div>
      </div>
    </footer>
  );
}
