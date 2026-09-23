'use client';

import { useMutation } from '@tanstack/react-query';
import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  Loader2,
  MapPin,
  MessageCircle,
  Music2,
  Plus,
  Save,
  Youtube,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { Field, Section } from '@/components/shared/editor-shell';
import { SortableList } from '@/components/shared/sortable-list';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiPut } from '@/lib/api-client';

/**
 * The company, once.
 *
 * This screen is the answer to "where do I change the phone number". Before
 * it, the number was in the footer note, the contact page, the enquiry email
 * template and the structured data — four copies that drifted, and the fourth
 * one nobody knew existed.
 *
 * Every field says what reads it, because the reason to keep them in one place
 * is only obvious once you can see how many places one of them appears.
 */

export interface CompanyFormValue {
  legalName: string;
  name: string;
  tagline: string;
  description: string;
  foundedYear: number | null;
  licenceNumber: string | null;
  registrationNumber: string | null;
  logo: PickedMedia | null;
  mark: PickedMedia | null;
  ogImage: PickedMedia | null;
  strapline: string;
  footerNote: string;
  footerCopyright: string;
  footerCreditLabel: string;
  footerCreditName: string;
  footerCreditUrl: string;
  footerShowLinks: boolean;
  footerShowAddress: boolean;
  footerShowContacts: boolean;
  footerShowSocials: boolean;
  journeyPlacesTitle: string;
  journeyPlacesMore: string;
  journeyCultureTitle: string;
  journeyCultureMore: string;
  journeyJournalTitle: string;
  journeyJournalMore: string;
  journeyRelatedTitle: string;
  journeyRelatedMore: string;
  replyPromise: string;
  pledgePercent: number | null;
  pledgeBeneficiary: string | null;
  pledgeNote: string | null;
  sdfPerNightUsd: number;
  siteUrl: string;
  seoTitleTemplate: string;
  seoDefaultTitle: string;
  seoDescription: string;
  address: {
    line1: string;
    line2: string | null;
    locality: string;
    region: string | null;
    postalCode: string | null;
    country: string;
    countryCode: string;
    latitude: number | null;
    longitude: number | null;
    mapUrl: string | null;
  };
  contacts: ContactRow[];
  socials: SocialRow[];
  officeHours: HoursRow[];
  announcement: {
    message: string;
    href: string | null;
    linkLabel: string | null;
    isActive: boolean;
  } | null;
  integrations: {
    googleAnalyticsId: string | null;
    googleTagManagerId: string | null;
    googleSiteVerification: string | null;
    metaPixelId: string | null;
    tripadvisorWidgetId: string | null;
  };
}

interface ContactRow {
  kind: 'PHONE' | 'MOBILE' | 'WHATSAPP' | 'EMAIL' | 'FAX';
  label: string;
  value: string;
  display: string;
  isPrimary: boolean;
  isPublic: boolean;
  prefillMessage: string | null;
}

interface SocialRow {
  platform: SocialPlatform;
  label: string;
  handle: string | null;
  url: string;
  isActive: boolean;
}

type SocialPlatform =
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'YOUTUBE'
  | 'X'
  | 'TIKTOK'
  | 'LINKEDIN'
  | 'PINTEREST'
  | 'TRIPADVISOR'
  | 'WHATSAPP'
  | 'THREADS'
  | 'OTHER';

interface HoursRow {
  dayFrom: number;
  dayTo: number;
  opens: string | null;
  closes: string | null;
  closed: boolean;
  note: string | null;
}

/**
 * The platforms, with the icon the site draws for each.
 *
 * An enum rather than a free string is what makes this table possible — and
 * what stops a typo'd "Instgram" rendering a gap in the footer where an icon
 * should be. `OTHER` carries its own label and a globe.
 */
const PLATFORMS: { value: SocialPlatform; label: string; icon: typeof Globe }[] = [
  { value: 'INSTAGRAM', label: 'Instagram', icon: Instagram },
  { value: 'FACEBOOK', label: 'Facebook', icon: Facebook },
  { value: 'YOUTUBE', label: 'YouTube', icon: Youtube },
  { value: 'X', label: 'X', icon: Globe },
  { value: 'TIKTOK', label: 'TikTok', icon: Music2 },
  { value: 'LINKEDIN', label: 'LinkedIn', icon: Linkedin },
  { value: 'PINTEREST', label: 'Pinterest', icon: Globe },
  { value: 'TRIPADVISOR', label: 'Tripadvisor', icon: Globe },
  { value: 'WHATSAPP', label: 'WhatsApp', icon: MessageCircle },
  { value: 'THREADS', label: 'Threads', icon: Globe },
  { value: 'OTHER', label: 'Somewhere else', icon: Globe },
];

