import 'server-only';

import { db } from '@/lib/db';
import { toPicked } from './trip-form';
import type { CompanyInput } from '@/server/validators/company';
import type { PickedMedia } from '@/components/media/media-picker';

/**
 * Reading and writing the company record.
 *
 * The write is one transaction that replaces the three lists whole —
 * contacts, socials, office hours. They are small, ordered, and edited as a
 * set; diffing them would be more code to express the same result and would
 * get the order wrong on a reorder.
 */

export interface CompanyForm extends Omit<CompanyInput, 'logoId' | 'markId' | 'ogImageId'> {
  logo: PickedMedia | null;
  mark: PickedMedia | null;
  ogImage: PickedMedia | null;
}

const MEDIA = { include: { renditions: { where: { format: 'webp' as const } } } };

export async function companyForm(): Promise<CompanyForm | null> {
  const [company, address, contacts, socials, hours, announcement, settings] =
    await Promise.all([
      db.companyProfile.findFirst({
        where: { isSingleton: true },
        include: { logo: MEDIA, mark: MEDIA, ogImage: MEDIA },
      }),
      db.address.findFirst({ where: { isPrimary: true } }),
      db.contactChannel.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.socialLink.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.officeHours.findMany({ orderBy: { sortOrder: 'asc' } }),
      db.announcement.findFirst({ orderBy: { updatedAt: 'desc' } }),
      db.setting.findMany({ where: { group: 'integrations' } }),
    ]);

  if (!company) return null;

  const setting = (key: string): string | null => {
    const value = settings.find((row) => row.key === key)?.value;
    return typeof value === 'string' && value.length > 0 ? value : null;
  };

  return {
    legalName: company.legalName,
    name: company.name,
    tagline: company.tagline,
    description: company.description,
    foundedYear: company.foundedYear,
    licenceNumber: company.licenceNumber,
    registrationNumber: company.registrationNumber,
    logo: toPicked(company.logo),
    mark: toPicked(company.mark),
    ogImage: toPicked(company.ogImage),

    strapline: company.strapline,
    footerNote: company.footerNote,
    footerCopyright: company.footerCopyright,
    replyPromise: company.replyPromise,

    pledgePercent: company.pledgePercent,
    pledgeBeneficiary: company.pledgeBeneficiary,
    pledgeNote: company.pledgeNote,
    sdfPerNightUsd: company.sdfPerNightUsd,

    siteUrl: company.siteUrl,
    seoTitleTemplate: company.seoTitleTemplate,
    seoDefaultTitle: company.seoDefaultTitle,
    seoDescription: company.seoDescription,

    address: {
      line1: address?.line1 ?? '',
      line2: address?.line2 ?? null,
      locality: address?.locality ?? '',
      region: address?.region ?? null,
      postalCode: address?.postalCode ?? null,
      country: address?.country ?? 'Bhutan',
      countryCode: address?.countryCode ?? 'BT',
      latitude: address?.latitude ?? null,
      longitude: address?.longitude ?? null,
      mapUrl: address?.mapUrl ?? null,
    },

    contacts: contacts.map((row) => ({
      kind: row.kind,
      label: row.label,
      value: row.value,
      display: row.display,
      isPrimary: row.isPrimary,
      isPublic: row.isPublic,
      prefillMessage: row.prefillMessage,
    })),

    socials: socials.map((row) => ({
      platform: row.platform,
      label: row.label,
      handle: row.handle,
      url: row.url,
      isActive: row.isActive,
    })),

    officeHours: hours.map((row) => ({
      dayFrom: row.dayFrom,
      dayTo: row.dayTo,
      opens: row.opens,
      closes: row.closes,
      closed: row.closed,
      note: row.note,
    })),

    announcement: announcement
      ? {
          message: announcement.message,
          href: announcement.href,
          linkLabel: announcement.linkLabel,
          isActive: announcement.isActive,
        }
      : null,

    integrations: {
      googleAnalyticsId: setting('googleAnalyticsId'),
      googleTagManagerId: setting('googleTagManagerId'),
      googleSiteVerification: setting('googleSiteVerification'),
      metaPixelId: setting('metaPixelId'),
      tripadvisorWidgetId: setting('tripadvisorWidgetId'),
    },
  };
}

