import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth/session';

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in again.' } },
      { status: 401 },
    );
  }
  return NextResponse.json({ user });
}
