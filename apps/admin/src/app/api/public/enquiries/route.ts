import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { enquiryReference } from '@/lib/reference';
import { ok, publicRoute } from '@/lib/api/public';
import { deliverEnquiry } from '@/server/services/enquiry-mail';

export const dynamic = 'force-dynamic';

/**
 * The one thing the website writes.
 *
 * Unauthenticated by necessity — a visitor filling in a contact form has no
 * credential — which makes it the only endpoint in this application an
 * attacker can reach, and the whole of the defence is here:
 *
 * - **A honeypot field** that must arrive empty. It costs nothing and stops
 *   the overwhelming majority of form spam, which is scripts that fill in
 *   every input they find.
 * - **A rate limit per address**, from a setting rather than a constant,
 *   because the right number is different on the day a festival departure is
 *   announced and the office should not need a deploy to raise it.
 * - **Length caps on every field**, so a POST cannot put a megabyte of text
 *   into a row somebody then opens in a table.
 *
 * What it deliberately does *not* have is a CAPTCHA. This form receives a
 * handful of enquiries a week from people who have already decided to spend
 * several thousand dollars; a puzzle between them and the office is a worse
 * trade than a spam row somebody marks as spam.
 */

const schema = z.object({
  name: z.string().trim().min(1, 'Please tell us your name.').max(120),
  email: z.string().trim().email('That does not look like an email address.').max(200),
  country: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(40).optional(),
  tripSlug: z.string().trim().max(120).optional(),
  travellers: z.string().trim().max(80).optional(),
  adults: z.number().int().min(0).max(60).optional(),
  children: z.number().int().min(0).max(60).optional(),
  preferredDates: z.string().trim().max(120).optional(),
  message: z.string().trim().max(5_000).optional(),
  restDays: z.boolean().optional(),
  source: z.enum(['contact', 'trip-detail', 'drawer', 'newsletter']),
  honeypot: z.string().max(200).optional(),
  pagePath: z.string().trim().max(300).optional(),
  utm: z.record(z.string().max(200)).optional(),
});

const SOURCE = {
  contact: 'CONTACT',
  'trip-detail': 'TRIP_DETAIL',
  drawer: 'DRAWER',
  newsletter: 'NEWSLETTER',
} as const;

export const POST = publicRoute(
  '/api/public/enquiries',
  async (request: NextRequest) => {
    const parsed = schema.safeParse(await request.json().catch(() => ({})));

    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join('.') || '_';
        if (!fields[path]) fields[path] = issue.message;
      }
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Some fields need attention.',
            details: fields,
          },
        },
        { status: 422 },
      );
    }

    const input = parsed.data;

    /**
     * A filled honeypot answers 200 with a plausible reference.
     *
     * Not 400. A bot that is told it failed retries with the field left
     * blank; a bot that is told it succeeded moves on. The reference is
     * generated and thrown away, and nothing is written.
     */
    if (input.honeypot && input.honeypot.trim().length > 0) {
      return ok({ id: 'discarded', reference: enquiryReference() });
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      null;

    if (ip && (await overLimit(ip))) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message:
              'That is several enquiries in a short time. Give us a little while to read the first one.',
          },
        },
        { status: 429 },
      );
    }

    const trip = input.tripSlug
      ? await db.trip.findFirst({
          where: { slug: input.tripSlug, deletedAt: null },
          select: { id: true, title: true },
        })
      : null;

    const enquiry = await db.enquiry.create({
      data: {
        reference: enquiryReference(),
        name: input.name,
        email: input.email.toLowerCase(),
        phone: input.phone ?? null,
        country: input.country ?? null,
        tripId: trip?.id ?? null,
        travellers: input.travellers ?? null,
        adults: input.adults ?? null,
        children: input.children ?? null,
        preferredDates: input.preferredDates ?? null,
        message: input.message ?? null,
        restDays: input.restDays ?? false,
        source: SOURCE[input.source],
        pagePath: input.pagePath ?? null,
        utmSource: input.utm?.utm_source ?? null,
        utmMedium: input.utm?.utm_medium ?? null,
        utmCampaign: input.utm?.utm_campaign ?? null,
        ipAddress: ip,
        userAgent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      },
    });

    /**
     * The record is written first, and the mail is not awaited.
     *
     * An enquiry that was saved and whose email failed is a row the office
     * sees. An enquiry rejected because a mail provider was slow is a customer
     * who has gone elsewhere. The delivery logs its own failures into
     * `email_messages`, where they are visible on the Email screen.
     */
    void deliverEnquiry(enquiry.id).catch((error) => {
      console.error('[enquiry] delivery failed for', enquiry.reference, error);
    });

    return ok({ id: enquiry.id, reference: enquiry.reference });
  },
);

/**
 * Too many from one address in the last hour.
 *
 * Counted out of the `enquiries` table rather than held in memory, because the
 * admin panel may run as more than one process and an in-memory counter would
 * then allow the limit once per process. It costs one indexed count per
 * submission, which for a form that receives a handful a week is free.
 */
async function overLimit(ip: string): Promise<boolean> {
  const setting = await db.setting.findUnique({
    where: { group_key: { group: 'enquiries', key: 'maxPerHourPerIp' } },
  });
  const max = typeof setting?.value === 'number' ? setting.value : 5;
  if (max <= 0) return false;

  const recent = await db.enquiry.count({
    where: { ipAddress: ip, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  return recent >= max;
}