export async function saveCompany(input: CompanyInput): Promise<void> {
  await db.$transaction(async (tx) => {
    await tx.companyProfile.upsert({
      where: { isSingleton: true },
      create: { isSingleton: true, ...profileFields(input) },
      update: profileFields(input),
    });

    const address = await tx.address.findFirst({ where: { isPrimary: true } });
    const addressFields = {
      line1: input.address.line1,
      line2: input.address.line2 || null,
      locality: input.address.locality,
      region: input.address.region || null,
      postalCode: input.address.postalCode || null,
      country: input.address.country,
      countryCode: input.address.countryCode.toUpperCase(),
      latitude: input.address.latitude ?? null,
      longitude: input.address.longitude ?? null,
      mapUrl: input.address.mapUrl || null,
      isPrimary: true,
    };
    if (address) {
      await tx.address.update({ where: { id: address.id }, data: addressFields });
    } else {
      await tx.address.create({ data: addressFields });
    }

    await tx.contactChannel.deleteMany({});
    await tx.contactChannel.createMany({
      data: input.contacts.map((contact, index) => ({
        kind: contact.kind,
        label: contact.label,
        value: contact.value,
        display: contact.display,
        isPrimary: contact.isPrimary,
        isPublic: contact.isPublic,
        prefillMessage: contact.prefillMessage || null,
        sortOrder: index,
      })),
    });

    await tx.socialLink.deleteMany({});
    await tx.socialLink.createMany({
      data: input.socials.map((social, index) => ({
        platform: social.platform,
        label: social.label,
        handle: social.handle || null,
        url: social.url,
        isActive: social.isActive,
        sortOrder: index,
      })),
    });

    await tx.officeHours.deleteMany({});
    await tx.officeHours.createMany({
      data: input.officeHours.map((row, index) => ({
        dayFrom: row.dayFrom,
        dayTo: row.dayTo,
        opens: row.closed ? null : (row.opens ?? null),
        closes: row.closed ? null : (row.closes ?? null),
        closed: row.closed,
        note: row.note || null,
        sortOrder: index,
      })),
    });

    if (input.announcement) {
      const existing = await tx.announcement.findFirst({ orderBy: { updatedAt: 'desc' } });
      const fields = {
        message: input.announcement.message,
        href: input.announcement.href || null,
        linkLabel: input.announcement.linkLabel || null,
        isActive: input.announcement.isActive,
      };
      if (existing) {
        await tx.announcement.update({ where: { id: existing.id }, data: fields });
      } else {
        await tx.announcement.create({ data: fields });
      }
    }

    for (const [key, value] of Object.entries(input.integrations ?? {})) {
      await tx.setting.upsert({
        where: { group_key: { group: 'integrations', key } },
        create: { group: 'integrations', key, value: (value ?? null) as never },
        update: { value: (value ?? null) as never },
      });
    }
  });
}

function profileFields(input: CompanyInput) {
  return {
    legalName: input.legalName,
    name: input.name,
    tagline: input.tagline,
    description: input.description,
    foundedYear: input.foundedYear ?? null,
    licenceNumber: input.licenceNumber || null,
    registrationNumber: input.registrationNumber || null,
    logoId: input.logoId ?? null,
    markId: input.markId ?? null,
    strapline: input.strapline,
    footerNote: input.footerNote,
    footerCopyright: input.footerCopyright,
    replyPromise: input.replyPromise,
    pledgePercent: input.pledgePercent ?? null,
    pledgeBeneficiary: input.pledgeBeneficiary || null,
    pledgeNote: input.pledgeNote || null,
    sdfPerNightUsd: input.sdfPerNightUsd,
    siteUrl: input.siteUrl.replace(/\/$/, ''),
    seoTitleTemplate: input.seoTitleTemplate,
    seoDefaultTitle: input.seoDefaultTitle,
    seoDescription: input.seoDescription,
    ogImageId: input.ogImageId ?? null,
  };
}
