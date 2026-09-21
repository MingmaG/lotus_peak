import { z } from 'zod';

import { db } from '@/lib/db';
import { ApiError, route } from '@/lib/api/handler';
import { hashPassword } from '@/lib/auth/password';

const schema = z.object({
  name: z.string().min(1, 'Give them a name.').max(120),
  email: z.string().email('That does not look like an email address.').max(200),
  password: z
    .string()
    .min(12, 'Twelve characters at least. A phrase is easier to remember and harder to guess.')
    .max(200),
  roleId: z.string().min(1, 'Which role?'),
  jobTitle: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
});

export const GET = route({
  permission: 'users.read',
  handler: async () => ({
    users: await db.user.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        isActive: true,
        lastLoginAt: true,
        lockedUntil: true,
        createdAt: true,
        role: { select: { id: true, name: true, slug: true } },
        _count: { select: { sessions: true } },
      },
    }),
    roles: await db.role.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, description: true, permissions: true },
    }),
  }),
});

export const POST = route<z.infer<typeof schema>>({
  permission: 'users.write',
  schema,
  handler: async ({ body, audit }) => {
    const existing = await db.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) {
      throw new ApiError(409, 'CONFLICT', 'Somebody already has that email address.');
    }

    const user = await db.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase(),
        passwordHash: await hashPassword(body.password),
        roleId: body.roleId,
        jobTitle: body.jobTitle || null,
        phone: body.phone || null,
      },
      select: { id: true, name: true, email: true },
    });

    audit({ action: 'CREATE', entity: 'user', entityId: user.id, entityLabel: user.email });
    return { user };
  },
});
