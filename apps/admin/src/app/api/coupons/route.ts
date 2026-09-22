import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { listQuery, paginated, route } from '@/lib/api/handler';
import { couponCreateSchema, type CouponInput } from '@/server/validators/coupon';
import { date } from '@/server/services/booking';

export const GET = route({
  permission: 'coupons.read',
  handler: async ({ searchParams }) => {
    const q = listQuery(searchParams);
    const state = searchParams.get('state');
    const now = new Date();

    /**
     * Live, scheduled, finished, off.
     *
     * Not a column. A coupon's state is its dates and its `isActive` flag read
     * together, and storing it would mean a job to move rows from scheduled to
     * live at midnight — a job that, when it fails, leaves coupons that say
     * they are not running while the website takes them.
     */
    const byState: Record<string, Prisma.CouponWhereInput> = {
      live: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      scheduled: { isActive: true, startsAt: { gt: now } },
      finished: { endsAt: { lt: now } },
      off: { isActive: false },
    };

    const where: Prisma.CouponWhereInput = {
      deletedAt: null,
      ...(q.search
        ? {
            OR: [
              { code: { contains: q.search, mode: 'insensitive' } },
              { description: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(state && state !== 'all' ? (byState[state] ?? {}) : {}),
    };

    const [rows, total] = await Promise.all([
      db.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.perPage,
        take: q.perPage,
        include: {
          trips: { select: { tripId: true, trip: { select: { title: true } } } },
          _count: { select: { redemptions: true } },
        },
      }),
      db.coupon.count({ where }),
    ]);

    return paginated(rows, total, q);
  },
});

export const POST = route<CouponInput>({
  permission: 'coupons.write',
  schema: couponCreateSchema,
  handler: async ({ body, audit }) => {
    const coupon = await db.coupon.create({
      data: {
        code: body.code,
        description: body.description || null,
        kind: body.kind,
        value: body.value,
        currency: body.currency,
        minSpendCents: body.minSpendCents ?? null,
        maxDiscountCents: body.maxDiscountCents ?? null,
        startsAt: date(body.startsAt),
        endsAt: date(body.endsAt),
        maxRedemptions: body.maxRedemptions ?? null,
        maxPerCustomer: body.maxPerCustomer ?? null,
        isActive: body.isActive,
        trips: { create: body.tripIds.map((tripId) => ({ tripId })) },
      },
      include: {
        trips: { select: { tripId: true, trip: { select: { title: true } } } },
        _count: { select: { redemptions: true } },
      },
    });

    audit({
      action: 'CREATE',
      entity: 'coupon',
      entityId: coupon.id,
      entityLabel: coupon.code,
      after: { kind: coupon.kind, value: coupon.value },
    });

    return { coupon };
  },
});
