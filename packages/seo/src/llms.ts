import type {
  ApiCultureArticle,
  ApiCultureSummary,
  ApiDestination,
  ApiDestinationSummary,
  ApiPage,
  ApiPost,
  ApiSite,
  ApiTrip,
  ApiTripSummary,
} from '@lotuspeak/api-contracts';

import { richTextToMarkdown } from './rich-text-markdown';

/**
 * `/llms.txt` and `/llms-full.txt`.
 *
 * A generative engine reads differently from a crawler. A crawler wants the
 * markup around the facts; a model wants the facts, in order, without the
 * chrome — and what it gets instead from a rendered page is a navigation, a
 * cookie notice, a footer with three columns of links, and the same company
 * address on every one of forty pages, all of which it has to spend context
 * discarding before it reaches the itinerary.
 *
 * `llms.txt` is the site in one screen: what the company is, and every page
 * worth reading, as links. `llms-full.txt` is the whole publication as clean
 * markdown, so a model that follows the first can get everything in one more
 * request rather than forty.
 *
 * Both are **generated from published rows**, never hand-written. A
 * hand-written one is a file that is correct on the day it is written and
 * lies about the catalogue three departures later.
 */

const rule = '\n---\n\n';

function abs(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Strips the restricted inline HTML a `text` block may carry.
 *
 * The block union allows bold, italic and links inside prose. Markdown would
 * be the obvious conversion, but a link whose text is the URL reads worse to a
 * model than the sentence without it, and the URL is already in the index
 * above. So: keep the words, drop the tags.
 */
function plain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export interface LlmsInput {
  siteUrl: string;
  site: ApiSite;
  trips: ApiTripSummary[];
  posts: { slug: string; title: string; standfirst: string }[];
  /** Valleys and places together; a place is listed under its valley. */
  destinations: Pick<ApiDestinationSummary, 'slug' | 'name' | 'blurb' | 'path' | 'parentSlug'>[];
  culture: Pick<ApiCultureSummary, 'title' | 'path' | 'standfirst'>[];
  pages: Pick<ApiPage, 'path' | 'title' | 'lead'>[];
}

/**
 * The index.
 *
 * Deliberately short. Its job is to be read whole and to tell a model what
 * exists and where; everything that needs a paragraph is behind a link.
 */
export function buildLlmsTxt(input: LlmsInput): string {
  const { siteUrl, site } = input;
  const c = site.company;
  const out: string[] = [];

  out.push(`# ${c.name}`);
  out.push('');
  out.push(`> ${c.tagline}`);
  out.push('');
  out.push(c.description);
  out.push('');

  /* The facts a model would otherwise have to infer from the prose. */
  out.push('## About');
  out.push('');
  out.push(`- **Company**: ${c.legalName}`);
  out.push(
    `- **Based in**: ${[c.address.line1, c.address.locality, c.address.country]
      .filter(Boolean)
      .join(', ')}`,
  );
  if (c.foundedYear) out.push(`- **Operating since**: ${c.foundedYear}`);
  if (c.licenceNumber) {
    out.push(`- **Tourism Council of Bhutan licence**: ${c.licenceNumber}`);
  }
  for (const contact of c.contacts.filter((x) => x.isPrimary)) {
    out.push(`- **${contact.label}**: ${contact.display}`);
  }
  out.push(
    `- **Sustainable Development Fee**: US$${site.sdfPerNightUsd} per person per night, included in every price`,
  );
  if (site.pledge) {
    out.push(
      `- **Pledge**: ${site.pledge.percent}% of income supports ${site.pledge.beneficiary}`,
    );
  }
  out.push('');

  out.push('## Journeys');
  out.push('');
  for (const trip of input.trips) {
    out.push(
      `- [${trip.title}](${abs(siteUrl, `/trips/${trip.slug}`)}): ${trip.excerpt} ` +
        `${trip.durationDays} days, ${trip.difficulty.toLowerCase()}, ` +
        `highest point ${trip.highPointMetres} m, from US$${trip.priceFromUsd}. ` +
        `Best ${trip.seasonLabel.toLowerCase()}. Regions: ${trip.regions.join(', ')}.`,
    );
  }
  out.push('');

  out.push('## Where we go');
  out.push('');
  for (const valley of input.destinations.filter((d) => !d.parentSlug)) {
    out.push(`- [${valley.name}](${abs(siteUrl, valley.path)}): ${valley.blurb}`);
    for (const place of input.destinations.filter((d) => d.parentSlug === valley.slug)) {
      out.push(`  - [${place.name}](${abs(siteUrl, place.path)}): ${place.blurb}`);
    }
  }
  out.push('');

  out.push('## Culture');
  out.push('');
  for (const article of input.culture) {
    out.push(`- [${article.title}](${abs(siteUrl, article.path)}): ${article.standfirst}`);
  }
  out.push('');

  out.push('## Journal');
  out.push('');
  for (const post of input.posts) {
    out.push(
      `- [${post.title}](${abs(siteUrl, `/journal/${post.slug}`)}): ${post.standfirst}`,
    );
  }
  out.push('');

  out.push('## Practical');
  out.push('');
  for (const page of input.pages) {
    out.push(
      `- [${page.title}](${abs(siteUrl, page.path)})${page.lead ? `: ${page.lead}` : ''}`,
    );
  }
  out.push('');

  out.push('## Optional');
  out.push('');
  out.push(`- [Everything, as one file](${abs(siteUrl, '/llms-full.txt')})`);
  out.push(`- [Sitemap](${abs(siteUrl, '/sitemap.xml')})`);
  out.push(`- [Journal feed](${abs(siteUrl, '/feed.xml')})`);
  out.push('');

  return out.join('\n');
}

export interface LlmsFullInput {
  siteUrl: string;
  site: ApiSite;
  trips: ApiTrip[];
  posts: ApiPost[];
  destinations: ApiDestination[];
  culture: ApiCultureArticle[];
}

/** Every journey and every journal entry, as markdown, in one file. */
export function buildLlmsFullTxt(input: LlmsFullInput): string {
  const { siteUrl, site } = input;
  const out: string[] = [];

  out.push(`# ${site.company.name} — full content`);
  out.push('');
  out.push(
    `> Generated from the published content of ${siteUrl}. ` +
      `Prices are in US dollars and include the Sustainable Development Fee of ` +
      `US$${site.sdfPerNightUsd} per person per night.`,
  );
  out.push('');

  out.push(rule);
  out.push('# Journeys');
  out.push('');

  for (const trip of input.trips) {
    out.push(`## ${trip.title}`);
    out.push('');
    out.push(`${abs(siteUrl, `/trips/${trip.slug}`)}`);
    out.push('');
    out.push(trip.excerpt);
    out.push('');

    /* A definition list, because a fact in a table is a fact a model can lift
       and a fact in a sentence is a fact it has to infer. */
    out.push('| | |');
    out.push('|---|---|');
    out.push(`| Length | ${trip.durationDays} days, ${trip.nights} nights |`);
    out.push(`| Highest point | ${trip.highPointMetres} m |`);
    out.push(`| Difficulty | ${trip.difficulty} |`);
    out.push(`| From | US$${trip.priceFromUsd} per person |`);
    out.push(`| Best season | ${trip.seasonLabel} |`);
    out.push(`| Regions | ${trip.regions.join(', ')} |`);
    out.push(`| Pace | ${trip.paceNote} |`);
    out.push('');

    if (trip.overview.length > 0) {
      out.push('### Overview');
      out.push('');
      for (const paragraph of trip.overview) out.push(`${plain(paragraph)}\n`);
    }

    if (trip.highlights.length > 0) {
      out.push('### Highlights');
      out.push('');
      for (const item of trip.highlights) out.push(`- ${plain(item)}`);
      out.push('');
    }

    if (trip.itinerary.length > 0) {
      out.push('### Itinerary');
      out.push('');
      for (const day of trip.itinerary) {
        const label = day.rest ? 'Rest day' : `Day ${day.day}`;
        out.push(`**${label} — ${day.title}**${day.meta ? ` (${day.meta})` : ''}`);
        out.push('');
        if (day.body) out.push(`${plain(day.body)}\n`);
      }
    }

    if (trip.included.length > 0) {
      out.push('### What is included');
      out.push('');
      for (const item of trip.included) out.push(`- ${plain(item)}`);
      out.push('');
    }

    if (trip.excluded.length > 0) {
      out.push('### What is not included');
      out.push('');
      for (const item of trip.excluded) out.push(`- ${plain(item)}`);
      out.push('');
    }

    if (trip.faq.length > 0) {
      out.push('### Questions');
      out.push('');
      for (const faq of trip.faq) {
        out.push(`**${faq.question}**`);
        out.push('');
        out.push(`${plain(faq.answer)}\n`);
      }
    }

    out.push(rule);
  }

  out.push('# Where we go');
  out.push('');
  for (const destination of input.destinations) {
    out.push(`## ${destination.parent ? `${destination.name}, ${destination.parent.title}` : destination.name}`);
    out.push('');
    out.push(abs(siteUrl, destination.path));
    out.push('');
    out.push(plain(destination.standfirst || destination.blurb));
    out.push('');
    if (destination.body) {
      out.push(richTextToMarkdown(destination.body));
      out.push('');
    }
  }

  out.push(rule);
  out.push('# Culture and traditions');
  out.push('');
  for (const article of input.culture) {
    out.push(`## ${article.title}`);
    out.push('');
    out.push(abs(siteUrl, article.path));
    out.push('');
    out.push(plain(article.standfirst));
    out.push('');
    if (article.body) {
      out.push(richTextToMarkdown(article.body));
      out.push('');
    }
  }

  out.push(rule);
  out.push('# Journal');
  out.push('');
  for (const post of input.posts) {
    out.push(`## ${post.title}`);
    out.push('');
    out.push(`${abs(siteUrl, `/journal/${post.slug}`)} — ${post.date.slice(0, 10)}`);
    out.push('');
    out.push(plain(post.standfirst));
    out.push('');
    /* Markdown rather than flattened prose: an entry's headings, lists and
       tables are the structure a model needs, and this is the one field long
       enough for losing it to matter. See `./rich-text-markdown.ts`. */
    out.push(richTextToMarkdown(post.body));
    out.push('');
  }

  return out.join('\n');
}

