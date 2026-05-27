'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from './Logo';
import { useAuth } from '@/lib/auth-context';
import { isAdminEmail } from '@/lib/admin';

// Nav order: My Profile, Feed, Find a Court, Play, Find Players, Match Journal, Fun Extras
const navOrder = [
  { type: 'profile' },
  { type: 'feed' },
  { type: 'courts' },
  { type: 'play' },
  { type: 'players' },
  { type: 'journal' },
  { type: 'fun' },
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

  const [playOpen, setPlayOpen] = useState(false);
  const [funOpen, setFunOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-ink-line/80 bg-ink/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />


        <nav className="hidden md:flex items-center gap-1">
          {(!loading && user) && navOrder.map((item) => {
            if (item.type === 'profile') {
              return (
                <Link
                  key="profile"
                  href="/profile"
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    pathname === '/profile'
                      ? 'bg-hot-500/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  My Profile
                </Link>
              );
            }
            if (item.type === 'feed') {
              return (
                <Link
                  key="feed"
                  href="/feed"
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    pathname?.startsWith('/feed')
                      ? 'bg-hot-500/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Feed
                </Link>
              );
            }
            if (item.type === 'courts') {
              return (
                <Link
                  key="courts"
                  href="/courts"
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    pathname === '/courts'
                      ? 'bg-hot-500/20 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Find a Court
                </Link>
              );
            }
            if (item.type === 'play') {
              return (
                <div key="play" className="relative group">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-sm transition flex items-center gap-1 ${
                      (pathname?.startsWith('/open-play') || pathname?.startsWith('/availability'))
                        ? 'bg-hot-500/20 text-white'
                        : 'text-white/80 hover:text-white hover:bg-white/5'
                    }`}
                    onClick={() => setPlayOpen((v) => !v)}
                    onBlur={() => setTimeout(() => setPlayOpen(false), 150)}
                    aria-haspopup="menu"
                    aria-expanded={playOpen}
                  >
                    Play
                    <svg className="inline ml-1" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {(playOpen) && (
                    <div className="absolute left-0 mt-2 min-w-[160px] rounded-lg bg-ink-soft/95 shadow-lg border border-ink-line z-50">
                      <Link
                        href="/open-play"
                        className="block px-4 py-2 text-sm text-white/90 hover:bg-hot-500/10"
                        onClick={() => setPlayOpen(false)}
                      >
                        Open Play
                      </Link>
                      <Link
                        href="/availability"
                        className="block px-4 py-2 text-sm text-white/90 hover:bg-hot-500/10"
                        onClick={() => setPlayOpen(false)}
                      >
                        I&apos;m Free
                      </Link>
                    </div>
                  )}
                </div>
              );
            }
            if (item.type === 'players') {
              return (
                <Link
                  key="players"
                  href="/players"
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    pathname === '/players'
                      ? 'bg-hot-500/20 text-white'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Find Players
                </Link>
              );
            }
            if (item.type === 'journal') {
              return (
                <Link
                  key="journal"
                  href="/journal"
                  className={`rounded-full px-3 py-1.5 text-sm transition ${
                    pathname?.startsWith('/journal')
                      ? 'bg-hot-500/20 text-white'
                      : 'text-white/80 hover:text-white hover:bg-white/5'
                  }`}
                >
                  Match Journal
                </Link>
              );
            }
            if (item.type === 'fun') {
              return (
                <div key="fun" className="relative">
                  <button
                    type="button"
                    className={`rounded-full px-3 py-1.5 text-sm transition flex items-center gap-1 ${
                      (pathname === '/matrix' || pathname === '/tennis-hottie')
                        ? 'bg-hot-500/20 text-white'
                        : 'text-white/70 hover:text-white hover:bg-white/5'
                    }`}
                    aria-haspopup="menu"
                    aria-expanded={funOpen}
                    onClick={() => setFunOpen((v) => !v)}
                    onBlur={() => setTimeout(() => setFunOpen(false), 150)}
                    onFocus={() => setFunOpen(true)}
                  >
                    Fun Extras
                    <svg className="inline ml-1" width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  {funOpen && (
                    <div
                      className="absolute left-0 mt-2 min-w-[160px] rounded-lg bg-ink-soft/95 shadow-lg border border-ink-line z-50"
                      onMouseEnter={() => setFunOpen(true)}
                      onMouseLeave={() => setFunOpen(false)}
                    >
                      <Link
                        href="/matrix"
                        className="block px-4 py-2 text-sm text-white/90 hover:bg-hot-500/10"
                        onClick={() => setFunOpen(false)}
                      >
                        Hot vs Hit
                      </Link>
                      <Link
                        href="/tennis-hottie"
                        className="block px-4 py-2 text-sm text-white/90 hover:bg-hot-500/10"
                        onClick={() => setFunOpen(false)}
                      >
                        What Tennis Hottie?
                      </Link>
                    </div>
                  )}
                </div>
              );
            }
            return null;
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
            <details>
              <summary className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5 cursor-pointer select-none">Play</summary>
              <div className="ml-4 mt-1 space-y-1">
                <Link
                  href="/open-play"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                >
                  Open Play
                </Link>
                <Link
                  href="/availability"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                >
                  I&apos;m Free
                </Link>
              </div>
            </details>
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

          {(!loading && user) && navOrder.map((item) => {
            if (item.type === 'profile') {
              return (
                <Link
                  key="profile"
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                >
                  My Profile
                </Link>
              );
            }
            if (item.type === 'feed') {
              return (
                <Link
                  key="feed"
                  href="/feed"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                >
                  Feed
                </Link>
              );
            }
            if (item.type === 'courts') {
              return (
                <Link
                  key="courts"
                  href="/courts"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                >
                  Find a Court
                </Link>
              );
            }
            if (item.type === 'play') {
              return (
                <details key="play">
                  <summary className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5 cursor-pointer select-none">Play</summary>
                  <div className="ml-4 mt-1 space-y-1">
                    <Link
                      href="/open-play"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                    >
                      Open Play
                    </Link>
                    <Link
                      href="/availability"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                    >
                      I&apos;m Free
                    </Link>
                  </div>
                </details>
              );
            }
            if (item.type === 'players') {
              return (
                <Link
                  key="players"
                  href="/players"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                >
                  Find Players
                </Link>
              );
            }
            if (item.type === 'journal') {
              return (
                <Link
                  key="journal"
                  href="/journal"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                >
                  Match Journal
                </Link>
              );
            }
            if (item.type === 'fun') {
              return (
                <details key="fun">
                  <summary className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5 cursor-pointer select-none">Fun Extras</summary>
                  <div className="ml-4 mt-1 space-y-1">
                    <Link
                      href="/matrix"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                    >
                      Hot vs Hit
                    </Link>
                    <Link
                      href="/tennis-hottie"
                      onClick={() => setOpen(false)}
                      className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                    >
                      What Tennis Hottie?
                    </Link>
                  </div>
                </details>
              );
            }
            return null;
          })}

          {/* Fun Extras Dropdown for mobile */}
          <details>
            <summary className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5 cursor-pointer select-none">Fun Extras</summary>
            <div className="ml-4 mt-1 space-y-1">
              <Link
                href="/matrix"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
              >
                Hot vs Hit
              </Link>
              <Link
                href="/tennis-hottie"
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5"
              >
                What Tennis Hottie?
              </Link>
            </div>
          </details>
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
