import type { NextRequest } from 'next/server';

import { getTrip } from '@/server/services/public-site';
import { previewAllowed } from '@/lib/api/preview-guard';
import { missing, ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export const GET = publicRoute(
  '/api/public/site/trips/[slug]',
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const preview = await previewAllowed(request, `/trips/${slug}`);
    const trip = await getTrip(slug, { preview });
    return trip ? ok(trip) : missing('journey');
  },
);
