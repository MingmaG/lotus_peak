import type { NextRequest } from 'next/server';
import type { ApiTrip } from '@lotuspeak/api-contracts';

import { listTrips, tripSlugs } from '@/server/services/public-site';
import { ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

/**
 * The journeys index, or just the slugs.
 *
 * `?slugs=1` is what `generateStaticParams` asks for, and it is a separate
 * shape rather than a projection of the list because the list carries five
 * hero images and their renditions — several kilobytes to answer a question
 * about five strings.
 */
export const GET = publicRoute('/api/public/site/trips', async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;

  if (params.get('slugs') === '1') return ok(await tripSlugs());

  const type = params.get('type');
  const limit = Number(params.get('limit'));
  const featured = params.get('featured');

  return ok(
    await listTrips({
      type: type ? (type as ApiTrip['type']) : undefined,
      featured: featured === '1' ? true : featured === '0' ? false : undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    }),
  );
});
