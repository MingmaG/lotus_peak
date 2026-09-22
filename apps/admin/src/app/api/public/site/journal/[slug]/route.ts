import type { NextRequest } from 'next/server';

import { getPost } from '@/server/services/public-site';
import { previewAllowed } from '@/lib/api/preview-guard';
import { missing, ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export const GET = publicRoute(
  '/api/public/site/journal/[slug]',
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const preview = await previewAllowed(request, `/journal/${slug}`);
    const post = await getPost(slug, { preview });
    return post ? ok(post) : missing('journal entry');
  },
);
