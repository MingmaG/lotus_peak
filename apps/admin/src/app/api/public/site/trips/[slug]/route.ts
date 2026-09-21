import type { NextRequest } from 'next/server';

import { getTrip } from '@/server/services/public-site';
import { missing, ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export const GET = publicRoute(
  '/api/public/site/trips/[slug]',
  async (_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const trip = await getTrip(slug);
    return trip ? ok(trip) : missing('journey');
  },
);