/**
 * The parts of the footer the office can switch off. Each is also left out on
 * the site when it has nothing in it, so an unticked box and an empty list
 * look the same to a visitor.
 */
const FOOTER_PARTS: {
  key: 'footerShowLinks' | 'footerShowAddress' | 'footerShowContacts' | 'footerShowSocials';
  label: string;
  hint: string;
}[] = [
  {
    key: 'footerShowLinks',
    label: 'Link columns',
    hint: 'The three footer menus. Their links are edited under Navigation.',
  },
  { key: 'footerShowAddress', label: 'Address', hint: 'From “Where the office is”.' },
  {
    key: 'footerShowContacts',
    label: 'Telephone and email',
    hint: 'The public ways to reach us, from “Getting in touch”.',
  },
  { key: 'footerShowSocials', label: 'Social icons', hint: 'The active accounts on “Social”.' },
];

/** The four bands at the foot of a journey page, and where each one's link goes. */
const JOURNEY_BANDS: {
  label: string;
  href: string;
  title: 'journeyPlacesTitle' | 'journeyCultureTitle' | 'journeyJournalTitle' | 'journeyRelatedTitle';
  more: 'journeyPlacesMore' | 'journeyCultureMore' | 'journeyJournalMore' | 'journeyRelatedMore';
}[] = [
  { label: 'Places', href: '/destinations', title: 'journeyPlacesTitle', more: 'journeyPlacesMore' },
  { label: 'Culture', href: '/culture', title: 'journeyCultureTitle', more: 'journeyCultureMore' },
  { label: 'Journal', href: '/journal', title: 'journeyJournalTitle', more: 'journeyJournalMore' },
  { label: 'Other journeys', href: '/trips', title: 'journeyRelatedTitle', more: 'journeyRelatedMore' },
];

const DAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
];

const TABS = [
  { value: 'identity', label: 'The company' },
  { value: 'contact', label: 'Getting in touch' },
  { value: 'social', label: 'Social' },
  { value: 'site', label: 'On the site' },
  { value: 'integrations', label: 'Integrations' },
];

