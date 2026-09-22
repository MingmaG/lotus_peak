import { NextResponse } from 'next/server';

import { refresh } from '@/lib/auth/session';

export async function POST() {
  const user = await refresh();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in again.' } },
      { status: 401 },
    );
  }
  return NextResponse.json({ user });
}
