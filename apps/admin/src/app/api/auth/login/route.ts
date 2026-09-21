import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { signIn } from '@/lib/auth/session';
import { recordActivity } from '@/server/services/activity';

const schema = z.object({
  email: z.string().email('That does not look like an email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

/**
 * Sign in.
 *
 * Not behind `route()` from `lib/api/handler`, because that wrapper's first
 * act is to require a signed-in user. This is the one endpoint where there
 * isn't one.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_FAILED', message: 'Enter an email address and a password.' } },
      { status: 422 },
    );
  }

  const result = await signIn(parsed.data.email, parsed.data.password);

  if (!result.ok) {
    const message =
      result.reason === 'locked'
        ? `Too many attempts. Try again in ${result.retryAfterMinutes} minutes.`
        : result.reason === 'inactive'
          ? 'That account has been deactivated. Ask whoever runs the panel.'
          : 'That email and password do not match.';

    return NextResponse.json(
      { error: { code: result.reason.toUpperCase(), message } },
      /* 423 for a lock, so a client can tell "wait" from "wrong". */
      { status: result.reason === 'locked' ? 423 : 401 },
    );
  }

  await recordActivity({
    userId: result.user.id,
    action: 'LOGIN',
    entity: 'session',
    entityId: result.user.sessionId,
    entityLabel: result.user.email,
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
  }).catch(() => undefined);

  return NextResponse.json({ user: result.user });
}
