import { NextResponse, type NextRequest } from 'next/server';

import { currentUser } from '@/lib/auth/session';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { signPreviewToken } from '@/lib/auth/preview';
import { culturePath, destinationPath } from '@/server/services/content-paths';

/**
 * Opens the website's preview of one unpublished thing.
 *
 * Signs a fifteen-minute token scoped to that page's path and redirects to the
 * site's `/api/preview`, which turns on draft mode and renders the real page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ entity: string; id: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue.' } },
      { status: 401 },
    );
  }

  const { entity, id } = await params;
  const path = await pathFor(entity, id);

  if (!path) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'There is nothing to preview.' } },
      { status: 404 },
    );
  }

  const token = await signPreviewToken({ path, sub: user.id });
  const url = new URL(`${env.site.url}/api/preview`);
  url.searchParams.set('token', token);
  url.searchParams.set('path', path);

  return NextResponse.redirect(url);
}

async function pathFor(entity: string, id: string): Promise<string | null> {
  switch (entity) {
    case 'trip': {
      const row = await db.trip.findUnique({ where: { id }, select: { slug: true } });
      return row ? `/trips/${row.slug}` : null;
    }
    case 'post': {
      const row = await db.post.findUnique({ where: { id }, select: { slug: true } });
      return row ? `/journal/${row.slug}` : null;
    }
    case 'destination': {
      const row = await db.destination.findUnique({
        where: { id },
        select: { slug: true, parent: { select: { slug: true } } },
      });
      return row ? destinationPath(row.slug, row.parent?.slug) : null;
    }
    case 'culture': {
      const row = await db.cultureArticle.findUnique({ where: { id }, select: { slug: true } });
      return row ? culturePath(row.slug) : null;
    }
    case 'page': {
      const row = await db.page.findUnique({ where: { id }, select: { path: true } });
      return row?.path ?? null;
    }
    default:
      return null;
  }
}
