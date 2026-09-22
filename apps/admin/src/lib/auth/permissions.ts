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
  'roles',
  'activity',

  'bookings',
  'payments',
  'coupons',

  /**
   * Reserved, for the parts of the business this panel does not run yet.
   *
   * These are screens with no data model behind them. The permissions exist
   * now because a role is a thing the office sets up once and rarely revisits
   * — adding one later would mean going back through every role to grant it,
   * and until then every new screen would be visible to everybody or to
   * nobody. Bookings, payments and coupons were in this list until they were
   * built, and the roles that had been granted them needed no revisiting,
   * which is the argument.
   */
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

/**
 * Every permission that means something. The owner role holds `*` instead.
 *
 * Not the cross product: `dashboard.delete` and `customers.publish` are
 * strings the type system allows and nothing will ever check. `actionsFor`
 * is what decides, so the Roles screen and this list cannot disagree.
 */
export function allPermissions(): Permission[] {
  return RESOURCES.flatMap((resource) =>
    actionsFor(resource).map((action) => permission(resource, action)),
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

/* -------------------------------------------------------------------------- */
/*  The catalogue, for the screen that edits a role                            */
/* -------------------------------------------------------------------------- */

/**
 * What each resource is called, and which actions mean anything for it.
 *
 * A permission matrix that reads `moments.publish` is a matrix nobody in the
 * office will tick correctly, so every resource carries the words they use for
 * it and a sentence saying which screen it is. The grouping is the sidebar's,
 * because "where do I find this" and "who may see it" are the same question
 * asked twice.
 *
 * `publishable` is not decoration either: only nine of these have a draft and
 * a published state, and offering a Publish tick on `customers` invites
 * somebody to grant a permission that will never be checked.
 */
export const RESOURCE_GROUPS = [
  'Overview',
  'Journeys',
  'The website',
  'Travellers',
  'Reaching people',
  'The company',
] as const;

export type ResourceGroup = (typeof RESOURCE_GROUPS)[number];

export interface ResourceMeta {
  label: string;
  group: ResourceGroup;
  hint?: string;
  /** Has a draft/published state, so Publish is a real action. */
  publishable?: true;
  /** Nothing to change — a screen that only ever shows numbers. */
  readOnly?: true;
}

export const RESOURCE_META: Record<Resource, ResourceMeta> = {
  dashboard: { label: 'Dashboard', group: 'Overview', hint: 'The front page and its figures', readOnly: true },
  activity: { label: 'Activity log', group: 'Overview', hint: 'Who changed what', readOnly: true },
  analytics: { label: 'Analytics', group: 'Overview', readOnly: true },

  trips: { label: 'Journeys', group: 'Journeys', publishable: true },
  departures: { label: 'Departures', group: 'Journeys', hint: 'Fixed dates and their places left' },
  destinations: { label: 'Destinations', group: 'Journeys', publishable: true },
  activities: { label: 'Activities', group: 'Journeys', publishable: true },
  seasons: { label: 'Seasons', group: 'Journeys' },
  countries: { label: 'Countries', group: 'Journeys' },
  categories: { label: 'Categories', group: 'Journeys' },

  pages: { label: 'Pages', group: 'The website', publishable: true },
  journal: { label: 'Journal', group: 'The website', publishable: true },
  culture: { label: 'Culture', group: 'The website', publishable: true },
  reflections: { label: 'Reflections', group: 'The website', publishable: true },
  gallery: { label: 'Gallery', group: 'The website', publishable: true },
  people: { label: 'People', group: 'The website', hint: 'Guides and the office, as the site shows them', publishable: true },
  media: { label: 'Media library', group: 'The website', hint: 'Photographs and their alt text' },
  navigation: { label: 'Navigation', group: 'The website', hint: 'The menus and the footer' },
  moments: { label: 'Moments', group: 'The website' },
  reviews: { label: 'Reviews', group: 'The website' },
  comments: { label: 'Comments', group: 'The website' },
  banners: { label: 'Banners', group: 'The website' },
  seo: { label: 'Search', group: 'The website', hint: 'Redirects, the sitemap, structured data' },

  enquiries: { label: 'Enquiries', group: 'Travellers', hint: 'What a traveller wrote, and their reply' },
  customers: { label: 'Customers', group: 'Travellers', hint: 'Names, addresses, passport details' },
  bookings: {
    label: 'Bookings',
    group: 'Travellers',
    /* The passport numbers live here, which is why this is worth spelling out
       on the screen where somebody ticks it. */
    hint: 'Who is travelling, their passport details, and what a journey costs',
  },
  payments: { label: 'Payments', group: 'Travellers', hint: 'Money in and out, against a booking' },
  coupons: { label: 'Coupons', group: 'Travellers', hint: 'Discount codes and their rules' },
  forms: { label: 'Form submissions', group: 'Travellers' },

  newsletter: { label: 'Newsletter', group: 'Reaching people' },
  emails: { label: 'Email templates', group: 'Reaching people' },
  messaging: { label: 'WhatsApp', group: 'Reaching people' },

  settings: { label: 'Company and settings', group: 'The company', hint: 'The address, the telephone, the integration keys' },
  documents: { label: 'Documents', group: 'The company', hint: 'Licences and certificates' },
  users: { label: 'Accounts', group: 'The company', hint: 'Who may sign in' },
  roles: { label: 'Roles', group: 'The company', hint: 'What each role is allowed to do — the keys to this screen' },
};

export const ACTION_META: Record<Action, { label: string; hint: string }> = {
  read: { label: 'See', hint: 'Open the screen and read what is on it' },
  write: { label: 'Change', hint: 'Add and edit, without making it live' },
  publish: { label: 'Publish', hint: 'Put it on the website, or take it down' },
  delete: { label: 'Remove', hint: 'Delete a row' },
};

/** The actions worth offering for one resource. */
export function actionsFor(resource: Resource): Action[] {
  const meta = RESOURCE_META[resource];
  if (meta.readOnly) return ['read'];
  return meta.publishable ? ['read', 'write', 'publish', 'delete'] : ['read', 'write', 'delete'];
}

/** Is this string one of ours? Guards the API against a hand-written body. */
export function isPermission(value: string): value is Permission {
  if (value === '*') return true;
  const [resource, action] = value.split('.');
  return (
    RESOURCES.includes(resource as Resource) &&
    actionsFor(resource as Resource).includes(action as Action)
  );
}

/**
 * The same set with everything already implied by a higher action dropped.
 *
 * `['trips.read', 'trips.publish']` is stored as `['trips.publish']`, because
 * `can()` answers both questions from the second one alone. Without this a row
 * grows a line every time somebody ticks Publish on a role that could already
 * read, and the difference between two roles stops being readable in the
 * database — which is where you look when the panel is the thing that is
 * broken.
 */
export function minimise(held: readonly string[]): Permission[] {
  if (held.includes('*')) return ['*'];
  const set = [...new Set(held)].filter(isPermission);
  return set.filter((one) => {
    const rest = set.filter((other) => other !== one);
    return !can(rest, one);
  });
}

/**
 * The roles a fresh install starts with.
 *
 * Five, because the office has five kinds of person and not because five is a
 * tidy number:
 *
 * - **Owner** runs the company. Everything, including who else may sign in and
 *   what every other role is allowed to do.
 * - **Administrator** runs the panel day to day: all of the content, all of the
 *   travellers, the settings, and the accounts. Not the roles — see below.
 * - **Editor** writes and publishes the site, and cannot see a customer's
 *   personal data or change an integration key.
 * - **Reservations** answers enquiries and the telephone. It reads the
 *   catalogue because you cannot answer a question about the Jomolhari trek
 *   without it, and writes nothing on the site.
 * - **Viewer** looks. For an accountant, or a new starter in their first week.
 *
 * Two splits matter. Content and personal data are different jobs, so the
 * person who writes the journal has no business reading the enquiries. And
 * `roles.write` is held by the owner alone: somebody who can edit a role can
 * grant themselves anything, so it is not a permission to hand out with the
 * rest of the administration — which is the whole reason it is a separate
 * resource from `users`.
 *
 * These are a starting point, not a fixed list. The office adds its own from
 * the Roles screen, and may change any of these except Owner.
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
    name: 'Administrator',
    slug: 'administrator',
    description:
      'Runs the whole panel — content, travellers, settings and accounts. Cannot change what a role is allowed to do.',
    /* Everything the catalogue holds, less the two that would let this role
       rewrite itself into an owner. `roles.read` stays: seeing what the roles
       are is what makes the Accounts screen readable. */
    permissions: allPermissions().filter(
      (one) => one !== 'roles.write' && one !== 'roles.delete',
    ),
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
      /* Reservations is the desk that takes bookings and the money against
         them, so it holds both — but not `bookings.delete`: hiding a booking
         is not the operation anybody on that desk wants, and cancelling is,
         which `bookings.write` covers. */
      'bookings.write',
      'payments.write',
      'coupons.read',
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
