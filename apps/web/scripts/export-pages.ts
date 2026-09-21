/**
 * Exports the editorial pages — About, Contact, Terms, Travellers'
 * information, and every index route's own copy — into the shape the admin
 * panel stores them in.
 *
 *     cd apps/web && npx tsx scripts/export-pages.ts
 *
 * ## Why this is separate from `export-seed.ts`
 *
 * Because this is the harder half of the move, and it is the half that is a
 * *translation* rather than a copy. `src/content/data/` was already data; these
 * pages are TypeScript literals sitting inside React components, and turning
 * them into rows means deciding which of the design's bands is a section type
 * and which is page furniture.
 *
 * The rule applied here: **a band an editor should be able to add, remove,
 * reorder or rewrite is a section. A band that is the page's structure is
 * not.** The home page's hero is not a section — there is one, it is always
 * first, and an editor who deleted it would have made a page the design has no
 * layout for. Its three purposes *are* a section: there are three today, there
 * could be four, and the copy in them is the company describing itself.
 *
 * What that leaves out is deliberate. The trips grid, the seasons band and the
 * gallery strip on the home page are rendered from their own tables; putting
 * them in `sections` as well would be two places to change the same thing.
 * They appear as a `trips` section with no slugs, meaning "the current
 * catalogue, in its own order" — which is what the page does now.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ABOUT_PURPOSES,
  COMMITMENTS,
  HOME_PURPOSES,
  TERMS_SECTIONS,
  TRAVELLER_SECTIONS,
  type InfoBlock,
  type InfoSection,
} from '../src/content/data/pages';
import { IMG } from '../src/lib/assets';

const OUT = path.resolve(process.cwd(), '../admin/prisma/seed-data');

/* The section union, repeated here rather than imported from the contracts
   package, so this script stays runnable from inside the website with no
   workspace resolution. It is checked against the real one by the seed. */
type Section =
  | { kind: 'prose'; eyebrow: string | null; title: string | null; body: string }
  | {
      kind: 'points';
      eyebrow: string | null;
      title: string | null;
      lead: string | null;
      points: { title: string; body: string; icon: string | null }[];
    }
  | { kind: 'figure'; imageSrc: string; caption: string | null; width: 'full' | 'inset' }
  | { kind: 'faq'; title: string | null; items: { question: string; answer: string }[] }
  | { kind: 'trips'; title: string | null; lead: string | null; tripSlugs: string[] }
  | {
      kind: 'cta';
      title: string;
      lead: string | null;
      label: string;
      href: string;
      band: boolean;
    };

interface PageSeed {
  slug: string;
  path: string;
  title: string;
  eyebrow: string | null;
  lead: string | null;
  heroSrc: string | null;
  sections: Section[];
  isSystem: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  sitemapPriority: number;
}

/**
 * An `InfoSection` becomes one `prose` section.
 *
 * Its `body` is a list of paragraphs and occasional `{ list }` blocks, and it
 * becomes one HTML string — `<p>` and `<ul>` — because that is what a `prose`
 * section holds and what the restricted editor produces. The alternative,
 * a section type per paragraph, would give the office a fourteen-row drag list
 * to express one chapter of the terms.
 */
function fromInfoSection(section: InfoSection): Section {
  const html = section.body.map(blockToHtml).join('\n');
  return { kind: 'prose', eyebrow: null, title: section.title, body: html };
}

function blockToHtml(block: InfoBlock): string {
  if (typeof block === 'string') return `<p>${escape(block)}</p>`;
  return `<ul>${block.list.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`;
}

