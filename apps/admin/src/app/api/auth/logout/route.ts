import { NextResponse, type NextRequest } from 'next/server';

import { currentUser, signOut } from '@/lib/auth/session';
import { recordActivity } from '@/server/services/activity';

export async function POST(request: NextRequest) {
  const user = await currentUser();
  await signOut();

  if (user) {
    await recordActivity({
      userId: user.id,
      action: 'LOGOUT',
      entity: 'session',
      entityId: user.sessionId,
      entityLabel: user.email,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    }).catch(() => undefined);
  }

  return new NextResponse(null, { status: 204 });
}
