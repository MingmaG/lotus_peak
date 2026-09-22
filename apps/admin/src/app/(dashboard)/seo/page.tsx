import { redirect } from 'next/navigation';

import { requirePermission } from '@/lib/auth/session';

/**
 * `/seo` is the discovery screen.
 *
 * There is no third thing for this route to be: redirects and discovery are
 * the two SEO screens, and an index page listing two links is a click between
 * somebody and the screen they wanted.
 */
export default async function SeoPage() {
  await requirePermission('seo.read');
  redirect('/seo/discovery');
}
