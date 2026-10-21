import { ok, publicRoute } from '@/lib/api/public';
import { getEnquiryMail } from '@/server/services/enquiry-mail';

export const dynamic = 'force-dynamic';

/**
 * The words, the sender and the two switches an enquiry's mail is made of.
 *
 * Read by the website, which sends both messages. Tagged `emails` on that
 * side, so saving a template on the Email wording screen reaches it in the
 * usual few hundred milliseconds — and, far more to the point, so the last
 * published copy is sitting on the website when this panel cannot be asked.
 */
export const GET = publicRoute('/api/public/site/enquiry-mail', async () =>
  ok(await getEnquiryMail()),
);