function escape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const PAGES: PageSeed[] = [
  {
    slug: 'home',
    path: '/',
    title: 'Lotus Peak',
    eyebrow: 'Our purpose',
    lead: 'We are a small Bhutanese company. We share the practice of awareness in a country where it still shapes daily life.',
    heroSrc: IMG.dzong,
    isSystem: true,
    sections: [
      {
        kind: 'points',
        eyebrow: 'Our purpose',
        title: 'Mindful journeys in Bhutan',
        lead: null,
        points: HOME_PURPOSES.map(([title, body]: [string, string]) => ({ title, body, icon: null })),
      },
      {
        kind: 'trips',
        title: 'Our journeys',
        lead: null,
        /* Empty means the current catalogue in its own order, which is what
           the page renders today. Naming slugs here would be a second place
           to decide which four journeys the home page shows. */
        tripSlugs: [],
      },
    ],
    metaTitle: 'Lotus Peak',
    metaDescription:
      'Mindful journeys through Bhutan, led slowly, with monks and Lams, and days written in for doing nothing.',
    sitemapPriority: 1,
  },
  {
    slug: 'about',
    path: '/about',
    title: 'About Lotus Peak',
    eyebrow: 'About',
    lead: 'A small Bhutanese company, sharing the practice of awareness in the country where it still shapes daily life.',
    heroSrc: IMG.courtyard,
    isSystem: false,
    sections: [
      ...ABOUT_PURPOSES.flatMap<Section>(([title, body, image]: [string, string, string]) => [
        { kind: 'figure', imageSrc: image, caption: null, width: 'inset' },
        { kind: 'prose', eyebrow: null, title, body: `<p>${escape(body)}</p>` },
      ]),
      {
        kind: 'points',
        eyebrow: 'What we hold to',
        title: 'Our commitments',
        lead: null,
        points: COMMITMENTS.map(([title, body]: [string, string]) => ({ title, body, icon: null })),
      },
      {
        kind: 'cta',
        title: 'Come and see',
        lead: 'Tell us what you are hoping for and we will write back personally.',
        label: 'Make an enquiry',
        href: '/contact',
        band: true,
      },
    ],
    metaTitle: 'About Lotus Peak',
    metaDescription:
      'A small Bhutanese company running mindfulness, meditation, festival and trekking journeys, led with Rinpoches and Lams.',
    sitemapPriority: 0.7,
  },
  {
    slug: 'contact',
    path: '/contact',
    title: 'Make an enquiry',
    eyebrow: 'Contact',
    lead: 'Tell us roughly what you are hoping for. Someone here reads every enquiry and writes back personally.',
    heroSrc: null,
    isSystem: true,
    /**
     * Almost nothing.
     *
     * The telephone number, the email address, the office hours and the reply
     * promise are all on the contact page, and none of them is a section: they
     * are the company record, rendered by the page. A `prose` section holding
     * "+975 17984485" is exactly the duplication the Company screen exists to
     * end.
     */
    sections: [],
    metaTitle: 'Contact Lotus Peak',
    metaDescription:
      'Write to us about a journey in Bhutan. We answer personally, usually within two days.',
    sitemapPriority: 0.8,
  },
  {
    slug: 'terms',
    path: '/terms',
    title: 'Terms & conditions',
    eyebrow: 'Terms',
    lead: 'The terms on which we sell and operate our journeys. The figures particular to your booking — deposit, balance date and the cancellation scale — are in the written confirmation we send you.',
    heroSrc: null,
    isSystem: false,
    sections: TERMS_SECTIONS.map(fromInfoSection),
    metaTitle: 'Terms & conditions',
    metaDescription:
      'The terms on which Lotus Peak Tours & Travel sells and operates its journeys: booking, payment, cancellation, insurance, changes to an itinerary and liability.',
    sitemapPriority: 0.3,
  },
  {
    slug: 'travellers-information',
    path: '/travellers-information',
    title: 'What to know before you come',
    eyebrow: 'Travellers',
    lead: 'Not a complete list — the things travellers ask us most. Anything specific to your journey is in the notes we send when it is booked.',
    heroSrc: null,
    isSystem: false,
    sections: TRAVELLER_SECTIONS.map(fromInfoSection),
    metaTitle: 'Travellers’ information',
    metaDescription:
      'Money, banking, electricity, photography, tipping, dress and etiquette, health and safety — the practical things to know before you travel to Bhutan.',
    sitemapPriority: 0.5,
  },

  /* ---------------------------------------------------------------------- */
  /*  Index routes                                                           */
  /* ---------------------------------------------------------------------- */
  /*
   * These render their catalogue from its own tables. What they need a row
   * for is the words around it — the eyebrow, the heading, the sentence under
   * it and the meta description — all of which are currently literals in the
   * page file and none of which the office can change.
   */
  indexPage('trips', '/trips', 'Our journeys', 'Journeys', 'Five ways to see Bhutan slowly. Every one is small, led by a Bhutanese guide, and has days in it with nothing scheduled.', 0.9),
  indexPage('destinations', '/destinations', 'Where we go', 'Bhutan', 'The valleys our journeys pass through, and what is in them.', 0.7),
  indexPage('activities', '/activities', 'What you can do', 'Activities', 'Three ways of reading the same journeys: the culture, the practice, and the walking.', 0.6),
  indexPage('culture', '/culture', 'Culture & traditions', 'Culture', 'Festivals, dzongs, textiles, the thirteen arts, and the way a country measures its own progress.', 0.6),
  indexPage('gallery', '/gallery', 'Gallery', 'Photographs', 'Bhutan, photographed on our own journeys.', 0.4),
  indexPage('journal', '/journal', 'Journal', 'Journal', 'Notes from the valleys — what we saw, and when it is worth coming to see it.', 0.7),
];

function indexPage(
  slug: string,
  routePath: string,
  title: string,
  eyebrow: string,
  lead: string,
  sitemapPriority: number,
): PageSeed {
  return {
    slug,
    path: routePath,
    title,
    eyebrow,
    lead,
    heroSrc: null,
    isSystem: true,
    sections: [],
    metaTitle: title,
    metaDescription: lead,
    sitemapPriority,
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, 'pages.json'), `${JSON.stringify(PAGES, null, 2)}\n`, 'utf8');

  for (const page of PAGES) {
    console.log(`${page.path.padEnd(28)} ${page.sections.length} section(s)`);
  }
  console.log(`\nWritten to ${OUT}/pages.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
