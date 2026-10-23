import type { NextRequest } from 'next/server';

import { jsonResponse, preflight, readParams } from '@/server/mcp/http';
import { revokeToken } from '@/server/mcp/oauth';

/**
 * RFC 7009 revocation. Always 200, whether or not the token was known — the
 * RFC says so, and a different answer would tell a stranger which tokens
 * exist.
 */

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  const params = await readParams(request);
  if (params.token) await revokeToken(params.token).catch(() => undefined);
  return jsonResponse({});
}

export const OPTIONS = preflight;