export function CompanyForm({ initial }: { initial: CompanyFormValue }) {
  const [form, setForm] = React.useState(initial);
  const [saved, setSaved] = React.useState(initial);
  const [tab, setTab] = React.useState('identity');
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const set = <K extends keyof CompanyFormValue>(key: K, value: CompanyFormValue[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      apiPut<{ company: CompanyFormValue }>('/api/company', {
        ...form,
        logoId: form.logo?.id ?? null,
        markId: form.mark?.id ?? null,
        ogImageId: form.ogImage?.id ?? null,
      }),
    onSuccess: () => {
      setErrors({});
      setSaved(form);
      toast.success('Saved. Every page on the site will pick this up.');
    },
    onError: (error: Error) => {
      if (error instanceof ApiClientError && error.fields) setErrors(error.fields);
      toast.error(error.message);
    },
  });

  return (
    <div className="pb-10">
      <div className="sticky top-14 z-20 -mx-3 mb-5 border-b bg-background/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Tabs value={tab} onValueChange={setTab} className="min-w-0 flex-1">
            <TabsList className="h-auto w-full justify-start overflow-x-auto">
              {TABS.map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="text-xs">
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            className="shrink-0"
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin sm:mr-1.5" />
            ) : (
              <Save className="size-4 sm:mr-1.5" />
            )}
            <span className="hidden sm:inline">{dirty ? 'Save' : 'Saved'}</span>
          </Button>
        </div>
      </div>

      <div className="max-w-3xl space-y-5">
        {tab === 'identity' && (
          <>
            <Section
              title="Names"
              description="The registered name goes in the terms, the structured data and the foot of an invoice. The short one is what the site calls itself."
            >
              <Field label="Registered name" error={errors.legalName}>
                <Input
                  value={form.legalName}
                  onChange={(event) => set('legalName', event.target.value)}
                />
              </Field>
              <Field label="Name the site uses" error={errors.name}>
                <Input value={form.name} onChange={(event) => set('name', event.target.value)} />
              </Field>
              <Field
                label="Tagline"
                hint="One line. Under the logo, and the `slogan` in the structured data."
              >
                <Input
                  value={form.tagline}
                  onChange={(event) => set('tagline', event.target.value)}
                />
              </Field>
              <Field
                label="Description"
                hint="A paragraph. Read by a search engine, and the first thing an assistant is given about this company."
              >
                <Textarea
                  value={form.description}
                  rows={4}
                  onChange={(event) => set('description', event.target.value)}
                />
              </Field>
            </Section>

            <Section title="Credentials" description="Shown in the footer where they are held.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Operating since">
                  <Input
                    type="number"
                    value={form.foundedYear ?? ''}
                    onChange={(event) =>
                      set('foundedYear', event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </Field>
                <Field label="Tourism Council licence">
                  <Input
                    value={form.licenceNumber ?? ''}
                    onChange={(event) => set('licenceNumber', event.target.value || null)}
                  />
                </Field>
                <Field label="Registration number">
                  <Input
                    value={form.registrationNumber ?? ''}
                    onChange={(event) => set('registrationNumber', event.target.value || null)}
                  />
                </Field>
              </div>
            </Section>

            <Section title="Marks">
              <MediaPicker
                label="Logo"
                description="The wordmark, in the header and the footer."
                value={form.logo}
                onChange={(media) => set('logo', media)}
              />
              <MediaPicker
                label="Square mark"
                description="Square, for the browser tab, the app icon, and the `logo` in the structured data — which a search engine wants square."
                value={form.mark}
                onChange={(media) => set('mark', media)}
              />
            </Section>
          </>
        )}

        {tab === 'contact' && (
          <>
            <Section
              title="Where the office is"
              description="In parts, because the footer prints one line and the structured data needs the city on its own."
            >
              <Field
                label="The line the footer prints"
                hint="“Norzin Lam, Thimphu”"
                error={errors['address.line1']}
              >
                <Input
                  value={form.address.line1}
                  onChange={(event) =>
                    set('address', { ...form.address, line1: event.target.value })
                  }
                />
              </Field>
              <Field label="Second line">
                <Input
                  value={form.address.line2 ?? ''}
                  onChange={(event) =>
                    set('address', { ...form.address, line2: event.target.value || null })
                  }
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Town or city"
                  hint="On its own. This is what a map puts a pin in."
                  error={errors['address.locality']}
                >
                  <Input
                    value={form.address.locality}
                    onChange={(event) =>
                      set('address', { ...form.address, locality: event.target.value })
                    }
                  />
                </Field>
                <Field label="Dzongkhag">
                  <Input
                    value={form.address.region ?? ''}
                    onChange={(event) =>
                      set('address', { ...form.address, region: event.target.value || null })
                    }
                  />
                </Field>
                <Field label="Postcode">
                  <Input
                    value={form.address.postalCode ?? ''}
                    onChange={(event) =>
                      set('address', { ...form.address, postalCode: event.target.value || null })
                    }
                  />
                </Field>
                <Field label="Country">
                  <Input
                    value={form.address.country}
                    onChange={(event) =>
                      set('address', { ...form.address, country: event.target.value })
                    }
                  />
                </Field>
                <Field label="Country code" hint="Two letters. BT.">
                  <Input
                    maxLength={2}
                    value={form.address.countryCode}
                    onChange={(event) =>
                      set('address', {
                        ...form.address,
                        countryCode: event.target.value.toUpperCase(),
                      })
                    }
                  />
                </Field>
              </div>

              <Field
                label="Map link"
                hint="Google Maps or a Plus Code. Rendered as the “find us” link and as `hasMap`."
              >
                <div className="flex gap-2">
                  <Input
                    value={form.address.mapUrl ?? ''}
                    onChange={(event) =>
                      set('address', { ...form.address, mapUrl: event.target.value || null })
                    }
                  />
                  {form.address.mapUrl && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={form.address.mapUrl} target="_blank" rel="noreferrer">
                        <MapPin className="size-4" />
                        <span className="sr-only">Open the map</span>
                      </a>
                    </Button>
                  )}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Latitude"
                  hint="Optional, and worth adding: it is what puts the company on a map result."
                >
                  <Input
                    type="number"
                    step="any"
                    value={form.address.latitude ?? ''}
                    onChange={(event) =>
                      set('address', {
                        ...form.address,
                        latitude: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </Field>
                <Field label="Longitude">
                  <Input
                    type="number"
                    step="any"
                    value={form.address.longitude ?? ''}
                    onChange={(event) =>
                      set('address', {
                        ...form.address,
                        longitude: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Ways to reach us"
              description="Each of these appears in the footer, on the contact page, in the enquiry emails and in the structured data. Change one here and it changes everywhere."
            >
              <SortableList
                items={form.contacts}
                itemKey={(_, index) => `contact-${index}`}
                onChange={(contacts) => set('contacts', contacts)}
                onRemove={(index) =>
                  set('contacts', form.contacts.filter((_, i) => i !== index))
                }
                onAdd={() =>
                  set('contacts', [
                    ...form.contacts,
                    {
                      kind: 'MOBILE',
                      label: 'Telephone',
                      value: '',
                      display: '',
                      isPrimary: false,
                      isPublic: true,
                      prefillMessage: null,
                    },
                  ])
                }
                addLabel="Add a way to reach us"
                empty="No contact details. The footer and the contact page will be empty."
                describeItem={(contact) => contact.label || contact.kind}
                renderItem={(contact, index) => {
                  const patch = (value: Partial<ContactRow>) => {
                    const next = [...form.contacts];
                    next[index] = { ...contact, ...value };
                    set('contacts', next);
                  };
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Select
                          value={contact.kind}
                          onValueChange={(value) => patch({ kind: value as ContactRow['kind'] })}
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PHONE">Landline</SelectItem>
                            <SelectItem value="MOBILE">Mobile</SelectItem>
                            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                            <SelectItem value="EMAIL">Email</SelectItem>
                            <SelectItem value="FAX">Fax</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          value={contact.label}
                          placeholder="Label"
                          onChange={(event) => patch({ label: event.target.value })}
                          className="h-8 w-32 text-xs"
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field
                          label={contact.kind === 'EMAIL' ? 'Address' : 'Number to dial'}
                          hint={
                            contact.kind === 'EMAIL'
                              ? undefined
                              : 'Digits only, with an optional +. This is what a tap dials.'
                          }
                          error={errors[`contacts.${index}.value`]}
                        >
                          <Input
                            value={contact.value}
                            placeholder={contact.kind === 'EMAIL' ? 'info@lotuspeak.org' : '+97517984485'}
                            onChange={(event) => patch({ value: event.target.value })}
                            className="h-8 text-xs"
                          />
                        </Field>

                        <Field
                          label="As it is printed"
                          hint="With the spaces. This is what a reader sees."
                        >
                          <Input
                            value={contact.display}
                            placeholder={contact.kind === 'EMAIL' ? 'info@lotuspeak.org' : '+975 17984485'}
                            onChange={(event) => patch({ display: event.target.value })}
                            className="h-8 text-xs"
                          />
                        </Field>
                      </div>

                      {contact.kind === 'WHATSAPP' && (
                        <Field
                          label="Opening message"
                          hint="Filled in for them when they tap the WhatsApp link."
                        >
                          <Input
                            value={contact.prefillMessage ?? ''}
                            onChange={(event) =>
                              patch({ prefillMessage: event.target.value || null })
                            }
                            className="h-8 text-xs"
                          />
                        </Field>
                      )}

                      <div className="flex flex-wrap gap-4 text-xs">
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={contact.isPrimary}
                            onCheckedChange={(checked) => patch({ isPrimary: checked === true })}
                          />
                          Main one of its kind
                        </label>
                        <label className="flex items-center gap-2">
                          <Checkbox
                            checked={contact.isPublic}
                            onCheckedChange={(checked) => patch({ isPublic: checked === true })}
                          />
                          Show it on the site
                        </label>
                      </div>
                    </div>
                  );
                }}
              />
            </Section>

            <Section
              title="When somebody may expect an answer"
              description="Shown beside the contact details, and published as opening hours in the structured data."
            >
              <SortableList
                items={form.officeHours}
                itemKey={(_, index) => `hours-${index}`}
                onChange={(officeHours) => set('officeHours', officeHours)}
                onRemove={(index) =>
                  set('officeHours', form.officeHours.filter((_, i) => i !== index))
                }
                onAdd={() =>
                  set('officeHours', [
                    ...form.officeHours,
                    { dayFrom: 1, dayTo: 5, opens: '09:00', closes: '17:00', closed: false, note: null },
                  ])
                }
                addLabel="Add a row"
                empty="No hours given."
                describeItem={(row) => `${DAYS[row.dayFrom - 1]?.label} to ${DAYS[row.dayTo - 1]?.label}`}
                renderItem={(row, index) => {
                  const patch = (value: Partial<HoursRow>) => {
                    const next = [...form.officeHours];
                    next[index] = { ...row, ...value };
                    set('officeHours', next);
                  };
                  return (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Select
                        value={String(row.dayFrom)}
                        onValueChange={(value) => patch({ dayFrom: Number(value) })}
                      >
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DAYS.map((day) => (
                            <SelectItem key={day.value} value={String(day.value)}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground">to</span>
                      <Select
                        value={String(row.dayTo)}
                        onValueChange={(value) => patch({ dayTo: Number(value) })}
                      >
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DAYS.map((day) => (
                            <SelectItem key={day.value} value={String(day.value)}>
                              {day.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {!row.closed && (
                        <>
                          <Input
                            type="time"
                            value={row.opens ?? ''}
                            onChange={(event) => patch({ opens: event.target.value })}
                            className="h-8 w-28"
                          />
                          <span className="text-muted-foreground">–</span>
                          <Input
                            type="time"
                            value={row.closes ?? ''}
                            onChange={(event) => patch({ closes: event.target.value })}
                            className="h-8 w-28"
                          />
                        </>
                      )}

                      <label className="flex items-center gap-2">
                        <Checkbox
                          checked={row.closed}
                          onCheckedChange={(checked) => patch({ closed: checked === true })}
                        />
                        Closed
                      </label>
                    </div>
                  );
                }}
              />
            </Section>
          </>
        )}

        {tab === 'social' && (
          <Section
            title="Where else the company is"
            description="These are the footer icons, and they are the single most load-bearing thing for being recognised as one organisation: they are how a search engine decides the Instagram account, the Facebook page and this domain are the same company rather than three."
          >
            <SortableList
              items={form.socials}
              itemKey={(_, index) => `social-${index}`}
              onChange={(socials) => set('socials', socials)}
              onRemove={(index) => set('socials', form.socials.filter((_, i) => i !== index))}
              onAdd={() =>
                set('socials', [
                  ...form.socials,
                  { platform: 'INSTAGRAM', label: 'Instagram', handle: null, url: '', isActive: true },
                ])
              }
              addLabel="Add an account"
              empty="No accounts. The footer shows no icons, and nothing tells a search engine this company is anywhere else."
              describeItem={(social) => social.label || social.platform}
              renderItem={(social, index) => {
                const patch = (value: Partial<SocialRow>) => {
                  const next = [...form.socials];
                  next[index] = { ...social, ...value };
                  set('socials', next);
                };
                const Icon =
                  PLATFORMS.find((item) => item.value === social.platform)?.icon ?? Globe;
                return (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <Select
                        value={social.platform}
                        onValueChange={(value) => {
                          const platform = value as SocialPlatform;
                          patch({
                            platform,
                            /* The label follows the platform unless somebody
                               has already written their own. */
                            label:
                              social.label &&
                              !PLATFORMS.some((item) => item.label === social.label)
                                ? social.label
                                : (PLATFORMS.find((item) => item.value === platform)?.label ?? ''),
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((platform) => (
                            <SelectItem key={platform.value} value={platform.value}>
                              {platform.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        value={social.handle ?? ''}
                        placeholder="@lotuspeak"
                        onChange={(event) => patch({ handle: event.target.value || null })}
                        className="h-8 w-36 text-xs"
                        aria-label="Handle"
                      />

                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={social.isActive}
                          onCheckedChange={(checked) => patch({ isActive: checked === true })}
                        />
                        Show it
                      </label>
                    </div>

                    <Input
                      value={social.url}
                      placeholder="https://instagram.com/lotuspeak"
                      onChange={(event) => patch({ url: event.target.value })}
                      className="h-8 text-xs"
                      aria-label="Address"
                    />

                    {social.platform === 'OTHER' && (
                      <Input
                        value={social.label}
                        placeholder="What to call it"
                        onChange={(event) => patch({ label: event.target.value })}
                        className="h-8 text-xs"
                        aria-label="Name"
                      />
                    )}

                    {errors[`socials.${index}.url`] && (
                      <p className="text-xs text-destructive">{errors[`socials.${index}.url`]}</p>
                    )}
                  </div>
                );
              }}
            />
          </Section>
        )}

        {tab === 'site' && (
          <>
            <Section
              title="The footer"
              description="The foot of every page. The address, the telephone numbers and the icons are the ones on the other tabs — they are not typed again here."
            >
              <Field
                label="Short introduction"
                hint="A sentence or two under the name. Left empty, the tagline is used."
              >
                <Textarea
                  rows={2}
                  value={form.footerNote}
                  onChange={(event) => set('footerNote', event.target.value)}
                />
              </Field>

              <Field label="What the footer shows">
                <div className="grid gap-2 sm:grid-cols-2">
                  {FOOTER_PARTS.map((part) => (
                    <label key={part.key} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={form[part.key]}
                        onCheckedChange={(checked) => set(part.key, checked === true)}
                      />
                      <span>
                        {part.label}
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {part.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>

              <Field
                label="Copyright line"
                hint="On the left of the bottom row. {year} is this year and {name} is the company's name, so nobody has to remember January."
              >
                <Input
                  value={form.footerCopyright}
                  onChange={(event) => set('footerCopyright', event.target.value)}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Credit" hint="On the right of the bottom row.">
                  <Input
                    value={form.footerCreditLabel}
                    placeholder="Website by"
                    onChange={(event) => set('footerCreditLabel', event.target.value)}
                  />
                </Field>
                <Field label="Credited to" hint="Leave empty to show no credit.">
                  <Input
                    value={form.footerCreditName}
                    onChange={(event) => set('footerCreditName', event.target.value)}
                  />
                </Field>
                <Field label="Their website" error={errors.footerCreditUrl}>
                  <Input
                    value={form.footerCreditUrl}
                    placeholder="https://"
                    onChange={(event) => set('footerCreditUrl', event.target.value)}
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="At the foot of a journey"
              description="Every journey page ends with up to four bands. Each has a heading, and a link under it to the whole section. Leave a link's words empty to show no link. Which bands a journey shows is chosen on the journey itself."
            >
              {JOURNEY_BANDS.map((band) => (
                <div key={band.title} className="grid gap-4 sm:grid-cols-2">
                  <Field label={`${band.label}: heading`}>
                    <Input
                      value={form[band.title]}
                      onChange={(event) => set(band.title, event.target.value)}
                    />
                  </Field>
                  <Field label={`${band.label}: link`} hint={`Goes to ${band.href}.`}>
                    <Input
                      value={form[band.more]}
                      onChange={(event) => set(band.more, event.target.value)}
                    />
                  </Field>
                </div>
              ))}
            </Section>

            <Section title="What the site promises">
              <Field
                label="Reply promise"
                hint="Beside the enquiry form, and in the acknowledgement email. “Personally, within two days.”"
              >
                <Input
                  value={form.replyPromise}
                  onChange={(event) => set('replyPromise', event.target.value)}
                />
              </Field>

              <Field
                label="Sustainable Development Fee, US$ per person per night"
                hint="Included in every price, and stated in the structured data on every journey."
              >
                <Input
                  type="number"
                  value={form.sdfPerNightUsd}
                  onChange={(event) => set('sdfPerNightUsd', Number(event.target.value))}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pledge, %">
                  <Input
                    type="number"
                    value={form.pledgePercent ?? ''}
                    onChange={(event) =>
                      set('pledgePercent', event.target.value ? Number(event.target.value) : null)
                    }
                  />
                </Field>
                <Field label="Who it supports">
                  <Input
                    value={form.pledgeBeneficiary ?? ''}
                    onChange={(event) => set('pledgeBeneficiary', event.target.value || null)}
                  />
                </Field>
              </div>
            </Section>

            <Section
              title="Default SEO"
              description="What a page says when it has nothing of its own."
            >
              <Field label="Site address" hint="Absolute, no trailing slash. Every canonical is built from it." error={errors.siteUrl}>
                <Input
                  value={form.siteUrl}
                  onChange={(event) => set('siteUrl', event.target.value)}
                />
              </Field>
              <Field label="Title template" hint="%s is the page's own title.">
                <Input
                  value={form.seoTitleTemplate}
                  onChange={(event) => set('seoTitleTemplate', event.target.value)}
                />
              </Field>
              <Field label="Home page title" hint="Used on its own, so the template does not double the name up.">
                <Input
                  value={form.seoDefaultTitle}
                  onChange={(event) => set('seoDefaultTitle', event.target.value)}
                />
              </Field>
              <Field label="Default description">
                <Textarea
                  value={form.seoDescription}
                  rows={3}
                  onChange={(event) => set('seoDescription', event.target.value)}
                />
              </Field>
              <MediaPicker
                label="Default shared photograph"
                description="Used when a page has none of its own."
                value={form.ogImage}
                onChange={(media) => set('ogImage', media)}
              />
            </Section>

            <Section
              title="Announcement"
              description="A bar across the top of every page. Leave it switched off when there is nothing to say."
            >
              <Field label="Message">
                <Input
                  value={form.announcement?.message ?? ''}
                  onChange={(event) =>
                    set('announcement', {
                      message: event.target.value,
                      href: form.announcement?.href ?? null,
                      linkLabel: form.announcement?.linkLabel ?? null,
                      isActive: form.announcement?.isActive ?? false,
                    })
                  }
                />
              </Field>
              {form.announcement && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Link">
                      <Input
                        value={form.announcement.href ?? ''}
                        onChange={(event) =>
                          set('announcement', {
                            ...form.announcement!,
                            href: event.target.value || null,
                          })
                        }
                      />
                    </Field>
                    <Field label="Link text">
                      <Input
                        value={form.announcement.linkLabel ?? ''}
                        onChange={(event) =>
                          set('announcement', {
                            ...form.announcement!,
                            linkLabel: event.target.value || null,
                          })
                        }
                      />
                    </Field>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.announcement.isActive}
                      onCheckedChange={(checked) =>
                        set('announcement', {
                          ...form.announcement!,
                          isActive: checked === true,
                        })
                      }
                    />
                    Show it on the site
                  </label>
                </>
              )}
            </Section>
          </>
        )}

        {tab === 'integrations' && (
          <Section
            title="Third parties"
            description="Left empty, none of these scripts is loaded at all — which is both faster and one fewer thing collecting data about visitors."
          >
            <Field label="Google Analytics" hint="G-XXXXXXXXXX">
              <Input
                value={form.integrations.googleAnalyticsId ?? ''}
                onChange={(event) =>
                  set('integrations', {
                    ...form.integrations,
                    googleAnalyticsId: event.target.value || null,
                  })
                }
              />
            </Field>
            <Field label="Google Tag Manager" hint="GTM-XXXXXXX">
              <Input
                value={form.integrations.googleTagManagerId ?? ''}
                onChange={(event) =>
                  set('integrations', {
                    ...form.integrations,
                    googleTagManagerId: event.target.value || null,
                  })
                }
              />
            </Field>
            <Field
              label="Google Search Console verification"
              hint="The content of the meta tag they give you, not the whole tag."
            >
              <Input
                value={form.integrations.googleSiteVerification ?? ''}
                onChange={(event) =>
                  set('integrations', {
                    ...form.integrations,
                    googleSiteVerification: event.target.value || null,
                  })
                }
              />
            </Field>
            <Field label="Meta pixel">
              <Input
                value={form.integrations.metaPixelId ?? ''}
                onChange={(event) =>
                  set('integrations', {
                    ...form.integrations,
                    metaPixelId: event.target.value || null,
                  })
                }
              />
            </Field>
            <Field label="Tripadvisor widget">
              <Input
                value={form.integrations.tripadvisorWidgetId ?? ''}
                onChange={(event) =>
                  set('integrations', {
                    ...form.integrations,
                    tripadvisorWidgetId: event.target.value || null,
                  })
                }
              />
            </Field>
          </Section>
        )}
      </div>
    </div>
  );
}

export { Plus };
