import 'server-only';

import type { NextRequest } from 'next/server';

import { verifyPreviewToken } from '@/lib/auth/preview';

/**
 * Is this public request allowed to see unpublished rows?
 *
 * The token is checked *and* its path is compared with what is being asked
 * for. Without that comparison a token for one draft journey would be a token
 * for every draft on the site — which is the difference between a preview link
 * and a key.
 */
export async function previewAllowed(
  request: NextRequest,
  path: string,
): Promise<boolean> {
  const token = request.nextUrl.searchParams.get('preview');
  if (!token) return false;

  const claims = await verifyPreviewToken(token);
  if (!claims) return false;

  return claims.path === path;
}
