/**
 * What somebody may do.
 *
 * Permissions are strings of the form `<resource>.<action>`, held in an array
 * on the role. Not a bitmask — a bitmask is unreadable in a database row and
 * runs out — and not a join table, because this set is read on every request,
 * written perhaps twice a year, and never queried one row at a time.
 *
 * This file is imported by the middleware and by client components, so it must
 * stay free of `server-only`, Prisma and Node built-ins.
 */

export const RESOURCES = [
  'dashboard',
  'trips',
  'departures',
  'destinations',
  'activities',
  'seasons',
  'culture',
  'gallery',
  'reflections',
  'journal',
  'pages',
  'people',
  'navigation',
  'media',
  'enquiries',
  'customers',
  'newsletter',
  'emails',
  'settings',
  'seo',
  'users',
  'activity',

  /**
   * Reserved, for the parts of the business this panel does not run yet.
   *
   * Bookings, payments and the rest are screens with no data model behind
   * them. The permissions exist now because a role is a thing the office sets
   * up once and rarely revisits — adding `bookings.read` later would mean
   * going back through every role to grant it, and until then every new screen
   * would be visible to everybody or to nobody.
   */
  'bookings',
  'payments',
  'coupons',
  'reviews',
  'comments',
  'moments',
  'banners',
  'countries',
  'categories',
  'documents',
  'forms',
  'messaging',
  'analytics',
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['read', 'write', 'publish', 'delete'] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Resource}.${Action}` | '*';

export function permission(resource: Resource, action: Action): Permission {
  return `${resource}.${action}`;
}

/** Every permission that exists. The owner role holds `*` instead. */
export function allPermissions(): Permission[] {
  return RESOURCES.flatMap((resource) =>
    ACTIONS.map((action) => permission(resource, action)),
  );
}

/**
 * Does this set of permissions allow this one?
 *
 * Three ways to be allowed, in order of cost: the wildcard, the exact string,
 * or a higher action on the same resource. The last is what stops every role
 * definition listing `trips.read` beside `trips.write` — somebody who may
 * publish a journey may obviously read one, and a role that granted write
 * without read would be a bug waiting to be filed.
 */
export function can(
  held: readonly string[] | undefined | null,
  required: Permission,
): boolean {
  if (!held || held.length === 0) return false;
  if (held.includes('*')) return true;
  if (held.includes(required)) return true;

  const [resource, action] = required.split('.') as [Resource, Action];
  const IMPLIED: Record<Action, Action[]> = {
    read: ['write', 'publish', 'delete'],
    write: ['publish', 'delete'],
    publish: [],
    delete: [],
  };
  return (IMPLIED[action] ?? []).some((higher) =>
    held.includes(`${resource}.${higher}`),
  );
}

export function canAny(
  held: readonly string[] | undefined | null,
  required: Permission[],
): boolean {
  return required.some((one) => can(held, one));
}

/**
 * The roles a fresh install starts with.
 *
 * Four, because the office has four kinds of person and not because four is a
 * tidy number:
 *
 * - **Owner** runs the company. Everything, including who else may sign in.
 * - **Editor** writes and publishes the site, and cannot see a customer's
 *   personal data or change an integration key.
 * - **Reservations** answers enquiries. It reads the catalogue because you
 *   cannot answer a question about the Jomolhari trek without it, and writes
 *   nothing on the site.
 * - **Viewer** looks. For an accountant, or a new starter in their first week.
 *
 * The split that matters is the second and third: content and personal data
 * are different jobs, and the person who writes the journal has no business
 * reading the enquiries.
 */
export const SYSTEM_ROLES: {
  name: string;
  slug: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    name: 'Owner',
    slug: 'owner',
    description: 'Everything, including users, settings and integration keys.',
    permissions: ['*'],
  },
  {
    name: 'Editor',
    slug: 'editor',
    description:
      'Writes and publishes everything on the website. No access to enquiries, customers or settings.',
    permissions: [
      'dashboard.read',
      'trips.publish',
      'trips.delete',
      'departures.write',
      'destinations.publish',
      'activities.publish',
      'seasons.write',
      'culture.publish',
      'gallery.publish',
      'reflections.publish',
      'journal.publish',
      'journal.delete',
      'pages.publish',
      'people.publish',
      'navigation.write',
      'media.delete',
      'seo.write',
      'activity.read',
    ],
  },
  {
    name: 'Reservations',
    slug: 'reservations',
    description:
      'Answers enquiries and keeps the customer records. Reads the catalogue; changes nothing on the site.',
    permissions: [
      'dashboard.read',
      'trips.read',
      'departures.write',
      'destinations.read',
      'activities.read',
      'seasons.read',
      'culture.read',
      'journal.read',
      'pages.read',
      'media.read',
      'enquiries.delete',
      'customers.write',
      'newsletter.write',
      'emails.read',
    ],
  },
  {
    name: 'Viewer',
    slug: 'viewer',
    description: 'Reads the site content. Sees no personal data and changes nothing.',
    permissions: [
      'dashboard.read',
      'trips.read',
      'departures.read',
      'destinations.read',
      'activities.read',
      'seasons.read',
      'culture.read',
      'gallery.read',
      'reflections.read',
      'journal.read',
      'pages.read',
      'people.read',
      'media.read',
      'seo.read',
    ],
  },
];
