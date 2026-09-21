import type { NextRequest } from 'next/server';

import { getPost } from '@/server/services/public-site';
import { missing, ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export const GET = publicRoute(
  '/api/public/site/journal/[slug]',
  async (_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    const post = await getPost(slug);
    return post ? ok(post) : missing('journal entry');
  },
);
