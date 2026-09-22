import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';
import { bookingNoteSchema } from '@/server/validators/booking';

/**
 * A note against a booking.
 *
 * Its own route rather than a field on the booking's PATCH, because adding a
 * note must not put the rest of the form through validation. Somebody writing
 * "rang about the visa, will call back Tuesday" on a half-finished booking
 * should not be told the dates are missing.
 */
export const POST = route<{ body: string }, { id: string }>({
  permission: 'bookings.write',
  schema: bookingNoteSchema,
  handler: async ({ params, body, user, audit }) => {
    const booking = await db.booking.findFirst({
      where: { id: params.id, deletedAt: null },
      select: { id: true, reference: true },
    });
    if (!booking) throw notFound('That booking');

    const note = await db.note.create({
      data: { bookingId: booking.id, body: body.body.trim(), authorId: user.id },
      include: { author: { select: { name: true } } },
    });

    audit({
      action: 'UPDATE',
      entity: 'booking',
      entityId: booking.id,
      entityLabel: booking.reference,
      after: { note: note.body.slice(0, 120) },
    });

    return { note };
  },
});
