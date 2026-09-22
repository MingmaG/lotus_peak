import { db } from '@/lib/db';
import { conflict, notFound, route } from '@/lib/api/handler';
import { customerUpdateSchema, type CustomerInput } from '@/server/validators/customer';
import { date } from '@/server/services/booking';

export const GET = route<undefined, { id: string }>({
  permission: 'customers.read',
  handler: async ({ params }) => {
    const customer = await db.customer.findFirst({
      where: { id: params.id, deletedAt: null },
      include: {
        enquiries: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            reference: true,
            status: true,
            createdAt: true,
            trip: { select: { title: true } },
          },
        },
        bookings: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            reference: true,
            status: true,
            kind: true,
            startDate: true,
            currency: true,
            totalCents: true,
            netPaidCents: true,
            refundedCents: true,
            trip: { select: { title: true } },
          },
        },
        noteRows: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { name: true } } },
        },
      },
    });
    if (!customer) throw notFound('That customer');
    return { customer };
  },
});

export const PATCH = route<Partial<CustomerInput>, { id: string }>({
  permission: 'customers.write',
  schema: customerUpdateSchema,
  handler: async ({ params, body, audit }) => {
    const before = await db.customer.findFirst({
      where: { id: params.id, deletedAt: null },
    });
    if (!before) throw notFound('That customer');

    const customer = await db.customer.update({
      where: { id: params.id },
      data: {
        ...body,
        email: body.email ? body.email.toLowerCase() : undefined,
        /**
         * `undefined` means "not sent" and null means "cleared", and the two
         * have to stay apart on a PATCH. Spreading `body` gets that right for
         * the plain fields; the dates need it said, because they arrive as
         * strings and go in as `Date | null`.
         */
        dateOfBirth: body.dateOfBirth === undefined ? undefined : date(body.dateOfBirth),
        passportExpiry:
          body.passportExpiry === undefined ? undefined : date(body.passportExpiry),
      },
      include: { _count: { select: { enquiries: true, bookings: true } } },
    });

    audit({
      action: 'UPDATE',
      entity: 'customer',
      entityId: customer.id,
      entityLabel: customer.name,
      before: { email: before.email, name: before.name },
      after: { email: customer.email, name: customer.name },
    });

    return { customer };
  },
});

/**
 * Hidden, and refused while a booking points at it.
 *
 * `Booking.customerId` is required and its foreign key is `RESTRICT`, so a
 * customer with bookings could not be hard-deleted anyway — Postgres would
 * refuse it. This refuses it earlier and in a sentence, because "Something
 * else still refers to this" does not tell anybody which thing or what to do
 * about it.
 */
export const DELETE = route<undefined, { id: string }>({
  permission: 'customers.delete',
  handler: async ({ params, audit }) => {
    const customer = await db.customer.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { _count: { select: { bookings: true } } },
    });
    if (!customer) throw notFound('That customer');

    if (customer._count.bookings > 0) {
      throw conflict(
        `${customer.name} has ${customer._count.bookings} booking${customer._count.bookings === 1 ? '' : 's'}. Cancel those first, or leave the record where it is.`,
      );
    }

    await db.customer.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    audit({
      action: 'DELETE',
      entity: 'customer',
      entityId: customer.id,
      entityLabel: customer.name,
    });
    return null;
  },
});
