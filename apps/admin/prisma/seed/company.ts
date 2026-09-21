import { DEFAULT_TEMPLATES } from '@lotuspeak/email';

import { db } from '@/lib/db';

/**
 * The company, its contact details, and the words its emails are made of.
 *
 * Everything here was a literal in `apps/web/src/content/data/site.ts` or in a
 * page file. The telephone number `+975 17984485` appeared in three places and
 * the email address in four; after this they appear in one row each and
 * nowhere in the code.
 */

export async function seedCompany(): Promise<void> {
  await db.companyProfile.upsert({
    where: { isSingleton: true },
    create: profile(),
    /**
     * Only the fields nobody edits in the panel.
     *
     * A re-seed must not overwrite a description the office has rewritten, and
     * `create`/`update` being the same object is the commonest way a seed
     * silently reverts a day's work.
     */
    update: { legalName: 'Lotus Peak Tours & Travel' },
  });

  await seedAddress();
  await seedContacts();
  await seedSocials();
  await seedOfficeHours();
  await seedEmailTemplates();
  await seedSettings();
}

function profile() {
  return {
    isSingleton: true,
    legalName: 'Lotus Peak Tours & Travel',
    name: 'Lotus Peak',
    tagline: 'Small-group journeys in Bhutan.',
    description:
      'We are a small Bhutanese company. We share the practice of awareness in a country where it still shapes daily life — journeys led slowly, with monks and Lams, and days written in for doing nothing.',
    foundedYear: null,
    licenceNumber: null,
    registrationNumber: null,
    strapline: 'Mindful journeys in Bhutan',
    footerNote: 'Lotus Peak Tours & Travel · Thimphu, Bhutan',
    footerCopyright: '© {year} {name}',
    replyPromise: 'Personally, within two days',
    pledgePercent: 30,
    pledgeBeneficiary: 'Osel Ling Perila Goenpa',
    pledgeNote:
      'Thirty percent of our income supports Osel Ling Perila Goenpa, a monastery in the hills.',
    sdfPerNightUsd: 100,
    siteUrl: process.env.SITE_URL || 'https://lotuspeak.org',
    seoTitleTemplate: '%s · Lotus Peak',
    seoDefaultTitle: 'Lotus Peak',
    seoDescription:
      'Mindful journeys through Bhutan, led slowly, with monks and Lams, and days written in for doing nothing.',
  };
}

/**
 * The office address.
 *
 * `line1` and `locality` are separate because the footer prints one line and
 * `addressLocality` in the structured data needs the city on its own. The
 * street, the postcode and the coordinates are left blank rather than invented:
 * the WordPress site never published them, and a plausible-looking wrong
 * address in the structured data puts the company on the wrong pin in Maps.
 * The Company screen asks for them.
 */
async function seedAddress(): Promise<void> {
  if ((await db.address.count()) > 0) return;
  await db.address.create({
    data: {
      label: 'Office',
      line1: 'Thimphu',
      line2: null,
      locality: 'Thimphu',
      region: 'Thimphu Dzongkhag',
      postalCode: null,
      country: 'Bhutan',
      countryCode: 'BT',
      latitude: null,
      longitude: null,
      mapUrl: null,
      isPrimary: true,
    },
  });
}

async function seedContacts(): Promise<void> {
  if ((await db.contactChannel.count()) > 0) return;
  await db.contactChannel.createMany({
    data: [
      {
        kind: 'MOBILE',
        label: 'Telephone',
        /* The machine form, for `tel:`. */
        value: '+97517984485',
        /* What a person reads. */
        display: '+975 17984485',
        isPrimary: true,
        sortOrder: 1,
      },
      {
        kind: 'WHATSAPP',
        label: 'WhatsApp',
        value: '97517984485',
        display: '+975 17984485',
        prefillMessage: 'Hello — I am writing about a journey with Lotus Peak.',
        isPrimary: false,
        sortOrder: 2,
      },
      {
        kind: 'EMAIL',
        label: 'Email',
        value: 'info@lotuspeak.org',
        display: 'info@lotuspeak.org',
        isPrimary: true,
        sortOrder: 3,
      },
    ],
  });
}

/**
 * Social accounts.
 *
 * Seeded empty on purpose. The WordPress theme linked to a Facebook page and
 * an Instagram account, but those URLs are not verifiable from the export, and
 * a `sameAs` in the structured data pointing at the wrong account tells a
 * search engine that somebody else's page is this company's. The Company
 * screen has a row-adder with the platform as a dropdown.
 */
async function seedSocials(): Promise<void> {
  /* Intentionally nothing. See above. */
}

async function seedOfficeHours(): Promise<void> {
  if ((await db.officeHours.count()) > 0) return;
  await db.officeHours.createMany({
    data: [
      { dayFrom: 1, dayTo: 5, opens: '09:00', closes: '17:00', closed: false, sortOrder: 1 },
      { dayFrom: 6, dayTo: 6, opens: '09:00', closes: '13:00', closed: false, sortOrder: 2 },
      { dayFrom: 7, dayTo: 7, opens: null, closes: null, closed: true, sortOrder: 3 },
    ],
  });
}

async function seedEmailTemplates(): Promise<void> {
  for (const template of DEFAULT_TEMPLATES) {
    await db.emailTemplate.upsert({
      where: { kind: template.kind },
      create: {
        kind: template.kind,
        name: template.name,
        isActive: template.isActive,
        subject: template.subject,
        preheader: template.preheader,
        eyebrow: template.eyebrow,
        heading: template.heading,
        intro: template.intro,
        closing: template.closing,
        summaryLabel: template.summaryLabel,
        notesLabel: template.notesLabel,
        buttonLabel: template.buttonLabel,
        buttonUrl: template.buttonUrl,
        signOff: template.signOff,
        footNote: template.footNote,
      },
      /* Only the name. The words are the office's the moment they open the
         screen, and a re-seed must not take them back. */
      update: { name: template.name },
    });
  }
}

/**
 * Settings that are genuinely settings.
 *
 * Analytics ids, integration keys and switches — the things where adding one
 * should not be a migration. The company's own details are columns, not keys
 * here, because the footer reads them on every page and a typo in a key name
 * is a silently empty footer.
 */
async function seedSettings(): Promise<void> {
  const defaults: [group: string, key: string, value: unknown, secret?: boolean][] = [
    ['integrations', 'googleAnalyticsId', null],
    ['integrations', 'googleTagManagerId', null],
    ['integrations', 'googleSiteVerification', null],
    ['integrations', 'metaPixelId', null],
    ['integrations', 'tripadvisorWidgetId', null],
    ['enquiries', 'notifyOffice', true],
    ['enquiries', 'acknowledgeTraveller', true],
    /**
     * The rate limit on the public enquiry endpoint.
     *
     * A setting rather than a constant because the right number is different
     * on the day a festival departure is announced, and the office should not
     * need a deploy to raise it.
     */
    ['enquiries', 'maxPerHourPerIp', 5],
    ['discovery', 'llmsTxtEnabled', true],
    ['discovery', 'llmsFullEnabled', true],
    ['discovery', 'feedEnabled', true],
  ];

  for (const [group, key, value, isSecret] of defaults) {
    await db.setting.upsert({
      where: { group_key: { group, key } },
      create: { group, key, value: value as never, isSecret: isSecret ?? false },
      update: {},
    });
  }
}
