import 'server-only';

import { z } from 'zod';

import { notFound } from '@/lib/api/handler';
import { db } from '@/lib/db';

/**
 * Working an enquiry: its status, priority, who has it, and a note.
 *
 * Here rather than in the route because the desk and an AI client both do
 * it, and "the first time it is marked replied is when it was replied to" is
 * a rule that must not exist in only one of them.
 */
export const enquiryPatchSchema = z.object({
  status: z
    .enum(['NEW', 'READ', 'REPLIED', 'QUOTED', 'CONVERTED', 'CLOSED', 'SPAM'])
    .optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  assigneeId: z.string().nullable().optional(),
  /** Adding a note, which is the commonest write on this screen. */
  note: z.string().max(4_000).optional(),
});

export type EnquiryPatch = z.infer<typeof enquiryPatchSchema>;

export async function updateEnquiry(id: string, body: EnquiryPatch, authorId: string) {
  const before = await db.enquiry.findUnique({ where: { id } });
  if (!before) throw notFound('That enquiry');

  if (body.note?.trim()) {
    await db.note.create({
      data: { enquiryId: id, body: body.note.trim(), authorId },
    });
  }

  const enquiry = await db.enquiry.update({
    where: { id },
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

  return { before, enquiry };
}
