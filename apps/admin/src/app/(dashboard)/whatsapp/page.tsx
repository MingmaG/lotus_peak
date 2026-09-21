import { NotBuiltYet } from '@/components/shared/not-built-yet';
import { requirePermission } from '@/lib/auth/session';

export const metadata = { title: 'WhatsApp' };
export const dynamic = 'force-dynamic';

export default async function WhatsappPage() {
  await requirePermission('messaging.read');

  return (
    <NotBuiltYet
      title="WhatsApp"
      description="The channel most travellers actually reply on."
      willHold={[
        "The number, and the message a Chat button opens with",
        "Which pages show the button",
        "Templates for the messages the office sends often"
]}
      needs="The WhatsApp Business API, which is an account and an approval rather than a table. The number itself is already in Company, and the website reads it from there."
    />
  );
}
