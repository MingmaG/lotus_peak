import type { NextRequest } from 'next/server';

import { getCulture } from '@/server/services/public-site';
import { culturePath } from '@/server/services/content-paths';
import { previewAllowed } from '@/lib/api/preview-guard';
import { missing, ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

/** One culture piece's page. */
export const GET = publicRoute(
  '/api/public/site/culture/[slug]',
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const preview = await previewAllowed(request, culturePath(slug));
    const article = await getCulture(slug, { preview });
    return article ? ok(article) : missing('culture piece');
  },
);
