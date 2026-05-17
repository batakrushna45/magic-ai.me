import { NextResponse } from 'next/server';

// Middleware disabled. Keep a pass-through export so Next.js dev/prod servers
// do not fail when this file is present.
export function middleware() {
  return NextResponse.next();
}
