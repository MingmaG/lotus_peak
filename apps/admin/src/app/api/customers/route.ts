import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';
import { customerSchema, type CustomerInput } from '@/server/validators/customer';
import { date } from '@/server/services/booking';

/**
 * Everybody who has written in more than once, and everybody who has not.
 *
 * A customer row is created by hand rather than automatically from an enquiry:
 * two enquiries from one address are often two different people at the same
 * organisation, and merging them silently loses the distinction. The Enquiries
 * screen offers to link one.
 */
export const GET = route({
  permission: 'customers.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { email: { contains: q.search, mode: 'insensitive' } },
              { country: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      db.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: { _count: { select: { enquiries: true, bookings: true } } },
      }),
      db.customer.count({ where }),
    ]);

    return paginated(rows, total, q);
  },
});

/**
 * Adding one by hand.
 *
 * Still by hand, and still not automatic from an enquiry — the comment above
 * is the reason and it has not changed. What has changed is that a booking
 * needs somebody to invoice, so the office now creates these rows before a
 * booking rather than only when two enquiries turn out to be one person.
 *
 * The unique email is the constraint that matters. A duplicate comes back as a
 * 409 naming the field, from the handler's own Prisma translation, so the form
 * can say which one.
 */
export const POST = route<CustomerInput>({
  permission: 'customers.write',
  schema: customerSchema,
  handler: async ({ body, audit }) => {
    const customer = await db.customer.create({
      data: {
        ...body,
        email: body.email.toLowerCase(),
        phone: body.phone || null,
        country: body.country || null,
        notes: body.notes || null,
        dateOfBirth: date(body.dateOfBirth),
        passportExpiry: date(body.passportExpiry),
      },
      include: { _count: { select: { enquiries: true, bookings: true } } },
    });

    audit({
      action: 'CREATE',
      entity: 'customer',
      entityId: customer.id,
      entityLabel: customer.name,
    });

    return { customer };
  },
});
