import { z } from 'zod';

import { db } from '@/lib/db';
import { notFound, route } from '@/lib/api/handler';

const patchSchema = z.object({
  status: z
    .enum(['NEW', 'READ', 'REPLIED', 'QUOTED', 'CONVERTED', 'CLOSED', 'SPAM'])
    .optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  assigneeId: z.string().nullable().optional(),
  /** Adding a note, which is the commonest write on this screen. */
  note: z.string().max(4_000).optional(),
});

export const GET = route<undefined, { id: string }>({
  permission: 'enquiries.read',
  handler: async ({ params, user, audit }) => {
    const enquiry = await db.enquiry.findUnique({
      where: { id: params.id },
      include: {
        trip: { select: { id: true, title: true, slug: true } },
        assignee: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, email: true } },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { name: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            kind: true,
            toEmail: true,
            subject: true,
            status: true,
            sentAt: true,
            error: true,
            createdAt: true,
          },
        },
      },
    });
    if (!enquiry) throw notFound('That enquiry');

    /**
     * Opening a NEW enquiry marks it read.
     *
     * The unread count is the one number on the dashboard that has to be
     * trustworthy, and a count that only goes down when somebody remembers to
     * press a button is a count everybody learns to ignore.
     */
    if (enquiry.status === 'NEW') {
      await db.enquiry.update({ where: { id: params.id }, data: { status: 'READ' } });
      audit({
        action: 'UPDATE',
        entity: 'enquiry',
        entityId: enquiry.id,
        entityLabel: enquiry.reference,
        after: { status: 'READ' },
      });
      enquiry.status = 'READ';
    }

    void user;
    return { enquiry };
  },
});

export const PATCH = route<z.infer<typeof patchSchema>, { id: string }>({
  permission: 'enquiries.write',
  schema: patchSchema,
  handler: async ({ params, body, user, audit }) => {
    const before = await db.enquiry.findUnique({ where: { id: params.id } });
    if (!before) throw notFound('That enquiry');

    if (body.note?.trim()) {
      await db.note.create({
        data: { enquiryId: params.id, body: body.note.trim(), authorId: user.id },
      });
    }

    const enquiry = await db.enquiry.update({
      where: { id: params.id },
      data: {
        status: body.status,
        priority: body.priority,
        assigneeId: body.assigneeId === undefined ? undefined : body.assigneeId,
        /* The first time it is marked replied is when it was replied to. */
        respondedAt:
          body.status === 'REPLIED' && !before.respondedAt ? new Date() : undefined,
        closedAt:
          body.status === 'CLOSED' || body.status === 'CONVERTED'
            ? (before.closedAt ?? new Date())
            : undefined,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { author: { select: { name: true } } },
        },
      },
    });

    audit({
      action: 'UPDATE',
      entity: 'enquiry',
      entityId: enquiry.id,
      entityLabel: enquiry.reference,
      before: { status: before.status, priority: before.priority, assigneeId: before.assigneeId },
      after: { status: enquiry.status, priority: enquiry.priority, assigneeId: enquiry.assigneeId },
    });

    return { enquiry };
  },
});

export const DELETE = route<undefined, { id: string }>({
  permission: 'enquiries.delete',
  handler: async ({ params, audit }) => {
    const enquiry = await db.enquiry.findUnique({ where: { id: params.id } });
    if (!enquiry) throw notFound('That enquiry');

    /**
     * Soft, and it stays soft.
     *
     * This is somebody's name, email address and telephone number. A real
     * delete is the right answer to an erasure request and the wrong answer to
     * a mis-click, and the two are told apart by a person rather than by a
     * button — so the button hides it and the retention job removes it.
     */
    await db.enquiry.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    audit({
      action: 'DELETE',
      entity: 'enquiry',
      entityId: enquiry.id,
      entityLabel: enquiry.reference,
    });
    return null;
  },
});
