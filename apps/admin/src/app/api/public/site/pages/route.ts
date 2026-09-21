import type { NextRequest } from 'next/server';

import { getPage, listPages } from '@/server/services/public-site';
import { missing, ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

/**
 * One page by `?path=/about`, or the index of them.
 *
 * A query parameter rather than a catch-all segment, because a page's path
 * *is* `/` for the home page and a catch-all cannot express an empty segment
 * without a special case at both ends.
 */
export const GET = publicRoute('/api/public/site/pages', async (request: NextRequest) => {
  const path = request.nextUrl.searchParams.get('path');
  if (!path) return ok(await listPages());

  const page = await getPage(path);
  return page ? ok(page) : missing('page');
});
