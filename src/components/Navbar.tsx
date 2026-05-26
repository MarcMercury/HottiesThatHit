'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from './Logo';
import { useAuth } from '@/lib/auth-context';
import { isAdminEmail } from '@/lib/admin';

const links = [
  { href: '/courts', label: 'Find a Court' },
  { href: '/open-play', label: 'Open Play' },
  { href: '/players', label: 'Find Players' },
  { href: '/matrix', label: 'Hot vs Hit' },
  { href: '/tennis-hottie', label: 'What Tennis Hottie?' },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { user, profile, signOut, loading } = useAuth();
  const isAdmin = isAdminEmail(user?.email);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink-line/80 bg-ink/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />

        <nav className="hidden md:flex items-center gap-1">
          {!loading && user && (
            <>
              <Link
                href="/profile"
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  pathname === '/profile'
                    ? 'bg-hot-500/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                My Profile
              </Link>
              <Link
                href="/journal"
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  pathname?.startsWith('/journal')
                    ? 'bg-hot-500/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                Match Journal
              </Link>
              <Link
                href="/feed"
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  pathname?.startsWith('/feed')
                    ? 'bg-hot-500/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                Feed
              </Link>
              <Link
                href="/availability"
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  pathname?.startsWith('/availability')
                    ? 'bg-hot-500/20 text-white'
                    : 'text-white/80 hover:text-white hover:bg-white/5'
                }`}
              >
                I&apos;m Free
              </Link>
            </>
          )}
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  active
                    ? 'bg-hot-500/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {l.label}
              </Link>
            );
          })}

          {!loading && !user && (
            <>
              <Link
                href="/login"
                className="rounded-full px-3 py-1.5 text-sm text-white/70 hover:text-white hover:bg-white/5"
              >
                Log in
              </Link>
              <Link href="/signup" className="btn-primary ml-2">
                Sign up
              </Link>
            </>
          )}
          {!loading && user && (
            <button
              onClick={handleSignOut}
              className="rounded-full px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5"
            >
              Sign out
            </button>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className={`rounded-full px-3 py-1.5 text-sm transition ${
                pathname?.startsWith('/admin')
                  ? 'bg-hot-500/20 text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5'
              }`}
            >
              Admin
            </Link>
          )}
        </nav>

        <button
          aria-label="Open menu"
          className="md:hidden rounded-md p-2 text-white/80 hover:bg-white/5"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="md:hidden border-t border-ink-line bg-ink/95 px-4 py-3 space-y-1">
          {!loading && user && (
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              My Profile
            </Link>
          )}
          {!loading && user && (
            <Link
              href="/journal"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Match Journal
            </Link>
          )}
          {!loading && user && (
            <Link
              href="/feed"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Feed
            </Link>
          )}
          {!loading && user && (
            <Link
              href="/availability"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              I&apos;m Free
            </Link>
          )}
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              {l.label}
            </Link>
          ))}
          {!loading && !user && (
            <>
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="btn-primary w-full mt-2"
              >
                Sign up
              </Link>
            </>
          )}
          {!loading && user && (
            <button
              onClick={handleSignOut}
              className="block w-full text-left rounded-md px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5"
            >
              Sign out
            </button>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
            >
              Admin
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
