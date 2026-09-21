import {
  Activity,
  BookOpen,
  Building2,
  CalendarRange,
  Compass,
  FileText,
  Footprints,
  Images,
  Inbox,
  LayoutDashboard,
  Link2,
  Mail,
  MapPin,
  Menu,
  MessageSquareQuote,
  Mountain,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  Users,
  UserSquare,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { Permission } from '@/lib/auth/permissions';

/**
 * The sidebar.
 *
 * Grouped by what the person is doing rather than by what the table is called.
 * "Journeys" and "Departures" sit together because they are the same job on
 * two days; "Enquiries" and "Customers" sit together for the same reason, and
 * both are a long way from "Journal" — because the person writing the journal
 * is usually not the person answering the telephone.
 *
 * Every entry names the permission it needs. The sidebar filters itself
 * against the signed-in person's set, so a Reservations login simply does not
 * see the content groups. That is presentation only: the route enforces the
 * same permission again, because a hidden link is not a closed door.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
  /**
   * A count fetched by `/api/dashboard/badges` — new enquiries, unresolved
   * 404s, scheduled items due. Only where the number changes something: a
   * badge on a screen nobody has to act on is noise that trains people to
   * ignore badges.
   */
  badge?: 'enquiries' | 'notFound' | 'scheduled';
  /** Shown under the label on the first run, where the name is not enough. */
  hint?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
        permission: 'dashboard.read',
      },
      {
        label: 'Enquiries',
        href: '/enquiries',
        icon: Inbox,
        permission: 'enquiries.read',
        badge: 'enquiries',
      },
    ],
  },
  {
    label: 'Journeys',
    items: [
      {
        label: 'Journeys',
        href: '/trips',
        icon: Mountain,
        permission: 'trips.read',
        hint: 'The five journeys, their itineraries and their prices',
      },
      {
        label: 'Departures',
        href: '/departures',
        icon: CalendarRange,
        permission: 'departures.read',
        badge: 'scheduled',
      },
      {
        label: 'Destinations',
        href: '/destinations',
        icon: MapPin,
        permission: 'destinations.read',
      },
      {
        label: 'What you can do',
        href: '/activities',
        icon: Footprints,
        permission: 'activities.read',
      },
      {
        label: 'Seasons',
        href: '/seasons',
        icon: Sun,
        permission: 'seasons.read',
        hint: 'The four panels on the home page',
      },
    ],
  },
  {
    label: 'Words and pictures',
    items: [
      {
        label: 'Journal',
        href: '/journal',
        icon: BookOpen,
        permission: 'journal.read',
      },
      {
        label: 'Pages',
        href: '/pages',
        icon: FileText,
        permission: 'pages.read',
        hint: 'About, Contact, Terms, and the home page bands',
      },
      {
        label: 'Culture',
        href: '/culture',
        icon: Compass,
        permission: 'culture.read',
      },
      {
        label: 'Gallery',
        href: '/gallery',
        icon: Images,
        permission: 'gallery.read',
      },
      {
        label: 'Reflections',
        href: '/reflections',
        icon: MessageSquareQuote,
        permission: 'reflections.read',
        hint: 'What travellers have said. No star ratings, by design',
      },
      {
        label: 'People',
        href: '/people',
        icon: UserSquare,
        permission: 'people.read',
      },
      {
        label: 'Media library',
        href: '/media',
        icon: Images,
        permission: 'media.read',
      },
      {
        label: 'Navigation',
        href: '/navigation',
        icon: Menu,
        permission: 'navigation.write',
      },
    ],
  },
  {
    label: 'People who write in',
    items: [
      {
        label: 'Customers',
        href: '/customers',
        icon: Users,
        permission: 'customers.read',
      },
      {
        label: 'Newsletter',
        href: '/newsletter',
        icon: Send,
        permission: 'newsletter.read',
      },
      {
        label: 'Email',
        href: '/emails',
        icon: Mail,
        permission: 'emails.read',
        hint: 'What was sent, and the words it was sent in',
      },
    ],
  },
  {
    label: 'Findability',
    items: [
      {
        label: 'SEO',
        href: '/seo',
        icon: Search,
        permission: 'seo.read',
      },
      {
        label: 'Redirects',
        href: '/seo/redirects',
        icon: Link2,
        permission: 'seo.read',
        badge: 'notFound',
      },
      {
        label: 'AI and discovery',
        href: '/seo/discovery',
        icon: Sparkles,
        permission: 'seo.read',
        hint: 'llms.txt, the sitemap, the feed and the structured data',
      },
    ],
  },
  {
    label: 'The company',
    items: [
      {
        label: 'Company',
        href: '/settings/company',
        icon: Building2,
        permission: 'settings.read',
        hint: 'Name, address, telephone, social links — once, for the whole site',
      },
      {
        label: 'Settings',
        href: '/settings',
        icon: Settings,
        permission: 'settings.read',
      },
      {
        label: 'Users',
        href: '/users',
        icon: Users,
        permission: 'users.read',
      },
      {
        label: 'Activity',
        href: '/activity',
        icon: Activity,
        permission: 'activity.read',
      },
    ],
  },
];

/** Flattened, for the command palette and the breadcrumb. */
export function allNavItems(): NavItem[] {
  return NAVIGATION.flatMap((group) => group.items);
}
