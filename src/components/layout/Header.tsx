'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { getInitials } from '@/lib/utils';

interface HeaderProps {
  user: { name?: string | null; email?: string | null; image?: string | null };
  isAdmin?: boolean;
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { href: '/search',    label: 'Search',    icon: '⊕' },
  { href: '/calculator', label: 'Calculator', icon: '◇' },
  { href: '/profile',   label: 'Profile',   icon: '◎' },
];

export default function Header({ user, isAdmin }: HeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0F0F0F]/95 backdrop-blur border-b border-[#1E1E1E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-md" style={{ boxShadow: '0 0 12px rgba(249,115,22,0.4)' }}>
            <span className="text-sm font-black text-white">M</span>
          </div>
          <span className="font-bold text-white text-lg hidden sm:block tracking-tight">
            Magic <span className="text-orange-500">AI</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-[#1E1E1E]'
                }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                pathname.startsWith('/admin')
                  ? 'bg-orange-500/15 text-orange-400 border border-orange-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-[#1E1E1E]'
              }`}
            >
              <span className="text-base">⚙</span> Admin
            </Link>
          )}
        </nav>

        {/* Right: user */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center gap-2.5 hover:bg-[#1E1E1E] rounded-xl px-2 py-1.5 transition-colors"
          >
            {user.image ? (
              <Image src={user.image} alt="" width={32} height={32} className="rounded-full ring-2 ring-orange-500/30" />
            ) : (
              <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {getInitials(user.name ?? user.email ?? 'U')}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-white leading-none truncate max-w-[120px]">
                {user.name?.split(' ')[0] ?? 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate max-w-[120px]">{user.email}</p>
            </div>
            <svg className="w-4 h-4 text-gray-500 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-xl overflow-hidden z-50 animate-fade-in">
              {/* Mobile nav links */}
              <div className="md:hidden border-b border-[#2A2A2A] p-2">
                {NAV.map(({ href, label, icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-[#252525] transition-colors"
                  >
                    <span>{icon}</span> {label}
                  </Link>
                ))}
                {isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-300 hover:text-white hover:bg-[#252525] transition-colors"
                  >
                    <span>⚙</span> Admin
                  </Link>
                )}
              </div>
              <div className="p-2">
                <div className="px-3 py-2">
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
                <button
                  onClick={() => { setMenuOpen(false); signOut({ callbackUrl: '/login' }); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
