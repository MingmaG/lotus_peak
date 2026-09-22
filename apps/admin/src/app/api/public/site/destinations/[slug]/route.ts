import type { NextRequest } from 'next/server';

import { destinationPathForSlug, getDestination } from '@/server/services/public-site';
import { previewAllowed } from '@/lib/api/preview-guard';
import { missing, ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

/**
 * One valley's or one place's page, by its own slug.
 *
 * By slug alone, not by `paro/taktsang`: destination slugs are unique across
 * valleys and places, and the website checks that the valley in the URL is
 * the one the record names. The path *is* needed for a preview, because a
 * preview token is scoped to the page's address — so it is looked up first.
 */
export const GET = publicRoute(
  '/api/public/site/destinations/[slug]',
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const path = request.nextUrl.searchParams.has('preview')
      ? await destinationPathForSlug(slug)
      : null;
    const preview = path ? await previewAllowed(request, path) : false;
    const destination = await getDestination(slug, { preview });
    return destination ? ok(destination) : missing('destination');
  },
);
