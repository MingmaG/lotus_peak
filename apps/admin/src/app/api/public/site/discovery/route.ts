import type { NextRequest } from 'next/server';

import { buildLlmsFullTxt, buildLlmsTxt } from '@lotuspeak/seo';

import {
  getCulture,
  getDestination,
  getSite,
  getTrip,
  listCulture,
  listDestinations,
  listPages,
  listPosts,
  listRedirects,
  listTrips,
  getPost,
  getSitemap,
  postSlugs,
  tripSlugs,
} from '@/server/services/public-site';
import { ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

/**
 * The sitemap, the redirects, and the two files generative engines read.
 *
 * Built here rather than in the website for one reason: the website would have
 * to fetch every journey and every journal entry to write `llms-full.txt`,
 * which is forty requests over HTTP to reassemble data that is four queries
 * away on this side. The website asks once and writes what it is given.
 *
 * `?part=` narrows it, because `/sitemap.xml` does not need the full text of
 * five journeys and `/llms-full.txt` does not need the redirect table.
 */
export const GET = publicRoute('/api/public/site/discovery', async (request: NextRequest) => {
  const part = request.nextUrl.searchParams.get('part');

  if (part === 'sitemap') return ok(await getSitemap());
  if (part === 'redirects') return ok(await listRedirects());

  const site = await getSite();

  if (part === 'llms') {
    const [trips, posts, destinations, culture, pages] = await Promise.all([
      listTrips(),
      listPosts(),
      listDestinations(),
      listCulture(),
      listPages(),
    ]);
    return ok({
      text: buildLlmsTxt({
        siteUrl: site.siteUrl,
        site,
        trips,
        posts: posts.map((post) => ({
          slug: post.slug,
          title: post.title,
          standfirst: post.standfirst,
        })),
        destinations,
        culture,
        pages,
      }),
    });
  }

  if (part === 'llms-full') {
    /**
     * Every journey and every journal entry, in full.
     *
     * Sequential rather than `Promise.all` over the slugs: this is the one
     * endpoint that reads the whole publication, it is requested by a build
     * and by a crawler and by nothing else, and forty concurrent queries with
     * their media joins is a spike Postgres feels for the sake of a file
     * nobody is waiting on.
     */
    const [tripList, postList, destinationList, cultureList] = await Promise.all([
      tripSlugs(),
      postSlugs(),
      listDestinations(),
      listCulture(),
    ]);

    const trips = [];
    for (const slug of tripList) {
      const trip = await getTrip(slug);
      if (trip) trips.push(trip);
    }

    const posts = [];
    for (const slug of postList) {
      const post = await getPost(slug);
      if (post) posts.push(post);
    }

    const destinations = [];
    for (const { slug } of destinationList) {
      const destination = await getDestination(slug);
      if (destination) destinations.push(destination);
    }

    const culture = [];
    for (const { slug } of cultureList) {
      const article = await getCulture(slug);
      if (article) culture.push(article);
    }

    return ok({
      text: buildLlmsFullTxt({
        siteUrl: site.siteUrl,
        site,
        trips,
        posts,
        destinations,
        culture,
      }),
    });
  }

  return ok({ sitemap: await getSitemap(), redirects: await listRedirects() });
});
