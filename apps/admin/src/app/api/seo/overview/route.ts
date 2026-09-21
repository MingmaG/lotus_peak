import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';

/**
 * What is and is not ready to be found.
 *
 * Every check here is something that silently costs the site something, and
 * none of them is visible on the page it affects: a journey with no meta
 * description looks fine and gets whatever a search engine scrapes; a page
 * marked noindex looks fine and is invisible.
 */
export const GET = route({
  permission: 'seo.read',
  handler: async () => {
    const published = { status: 'PUBLISHED' as const, deletedAt: null };

    const [
      trips,
      posts,
      pages,
      tripsNoDescription,
      postsNoDescription,
      pagesNoDescription,
      noIndexed,
      undescribedMedia,
      unresolved,
      company,
      settings,
    ] = await Promise.all([
      db.trip.count({ where: published }),
      db.post.count({ where: published }),
      db.page.count({ where: { ...published, showInSitemap: true } }),
      db.trip.findMany({
        where: { ...published, metaDescription: null, excerpt: '' },
        select: { id: true, title: true },
      }),
      db.post.findMany({
        where: { ...published, metaDescription: null, standfirst: '' },
        select: { id: true, title: true },
      }),
      db.page.findMany({
        where: { ...published, metaDescription: null, lead: null },
        select: { id: true, title: true, path: true },
      }),
      Promise.all([
        db.trip.findMany({ where: { ...published, noIndex: true }, select: { id: true, title: true } }),
        db.post.findMany({ where: { ...published, noIndex: true }, select: { id: true, title: true } }),
        db.page.findMany({ where: { ...published, noIndex: true }, select: { id: true, title: true } }),
      ]),
      db.media.count({ where: { alt: '', isDecorative: false, deletedAt: null } }),
      db.notFoundLog.count({ where: { resolved: false } }),
      db.companyProfile.findFirst({ where: { isSingleton: true } }),
      db.setting.findMany({ where: { group: 'integrations' } }),
    ]);

    const verification = settings.find((row) => row.key === 'googleSiteVerification')?.value;

    return {
      counts: { trips, posts, pages, total: trips + posts + pages },
      missingDescription: [
        ...tripsNoDescription.map((row) => ({ kind: 'Journey', ...row, href: `/trips/${row.id}` })),
        ...postsNoDescription.map((row) => ({ kind: 'Journal', ...row, href: `/journal/${row.id}` })),
        ...pagesNoDescription.map((row) => ({ kind: 'Page', ...row, href: `/pages/${row.id}` })),
      ],
      noIndexed: [
        ...noIndexed[0].map((row) => ({ kind: 'Journey', ...row, href: `/trips/${row.id}` })),
        ...noIndexed[1].map((row) => ({ kind: 'Journal', ...row, href: `/journal/${row.id}` })),
        ...noIndexed[2].map((row) => ({ kind: 'Page', ...row, href: `/pages/${row.id}` })),
      ],
      undescribedMedia,
      unresolved404s: unresolved,
      siteUrl: company?.siteUrl ?? null,
      hasSearchConsole: typeof verification === 'string' && verification.length > 0,
      hasDefaultDescription: Boolean(company?.seoDescription),
    };
  },
});
