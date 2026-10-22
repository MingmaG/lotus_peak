import 'server-only';

/**
 * Where every capability lives: domains, and the sections inside them.
 *
 * This is the map a model reads with `admin_sections` before it knows what to
 * search for, so the words here are the office's words for the work, and the
 * keywords are what somebody would actually type. A capability nothing can
 * find is one a model decides does not exist — and then it improvises with
 * the nearest tool that sounds similar, which is how an FAQ ends up written
 * into a journey's overview as prose.
 *
 * Adding a section is adding a row here. A tool cannot name a section that is
 * not in this file: `Section` is the type its `discovery.section` takes.
 */

export const DOMAINS = {
  catalogue: {
    label: 'Catalogue',
    description: 'The journeys the company sells and the dates they run.',
  },
  content: {
    label: 'Website content',
    description: 'The journal, the editorial pages, the places, and the photographs on all of them.',
  },
  desk: {
    label: 'Reservations desk',
    description: 'Enquiries from travellers and the work of answering them.',
  },
  search: {
    label: 'Search and discovery',
    description: 'How the site appears in search engines, and where old addresses lead.',
  },
  company: {
    label: 'The company',
    description: 'Who Lotus Peak is, as the website presents it.',
  },
} as const;

export type Domain = keyof typeof DOMAINS;

export interface SectionDef {
  domain: Domain;
  label: string;
  description: string;
  /** Words a person would use for this part of the panel that are not in the label. */
  keywords: string[];
}

export const SECTIONS = {
  'catalogue.journeys': {
    domain: 'catalogue',
    label: 'Journeys',
    description:
      'Each journey’s page: details, overview, day-by-day itinerary, FAQs, highlights, ' +
      'inclusions, photographs, prices, SEO, and publishing.',
    keywords: ['trip', 'tour', 'trek', 'package', 'itinerary', 'faq', 'price', 'retreat', 'festival'],
  },
  'catalogue.departures': {
    domain: 'catalogue',
    label: 'Departures',
    description: 'The dates a journey runs, their prices and the places left.',
    keywords: ['date', 'schedule', 'calendar', 'availability', 'seats', 'fixed departure'],
  },
  'content.journal': {
    domain: 'content',
    label: 'Journal',
    description: 'Articles: stories, travel guides and experiences.',
    keywords: ['blog', 'post', 'article', 'story', 'guide'],
  },
  'content.pages': {
    domain: 'content',
    label: 'Pages',
    description: 'The editorial pages — About, Contact, Travellers’ information and the rest.',
    keywords: ['about', 'contact', 'terms', 'static page', 'landing'],
  },
  'content.places': {
    domain: 'content',
    label: 'Places',
    description: 'Where we go: the valleys, and the places inside each.',
    keywords: ['destination', 'valley', 'region', 'location', 'where we go', 'dzong'],
  },
  'content.media': {
    domain: 'content',
    label: 'Media library',
    description: 'Photographs and PDFs, their descriptions, and uploading new ones.',
    keywords: ['image', 'photo', 'picture', 'alt text', 'upload', 'gallery'],
  },
  'desk.enquiries': {
    domain: 'desk',
    label: 'Enquiries',
    description: 'What travellers wrote in to ask, and who is answering them.',
    keywords: ['inquiry', 'lead', 'request', 'question', 'customer', 'traveller', 'contact form'],
  },
  'search.seo': {
    domain: 'search',
    label: 'SEO',
    description: 'An audit of meta titles, descriptions and photographs across everything published.',
    keywords: ['meta', 'search engine', 'google', 'description', 'title tag', 'noindex'],
  },
  'search.redirects': {
    domain: 'search',
    label: 'Redirects',
    description: 'Old addresses and where they now lead.',
    keywords: ['301', '302', 'url', 'moved', 'broken link'],
  },
  'company.profile': {
    domain: 'company',
    label: 'Company profile',
    description: 'The company’s name, tagline and description as the site uses them.',
    keywords: ['brand', 'about us', 'business'],
  },
} as const satisfies Record<string, SectionDef>;

export type Section = keyof typeof SECTIONS;

/**
 * The verb, from a closed list, so search can tell "publish the journal entry"
 * from "read the journal entry" without guessing from prose.
 */
export const OPERATIONS = [
  'list',
  'read',
  'check',
  'create',
  'update',
  'upload',
  'publish',
  'unpublish',
  'cancel',
  'delete',
] as const;

export type Operation = (typeof OPERATIONS)[number];

/** What a person types for each verb, so "remove" finds `delete`. */
export const OPERATION_WORDS: Record<Operation, string[]> = {
  list: ['list', 'all', 'find', 'show', 'which', 'browse'],
  read: ['read', 'get', 'view', 'open', 'show', 'detail', 'details'],
  check: ['check', 'ready', 'readiness', 'audit', 'missing', 'problems', 'why'],
  create: ['create', 'add', 'new', 'start', 'make', 'write'],
  update: ['update', 'edit', 'change', 'rewrite', 'fix', 'set', 'improve', 'rename', 'move'],
  upload: ['upload', 'add', 'import', 'attach'],
  publish: ['publish', 'live', 'go live', 'release', 'launch'],
  unpublish: ['unpublish', 'take down', 'hide', 'draft', 'withdraw'],
  cancel: ['cancel', 'call off', 'stop'],
  delete: ['delete', 'remove', 'destroy', 'erase'],
};

export function sectionDef(section: Section): SectionDef {
  return SECTIONS[section];
}
