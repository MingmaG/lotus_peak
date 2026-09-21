import { getSite } from '@/server/services/public-site';
import { ok, publicRoute } from '@/lib/api/public';

export const dynamic = 'force-dynamic';

/** Everything the website's root layout renders on every page. */
export const GET = publicRoute('/api/public/site', async () => ok(await getSite()));
