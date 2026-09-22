import { db } from '@/lib/db';
import { route } from '@/lib/api/handler';
import { can } from '@/lib/auth/permissions';

/**
 * The three counts in the sidebar.
 *
 * Each is guarded by the permission for the screen it points at, so a
 * Reservations login is not told how many unresolved 404s the site has and an
 * Editor is not told how many enquiries are waiting. A badge is a small leak
 * of something somebody cannot open.
 */
export const GET = route({
  permission: 'dashboard.read',
  handler: async ({ user }) => {
    const [enquiries, notFound, scheduled] = await Promise.all([
      can(user.permissions, 'enquiries.read')
        ? db.enquiry.count({ where: { status: 'NEW', deletedAt: null } })
        : Promise.resolve(0),
      can(user.permissions, 'seo.read')
        ? db.notFoundLog.count({ where: { resolved: false } })
        : Promise.resolve(0),
      can(user.permissions, 'departures.read')
        ? db.departure.count({
            where: { isPublished: true, startDate: { gte: new Date() } },
          })
        : Promise.resolve(0),
    ]);

    return { enquiries, notFound, scheduled };
  },
});
