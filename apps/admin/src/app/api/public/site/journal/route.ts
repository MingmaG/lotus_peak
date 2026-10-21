import type { NextRequest } from 'next/server';
import { JOURNAL_CATEGORIES } from '@lotuspeak/api-contracts';

import { listPosts, postSlugs } from '@/server/services/public-site';
import { ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

export const GET = publicRoute('/api/public/site/journal', async (request: NextRequest) => {
  const params = request.nextUrl.searchParams;

  if (params.get('slugs') === '1') return ok(await postSlugs());

  const limit = Number(params.get('limit'));
  const category = JOURNAL_CATEGORIES.find((c) => c.key === params.get('category'))?.key;
  return ok(
    await listPosts({
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
      exclude: params.get('exclude') ?? undefined,
      category,
    }),
  );
});
