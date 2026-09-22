import {
  listActivities,
  listCulture,
  listDestinations,
  listGallery,
  listPeople,
  listReflections,
  listSeasons,
} from '@/server/services/public-site';
import { ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

/**
 * Everything small, in one request.
 *
 * Destinations, activities, seasons, culture, the gallery, the reflections and
 * the people. Seven endpoints would be more RESTful and would be the wrong
 * shape: between them these are about forty rows, the home page renders four
 * of the seven, and the `/destinations` page renders three. Seven fetches with
 * seven cache entries to answer one page is six more round trips than the data
 * is worth.
 *
 * The journeys and the journal are *not* here, because those are the two that
 * grow without bound and the two that are paginated.
 */
export const GET = publicRoute('/api/public/site/catalogue', async () => {
  const [destinations, activities, seasons, culture, gallery, reflections, people] =
    await Promise.all([
      listDestinations(),
      listActivities(),
      listSeasons(),
      listCulture(),
      listGallery(),
      listReflections(),
      listPeople(),
    ]);

  return ok({ destinations, activities, seasons, culture, gallery, reflections, people });
});
