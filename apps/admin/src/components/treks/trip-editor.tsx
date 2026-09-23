'use client';

import { parseVideoSource, providerLabel } from '@lotuspeak/video';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Moon, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { ItineraryEditor } from './itinerary-editor';
import { TripGalleryEditor } from './trip-gallery-editor';
import { OrderedPicker, TripPageSections, type TripSectionsForm } from './trip-page-sections';
import { SeoPanel, type SeoValue } from '@/components/content/seo-panel';
import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import {
  EditorShell,
  Field,
  PublishProblems,
  Section,
} from '@/components/shared/editor-shell';
import { SortableList, StringList } from '@/components/shared/sortable-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiPatch, apiPost } from '@/lib/api-client';
import { toSlug } from '@/lib/slug';
import { cn } from '@/lib/utils';

/**
 * Writing a journey.
 *
 * Seven tabs over one form object. The whole draft is held in React and sent
 * on Save — not tab by tab — because the fields argue with each other: the
 * nights cannot exceed the days, the region line is built from the route, and
 * publishing is refused for a reason that lives on a different tab from the
 * field that causes it. Saving a tab at a time would mean each of those checks
 * running against a half-written record.
 */

export interface TripFormData {
  id: string | null;
  slug: string;
  title: string;
  excerpt: string;
  type: 'MINDFULNESS' | 'MEDITATION' | 'FESTIVAL' | 'TREKKING';
  journeyLabel: string;
  durationDays: number;
  nights: number;
  highPointMetres: number;
  difficulty: 'GENTLE' | 'MODERATE' | 'DEMANDING';
  priceFromUsd: number;
  priceCurrency: string;
  priceNote: string;
  pricingTiers: PricingTierForm[];
  seasonLabel: string;
  seasonKeys: ('SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER')[];
  paceNote: string;
  groupSizeMin: number | null;
  groupSizeMax: number | null;
  regions: string[];
  overview: string[];
  highlights: string[];
  included: string[];
  excluded: string[];
  itinerary: ItineraryDayForm[];
  faqs: FaqForm[];
  faqGroups: FaqGroupForm[];
  gallery: { mediaId: string; url: string; alt: string; ratio: string | null; width: string | null }[];
  stats: StatForm[];
  elevationProfile: ElevationPointForm[];
  videoUrl: string;
  hero: PickedMedia | null;
  routeMap: PickedMedia | null;
  ogImage: PickedMedia | null;
  destinationIds: string[];
  offeredByDestinationIds: string[];
  relatedTripIds: string[];
  cultureIds: string[];
  postIds: string[];
  sections: TripSectionsForm;
  featured: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  seo: SeoValue;
}

/** A price at a party size. `maxPeople` null means "and above". */
export interface PricingTierForm {
  key: string;
  label: string;
  minPeople: number;
  maxPeople: number | null;
  priceUsd: number;
  wasPriceUsd: number | null;
  note: string;
}

/**
 * A question, and the heading it sits under.
 *
 * `groupKey` is the heading's *title*, not a row id, because a heading created
 * in this session has no id until the save writes it. Null is a question with
 * no heading, which renders first and above the grouped ones.
 */
export interface FaqForm {
  question: string;
  answer: string;
  groupKey: string | null;
}

export interface FaqGroupForm {
  key: string;
  title: string;
  blurb: string;
}

/** One of the figures under the title, beyond the fixed five. */
export interface StatForm {
  label: string;
  value: string;
  note: string | null;
}

export interface ElevationPointForm {
  day: number;
  label: string;
  metres: number;
}

export interface ItineraryDayForm {
  key: string;
  isRest: boolean;
  title: string;
  meta: string;
  body: string;
}

export interface TripEditorProps {
  initial: TripFormData;
  destinations: { id: string; name: string }[];
  otherTrips: { id: string; title: string }[];
  culture: { id: string; title: string }[];
  posts: { id: string; title: string; published: boolean }[];
  siteUrl: string;
  canPublish: boolean;
}

const TABS = [
  { value: 'journey', label: 'Journey' },
  { value: 'itinerary', label: 'Itinerary' },
  { value: 'details', label: 'Details' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'photographs', label: 'Photographs' },
  { value: 'questions', label: 'Questions' },
  { value: 'links', label: 'Links' },
  { value: 'seo', label: 'SEO' },
];

export function TripEditor({
  initial,
  destinations,
  otherTrips,
  culture,
  posts,
  siteUrl,
  canPublish,
}: TripEditorProps) {
  const router = useRouter();
  const client = useQueryClient();

  const [form, setForm] = React.useState<TripFormData>(initial);
  const [saved, setSaved] = React.useState<TripFormData>(initial);
  const [tab, setTab] = React.useState('journey');
  const [problems, setProblems] = React.useState<Record<string, string>>({});

  const dirty = React.useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  );

  const set = React.useCallback(<K extends keyof TripFormData>(key: K, value: TripFormData[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        type: form.type,
        journeyLabel: form.journeyLabel,
        durationDays: form.durationDays,
        nights: form.nights,
        highPointMetres: form.highPointMetres,
        difficulty: form.difficulty,
        priceFromUsd: form.priceFromUsd,
        priceCurrency: form.priceCurrency || 'USD',
        priceNote: form.priceNote || null,
        pricingTiers: form.pricingTiers
          .filter((tier) => tier.label.trim())
          .map((tier) => ({
            label: tier.label,
            minPeople: tier.minPeople,
            maxPeople: tier.maxPeople,
            priceUsd: tier.priceUsd,
            wasPriceUsd: tier.wasPriceUsd,
            note: tier.note || null,
          })),
        seasonLabel: form.seasonLabel,
        seasonKeys: form.seasonKeys,
        paceNote: form.paceNote,
        groupSizeMin: form.groupSizeMin,
        groupSizeMax: form.groupSizeMax,
        regions: form.regions,
        overview: form.overview.filter((line) => line.trim()),
        highlights: form.highlights.filter((line) => line.trim()),
        included: form.included.filter((line) => line.trim()),
        excluded: form.excluded.filter((line) => line.trim()),
        itinerary: form.itinerary.map((day) => ({
          isRest: day.isRest,
          title: day.title,
          meta: day.meta || null,
          body: day.body || null,
        })),
        faqs: form.faqs.filter((faq) => faq.question.trim() && faq.answer.trim()),
        faqGroups: form.faqGroups
          .filter((group) => group.title.trim())
          .map((group) => ({
            key: group.key,
            title: group.title,
            blurb: group.blurb || null,
          })),
        gallery: form.gallery.map((item) => ({
          mediaId: item.mediaId,
          ratio: item.ratio,
          width: item.width,
        })),
        stats: form.stats.filter((stat) => stat.label.trim() && stat.value.trim()),
        elevationProfile: form.elevationProfile.filter((point) => point.label.trim()),
        videoUrl: form.videoUrl.trim() || null,
        heroId: form.hero?.id ?? null,
        routeMapId: form.routeMap?.id ?? null,
        destinationIds: form.destinationIds,
        offeredByDestinationIds: form.offeredByDestinationIds,
        relatedTripIds: form.relatedTripIds,
        cultureIds: form.cultureIds,
        postIds: form.postIds,
        showGallery: form.sections.gallery,
        showDestinations: form.sections.destinations,
        showCulture: form.sections.culture,
        showJournal: form.sections.journal,
        showRelated: form.sections.related,
        featured: form.featured,
        status: form.status,
        seo: { ...form.seo, ogImageId: form.ogImage?.id ?? null },
      };

      type SaveResult = {
        trip: { id: string; slug: string };
        /* Only a PATCH reports it. A create is a draft, which the site has
           nothing to hear about. */
        revalidated?: { ok: boolean; detail?: string };
      };

      if (form.id) {
        return apiPatch<SaveResult>(`/api/trips/${form.id}`, payload);
      }
      return apiPost<SaveResult>('/api/trips', payload);
    },

    onSuccess: (result) => {
      setProblems({});
      const next = { ...form, id: result.trip.id, slug: result.trip.slug };
      setForm(next);
      setSaved(next);
      void client.invalidateQueries({ queryKey: ['trips'] });

      /**
       * A save that did not reach the website says so.
       *
       * The row is written either way, and the site catches up within the
       * hour — but an editor who published something and cannot see it on the
       * site deserves to know which of the two happened.
       */
      const push = result.revalidated;
      if (push && !push.ok) {
        toast.warning('Saved, but the website was not told', { description: push.detail });
      } else {
        toast.success('Saved');
      }

      if (!initial.id) router.replace(`/trips/${result.trip.id}`);
    },

    onError: (error: Error) => {
      if (error instanceof ApiClientError && error.code === 'NOT_READY') {
        setProblems((error as ApiClientError & { fields?: Record<string, string> }).fields ?? {});
        /* Put the status back, so the form matches what was actually saved. */
        setForm((current) => ({ ...current, status: saved.status }));
        toast.error('Not ready to publish');
        return;
      }
      if (error instanceof ApiClientError && error.fields) {
        setProblems(error.fields);
        toast.error(error.message);
        return;
      }
      toast.error(error.message);
    },
  });

  const publicUrl = `${siteUrl}/trips/${form.slug || 'untitled'}`;

  const tabs = TABS.map((item) => ({
    ...item,
    badge:
      item.value === 'itinerary'
        ? form.itinerary.length
        : item.value === 'photographs'
          ? form.gallery.length
          : item.value === 'questions'
            ? form.faqs.length
            : item.value === 'pricing'
              ? form.pricingTiers.length || undefined
              : undefined,
  }));

  return (
    <EditorShell
      backHref="/trips"
      backLabel="Journeys"
      title={form.title}
      subtitle={form.slug ? `/trips/${form.slug}` : 'Not saved yet'}
      tabs={tabs}
      tab={tab}
      onTab={setTab}
      status={form.status}
      onStatus={(status) => set('status', status)}
      canPublish={canPublish}
      dirty={dirty}
      saving={save.isPending}
      onSave={() => save.mutate()}
      viewUrl={form.status === 'PUBLISHED' && form.id ? publicUrl : null}
      previewUrl={form.id ? `/api/preview/trip/${form.id}` : null}
      notice={
        <PublishProblems problems={problems} onDismiss={() => setProblems({})} />
      }
    >
      {tab === 'journey' && (
        <div className="space-y-5">
          <Section title="What it is called">
            <Field label="Title" htmlFor="title">
              <Input
                id="title"
                value={form.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setForm((current) => ({
                    ...current,
                    title,
                    /**
                     * The slug follows the title until the journey is saved,
                     * and then stops.
                     *
                     * After the first save the slug is a published URL, and
                     * fixing a typo in a title should not silently move it —
                     * changing it deliberately writes a 301, which is a
                     * decision rather than a side effect of typing.
                     */
                    slug: current.id ? current.slug : toSlug(title),
                  }));
                }}
              />
            </Field>

            <Field
              label="URL"
              htmlFor="slug"
              hint={
                form.id
                  ? 'Changing this moves the page. The old address keeps working — a permanent redirect is written for you.'
                  : 'Built from the title. Change it now if you want something different.'
              }
            >
              <div className="flex items-center gap-1 text-sm">
                <span className="shrink-0 text-muted-foreground">/trips/</span>
                <Input
                  id="slug"
                  value={form.slug}
                  onChange={(event) => set('slug', toSlug(event.target.value))}
                />
              </div>
            </Field>

            <Field
              label="Kind"
              hint="Which tab of the journeys page this appears under."
            >
              <Select
                value={form.type}
                onValueChange={(value) => set('type', value as TripFormData['type'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MINDFULNESS">Mindfulness</SelectItem>
                  <SelectItem value="MEDITATION">Meditation</SelectItem>
                  <SelectItem value="FESTIVAL">Festival</SelectItem>
                  <SelectItem value="TREKKING">Trekking</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Line under the title"
              htmlFor="journeyLabel"
              hint="Small, above the heading on the journey page. “Mindfulness journey”."
            >
              <Input
                id="journeyLabel"
                value={form.journeyLabel}
                onChange={(event) => set('journeyLabel', event.target.value)}
              />
            </Field>

            <Field
              label="Excerpt"
              htmlFor="excerpt"
              hint="One sentence. It is on the card, and it is what a search result says when there is no meta description."
            >
              <Textarea
                id="excerpt"
                value={form.excerpt}
                rows={2}
                onChange={(event) => set('excerpt', event.target.value)}
              />
            </Field>

            <div className="flex items-start gap-2">
              <Checkbox
                id="featured"
                checked={form.featured}
                onCheckedChange={(checked) => set('featured', checked === true)}
              />
              <label htmlFor="featured" className="text-sm">
                Feature this journey
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Marks it on the cards. Does not change which journeys the home page
                  shows — that is the first four in catalogue order.
                </span>
              </label>
            </div>
          </Section>

          <Section
            title="The facts"
            description="These render as the row of figures under the title, and as the structured data a search engine and an assistant read."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Days" htmlFor="durationDays">
                <Input
                  id="durationDays"
                  type="number"
                  min={1}
                  value={form.durationDays}
                  onChange={(event) => set('durationDays', Number(event.target.value))}
                />
              </Field>

              <Field
                label="Nights"
                htmlFor="nights"
                error={
                  form.nights > form.durationDays
                    ? 'There cannot be more nights than days.'
                    : undefined
                }
              >
                <Input
                  id="nights"
                  type="number"
                  min={0}
                  value={form.nights}
                  onChange={(event) => set('nights', Number(event.target.value))}
                />
              </Field>

              <Field label="Highest point (metres)" htmlFor="highPointMetres">
                <Input
                  id="highPointMetres"
                  type="number"
                  min={0}
                  value={form.highPointMetres}
                  onChange={(event) => set('highPointMetres', Number(event.target.value))}
                />
              </Field>

              <Field label="Difficulty">
                <Select
                  value={form.difficulty}
                  onValueChange={(value) =>
                    set('difficulty', value as TripFormData['difficulty'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENTLE">Gentle</SelectItem>
                    <SelectItem value="MODERATE">Moderate</SelectItem>
                    <SelectItem value="DEMANDING">Demanding</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="From price, US$"
                htmlFor="priceFromUsd"
                hint="Per person. A number — the site formats it."
              >
                <Input
                  id="priceFromUsd"
                  type="number"
                  min={0}
                  value={form.priceFromUsd}
                  onChange={(event) => set('priceFromUsd', Number(event.target.value))}
                />
              </Field>

              <Field
                label="Best season"
                htmlFor="seasonLabel"
                hint="In words, as the card prints them. “Spring · Autumn”."
              >
                <Input
                  id="seasonLabel"
                  value={form.seasonLabel}
                  onChange={(event) => set('seasonLabel', event.target.value)}
                />
              </Field>

              <Field label="Smallest group" htmlFor="groupSizeMin">
                <Input
                  id="groupSizeMin"
                  type="number"
                  min={1}
                  value={form.groupSizeMin ?? ''}
                  onChange={(event) =>
                    set('groupSizeMin', event.target.value ? Number(event.target.value) : null)
                  }
                />
              </Field>

              <Field label="Largest group" htmlFor="groupSizeMax">
                <Input
                  id="groupSizeMax"
                  type="number"
                  min={1}
                  value={form.groupSizeMax ?? ''}
                  onChange={(event) =>
                    set('groupSizeMax', event.target.value ? Number(event.target.value) : null)
                  }
                />
              </Field>
            </div>

            <Field
              label="Which seasons it runs in"
              hint="Used by the filter. Kept separate from the line above, because “Spring · Autumn” is prose and this is a set."
            >
              <div className="flex flex-wrap gap-2">
                {(['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] as const).map((key) => {
                  const on = form.seasonKeys.includes(key);
                  return (
                    <Button
                      key={key}
                      type="button"
                      variant={on ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        set(
                          'seasonKeys',
                          on
                            ? form.seasonKeys.filter((item) => item !== key)
                            : [...form.seasonKeys, key],
                        )
                      }
                    >
                      {key.charAt(0) + key.slice(1).toLowerCase()}
                    </Button>
                  );
                })}
              </div>
            </Field>

            <Field
              label="Pace"
              htmlFor="paceNote"
              hint="How the days are shaped. “Two rest days, and nothing scheduled before eight.”"
            >
              <Input
                id="paceNote"
                value={form.paceNote}
                onChange={(event) => set('paceNote', event.target.value)}
              />
            </Field>
          </Section>

          <Section
            title="The region line"
            description="What the card prints under the title, joined with a middot. It is editorial: the Jomolhari trek names a mountain that is not one of the destinations, which is why this is a list of words and not the route."
          >
            <StringList
              items={form.regions}
              onChange={(regions) => set('regions', regions)}
              placeholder="Paro"
              addLabel="Add a place"
              empty="No places named. The card will show the slug instead."
            />
            {form.destinationIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const byId = new Map(destinations.map((row) => [row.id, row.name]));
                  set(
                    'regions',
                    form.destinationIds
                      .map((id) => byId.get(id))
                      .filter((name): name is string => Boolean(name)),
                  );
                }}
              >
                <Wand2 className="mr-1.5 size-3.5" />
                Build it from the route
              </Button>
            )}
          </Section>

          <Section
            title="The hero photograph"
            description="The full-width picture at the top of the page, and what is shown when somebody shares the link."
          >
            <MediaPicker value={form.hero} onChange={(media) => set('hero', media)} />
          </Section>

          <Section
            title="Overview"
            description="The paragraphs under the hero. One box per paragraph."
          >
            <StringList
              items={form.overview}
              onChange={(overview) => set('overview', overview)}
              placeholder="Write a paragraph…"
              addLabel="Add a paragraph"
              empty="Nothing written yet."
            />
          </Section>
        </div>
      )}

      {tab === 'itinerary' && (
        <ItineraryEditor
          days={form.itinerary}
          onChange={(itinerary) => set('itinerary', itinerary)}
        />
      )}

      {tab === 'details' && (
        <div className="space-y-5">
          <Section
            title="Highlights"
            description="The short list beside the overview. Three to six reads best."
          >
            <StringList
              items={form.highlights}
              onChange={(highlights) => set('highlights', highlights)}
              placeholder="Cham dances in a dzong courtyard"
              addLabel="Add a highlight"
              empty="No highlights yet."
            />
          </Section>

          <Section
            title="What is included"
            description="Everything the price covers. The Sustainable Development Fee is one of these."
          >
            <StringList
              items={form.included}
              onChange={(included) => set('included', included)}
              placeholder="Every meal, and a cup of tea with it"
              addLabel="Add a line"
              empty="Nothing listed."
            />
          </Section>

          <Section
            title="What is not included"
            description="The list beside it. Being specific here is what stops an awkward conversation later."
          >
            <StringList
              items={form.excluded}
              onChange={(excluded) => set('excluded', excluded)}
              placeholder="International airfare"
              addLabel="Add a line"
              empty="Nothing listed."
            />
          </Section>

          <Section
            title="Extra figures"
            description="The row under the title already shows the length, the nights, the high point, the grade and the price. This is for the sixth figure, where a journey has one — “11 days walking”, “4 nights under canvas”. Empty is the normal answer."
          >
            <SortableList
              items={form.stats}
              itemKey={(_, index) => `stat-${index}`}
              onChange={(stats) => set('stats', stats)}
              onRemove={(index) =>
                set('stats', form.stats.filter((_, i) => i !== index))
              }
              onAdd={() => set('stats', [...form.stats, { label: '', value: '', note: null }])}
              addLabel="Add a figure"
              empty="None, which is right for most journeys."
              describeItem={(stat, index) => stat.label || `figure ${index + 1}`}
              renderItem={(stat, index) => {
                const patch = (changes: Partial<StatForm>) => {
                  const next = [...form.stats];
                  next[index] = { ...stat, ...changes };
                  set('stats', next);
                };
                return (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input
                      value={stat.label}
                      placeholder="Walking"
                      aria-label={`Label for figure ${index + 1}`}
                      onChange={(event) => patch({ label: event.target.value })}
                    />
                    <Input
                      value={stat.value}
                      placeholder="11 days"
                      aria-label={`Value for figure ${index + 1}`}
                      onChange={(event) => patch({ value: event.target.value })}
                    />
                    <Input
                      value={stat.note ?? ''}
                      placeholder="Note (optional)"
                      aria-label={`Note for figure ${index + 1}`}
                      onChange={(event) => patch({ note: event.target.value || null })}
                    />
                  </div>
                );
              }}
            />
          </Section>

          <Section
            title="The walking profile"
            description="One row per day that gains or loses height. The day number is the one the itinerary shows — a rest day consumes a number, and a profile whose days disagree with the itinerary is worse than none."
          >
            <SortableList
              items={form.elevationProfile}
              itemKey={(_, index) => `elev-${index}`}
              onChange={(elevationProfile) => set('elevationProfile', elevationProfile)}
              onRemove={(index) =>
                set(
                  'elevationProfile',
                  form.elevationProfile.filter((_, i) => i !== index),
                )
              }
              onAdd={() =>
                set('elevationProfile', [
                  ...form.elevationProfile,
                  { day: form.elevationProfile.length + 1, label: '', metres: 2_400 },
                ])
              }
              addLabel="Add a point"
              empty="No profile. Only the trekking journeys need one."
              describeItem={(point, index) => point.label || `point ${index + 1}`}
              renderItem={(point, index) => {
                const patch = (changes: Partial<ElevationPointForm>) => {
                  const next = [...form.elevationProfile];
                  next[index] = { ...point, ...changes };
                  set('elevationProfile', next);
                };
                return (
                  <div className="grid gap-2 sm:grid-cols-[1fr_3fr_1fr]">
                    <Input
                      type="number"
                      min={0}
                      value={point.day}
                      aria-label={`Day for point ${index + 1}`}
                      onChange={(event) => patch({ day: Number(event.target.value) || 0 })}
                    />
                    <Input
                      value={point.label}
                      placeholder="Jangothang"
                      aria-label={`Place for point ${index + 1}`}
                      onChange={(event) => patch({ label: event.target.value })}
                    />
                    <Input
                      type="number"
                      value={point.metres}
                      aria-label={`Height in metres for point ${index + 1}`}
                      onChange={(event) => patch({ metres: Number(event.target.value) || 0 })}
                    />
                  </div>
                );
              }}
            />
          </Section>
        </div>
      )}

      {tab === 'photographs' && (
        <div className="space-y-5">
          <TripGalleryEditor
            items={form.gallery}
            onChange={(gallery) => set('gallery', gallery)}
          />

          <Section
            title="The route, as a map"
            description="A drawing, not a live map. A live one is a third-party script on every journey page, a tile bill and a thing to keep working, for a route that changes about once a year."
          >
            <MediaPicker
              label="Map"
              value={form.routeMap}
              onChange={(routeMap) => set('routeMap', routeMap)}
            />
          </Section>

          <Section
            title="A film"
            description="YouTube or Vimeo. The page shows the still and only loads the player when somebody presses play — half a megabyte per film, on a page somebody came to read."
          >
            <Field
              label="Address"
              hint={
                form.videoUrl.trim() === ''
                  ? undefined
                  : parseVideoSource(form.videoUrl)
                    ? `Recognised: ${providerLabel(parseVideoSource(form.videoUrl))}`
                    : 'That does not name a film. A channel page or a playlist has no video in it.'
              }
            >
              <Input
                value={form.videoUrl}
                placeholder="https://www.youtube.com/watch?v=…"
                onChange={(event) => set('videoUrl', event.target.value)}
              />
            </Field>
          </Section>
        </div>
      )}

      {tab === 'pricing' && (
        <>
          <Section
            title="What it costs"
            description="The headline figure and the sentence under it. Every price on this site is per adult and in US dollars, which is how Bhutan quotes."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From" hint="The lowest price a traveller can pay — usually the largest group.">
                <Input
                  type="number"
                  min={0}
                  value={form.priceFromUsd}
                  onChange={(event) => set('priceFromUsd', Number(event.target.value) || 0)}
                />
              </Field>
              <Field label="Currency" hint="ISO 4217. Changing it does not convert anything.">
                <Input
                  value={form.priceCurrency}
                  maxLength={3}
                  onChange={(event) => set('priceCurrency', event.target.value.toUpperCase())}
                />
              </Field>
            </div>

            <Field
              label="What the price says"
              hint="What it includes and what it does not — the SDF, internal flights, the single supplement. Shown under the figure."
            >
              <RichTextEditor
                value={form.priceNote}
                onChange={(priceNote) => set('priceNote', priceNote)}
                compact
                minHeight="min-h-[100px]"
                placeholder="Includes the Sustainable Development Fee, all permits, meals and accommodation."
              />
            </Field>
          </Section>

          <Section
            title="By party size"
            description="Bhutan's tariff falls as a group grows, so one price is either wrong for a couple or wrong for eight. Leave this empty and the page shows the single figure above."
          >
            <SortableList
              items={form.pricingTiers}
              itemKey={(tier) => tier.key}
              onChange={(pricingTiers) => set('pricingTiers', pricingTiers)}
              onRemove={(index) =>
                set(
                  'pricingTiers',
                  form.pricingTiers.filter((_, i) => i !== index),
                )
              }
              onAdd={() =>
                set('pricingTiers', [
                  ...form.pricingTiers,
                  {
                    key: `tier-${Date.now()}`,
                    label: '',
                    minPeople: 1,
                    maxPeople: null,
                    priceUsd: 0,
                    wasPriceUsd: null,
                    note: '',
                  },
                ])
              }
              addLabel="Add a tier"
              empty="No tiers. Two, three to five, and six or more is the shape most of these take."
              describeItem={(tier, index) => tier.label || `tier ${index + 1}`}
              renderItem={(tier, index) => {
                const patch = (changes: Partial<PricingTierForm>) => {
                  const next = [...form.pricingTiers];
                  next[index] = { ...tier, ...changes };
                  set('pricingTiers', next);
                };
                return (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                      <Input
                        value={tier.label}
                        placeholder="Two travellers"
                        aria-label={`Name for tier ${index + 1}`}
                        onChange={(event) => patch({ label: event.target.value })}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={tier.minPeople}
                        aria-label={`Smallest party for tier ${index + 1}`}
                        onChange={(event) => patch({ minPeople: Number(event.target.value) || 1 })}
                      />
                      <Input
                        type="number"
                        min={1}
                        value={tier.maxPeople ?? ''}
                        placeholder="and above"
                        aria-label={`Largest party for tier ${index + 1}`}
                        onChange={(event) =>
                          patch({
                            /* Empty means no ceiling — the last tier is
                               "six or more" and there is no number for that. */
                            maxPeople: event.target.value === '' ? null : Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr]">
                      <Input
                        type="number"
                        min={0}
                        value={tier.priceUsd}
                        aria-label={`Price for tier ${index + 1}`}
                        onChange={(event) => patch({ priceUsd: Number(event.target.value) || 0 })}
                      />
                      <Input
                        type="number"
                        min={0}
                        value={tier.wasPriceUsd ?? ''}
                        placeholder="was"
                        aria-label={`Previous price for tier ${index + 1}`}
                        onChange={(event) =>
                          patch({
                            wasPriceUsd: event.target.value === '' ? null : Number(event.target.value),
                          })
                        }
                      />
                      <Input
                        value={tier.note}
                        placeholder="Per adult, twin share"
                        aria-label={`Note for tier ${index + 1}`}
                        onChange={(event) => patch({ note: event.target.value })}
                      />
                    </div>
                  </div>
                );
              }}
            />
          </Section>
        </>
      )}

      {tab === 'questions' && (
        <>
        <Section
          title="Headings"
          description="Optional, and genuinely optional. Six questions want a flat list; thirty want “Before you go”, “On the trek”, “Money”. A question with no heading renders first, above the grouped ones — so nobody has to invent a heading to add a question."
        >
          <SortableList
            items={form.faqGroups}
            itemKey={(group) => group.key}
            onChange={(faqGroups) => set('faqGroups', faqGroups)}
            onRemove={(index) => {
              const removed = form.faqGroups[index];
              set(
                'faqGroups',
                form.faqGroups.filter((_, i) => i !== index),
              );
              /* The questions under it are kept and ungrouped. Deleting a
                 heading is a decision about headings, not about questions. */
              if (removed) {
                set(
                  'faqs',
                  form.faqs.map((faq) =>
                    faq.groupKey === removed.key ? { ...faq, groupKey: null } : faq,
                  ),
                );
              }
            }}
            onAdd={() =>
              set('faqGroups', [
                ...form.faqGroups,
                { key: `group-${Date.now()}`, title: '', blurb: '' },
              ])
            }
            addLabel="Add a heading"
            empty="No headings. The questions below render as one list, which is right until there are more than about ten."
            describeItem={(group, index) => group.title || `heading ${index + 1}`}
            renderItem={(group, index) => {
              const patch = (changes: Partial<FaqGroupForm>) => {
                const next = [...form.faqGroups];
                next[index] = { ...group, ...changes };
                set('faqGroups', next);
                /* The key is the title, so renaming has to carry the questions
                   with it — see `groupKey` on `FaqForm`. */
                if (changes.title !== undefined) {
                  set(
                    'faqs',
                    form.faqs.map((faq) =>
                      faq.groupKey === group.key ? { ...faq, groupKey: changes.title ?? null } : faq,
                    ),
                  );
                  next[index] = { ...group, ...changes, key: changes.title ?? group.key };
                  set('faqGroups', next);
                }
              };
              return (
                <div className="space-y-2">
                  <Input
                    value={group.title}
                    placeholder="Before you go"
                    aria-label={`Heading ${index + 1}`}
                    onChange={(event) => patch({ title: event.target.value })}
                  />
                  <Input
                    value={group.blurb}
                    placeholder="A sentence under it (optional)"
                    aria-label={`Note under heading ${index + 1}`}
                    onChange={(event) => patch({ blurb: event.target.value })}
                  />
                </div>
              );
            }}
          />
        </Section>

        <Section
          title="Questions"
          description="These render as an expandable list, and as the FAQ structured data — which is why they only go in the markup if they are on the page. Write the question the way somebody would ask it."
        >
          <SortableList
            items={form.faqs}
            itemKey={(_, index) => `faq-${index}`}
            onChange={(faqs) => set('faqs', faqs)}
            onRemove={(index) =>
              set('faqs', form.faqs.filter((_, i) => i !== index))
            }
            onAdd={() =>
              set('faqs', [...form.faqs, { question: '', answer: '', groupKey: null }])
            }
            addLabel="Add a question"
            empty="No questions yet. The five on every journey — why Bhutan, who guides, when to come, what the SDF is, can the pace change — are a good start."
            describeItem={(faq, index) => faq.question || `question ${index + 1}`}
            renderItem={(faq, index) => (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-[3fr_1fr]">
                  <Input
                    value={faq.question}
                    placeholder="What is the SDF?"
                    aria-label={`Question ${index + 1}`}
                    onChange={(event) => {
                      const next = [...form.faqs];
                      next[index] = { ...faq, question: event.target.value };
                      set('faqs', next);
                    }}
                  />
                  {/* Shown only once there is a heading to choose. A select with
                      one option that means "none" is a control that asks a
                      question with no answers. */}
                  {form.faqGroups.length > 0 && (
                    <select
                      value={faq.groupKey ?? ''}
                      aria-label={`Heading for question ${index + 1}`}
                      onChange={(event) => {
                        const next = [...form.faqs];
                        next[index] = { ...faq, groupKey: event.target.value || null };
                        set('faqs', next);
                      }}
                      className="h-9 rounded-md border bg-transparent px-2 text-sm"
                    >
                      <option value="">No heading</option>
                      {form.faqGroups.map((group) => (
                        <option key={group.key} value={group.key}>
                          {group.title || 'Untitled'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <RichTextEditor
                  value={faq.answer}
                  compact
                  minHeight="min-h-[100px]"
                  placeholder="The answer, in plain words."
                  onChange={(answer) => {
                    const next = [...form.faqs];
                    next[index] = { ...faq, answer };
                    set('faqs', next);
                  }}
                />
              </div>
            )}
          />
        </Section>
        </>
      )}

      {tab === 'links' && (
        <div className="space-y-5">
          <Section
            title="The route"
            description="Which of the destinations this journey passes through, in the order it does. This is what puts the journey's link on each place's page."
          >
            <div className="space-y-2">
              {destinations.map((destination) => {
                const onRoute = form.destinationIds.includes(destination.id);
                const offered = form.offeredByDestinationIds.includes(destination.id);
                return (
                  <div
                    key={destination.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3 rounded-lg border p-3',
                      !onRoute && 'opacity-60',
                    )}
                  >
                    <Checkbox
                      id={`dest-${destination.id}`}
                      checked={onRoute}
                      onCheckedChange={(checked) => {
                        if (checked === true) {
                          set('destinationIds', [...form.destinationIds, destination.id]);
                        } else {
                          set(
                            'destinationIds',
                            form.destinationIds.filter((id) => id !== destination.id),
                          );
                          set(
                            'offeredByDestinationIds',
                            form.offeredByDestinationIds.filter(
                              (id) => id !== destination.id,
                            ),
                          );
                        }
                      }}
                    />
                    <label htmlFor={`dest-${destination.id}`} className="flex-1 text-sm">
                      {destination.name}
                      {onRoute && (
                        <Badge variant="outline" className="ml-2 h-5 px-1.5 text-[10px]">
                          stop {form.destinationIds.indexOf(destination.id) + 1}
                        </Badge>
                      )}
                    </label>

                    {onRoute && (
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                          checked={offered}
                          onCheckedChange={(checked) =>
                            set(
                              'offeredByDestinationIds',
                              checked === true
                                ? [...form.offeredByDestinationIds, destination.id]
                                : form.offeredByDestinationIds.filter(
                                    (id) => id !== destination.id,
                                  ),
                            )
                          }
                        />
                        Offer it on this page
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              A journey can pass through somewhere without that place selling it — the
              festival journey goes through Paro and the Paro page does not offer it.
              The second box is what decides.
            </p>
          </Section>

          <TripPageSections value={form.sections} onChange={(next) => set('sections', next)} />

          <OrderedPicker
            title="Culture to offer"
            description="Shown near the foot of this page, in the order you tick them. Left empty, the site offers what is linked to the places on the route."
            options={culture.map((article) => ({ id: article.id, label: article.title }))}
            value={form.cultureIds}
            onChange={(next) => set('cultureIds', next)}
            disabled={!form.sections.culture}
            empty="There are no culture pieces yet."
          />

          <OrderedPicker
            title="Journal entries to offer"
            description="The same link as an entry's own Journeys field — ticking one here ticks this journey there. Shown newest first. Left empty, the site offers the newest entries about the route."
            options={posts.map((post) => ({
              id: post.id,
              label: post.title,
              detail: post.published ? undefined : 'not published',
            }))}
            value={form.postIds}
            onChange={(next) => set('postIds', next)}
            disabled={!form.sections.journal}
            empty="There are no journal entries yet."
          />

          <Section
            title="Other journeys to offer"
            description={
              form.sections.related
                ? 'Shown at the foot of this page. Left empty, the site offers the next few in catalogue order.'
                : 'Switched off above, so nothing here shows.'
            }
          >
            <div className={cn('space-y-2', !form.sections.related && 'opacity-60')}>
              {otherTrips.map((trip) => (
                <label
                  key={trip.id}
                  className="flex items-center gap-3 rounded-lg border p-3 text-sm"
                >
                  <Checkbox
                    checked={form.relatedTripIds.includes(trip.id)}
                    onCheckedChange={(checked) =>
                      set(
                        'relatedTripIds',
                        checked === true
                          ? [...form.relatedTripIds, trip.id]
                          : form.relatedTripIds.filter((id) => id !== trip.id),
                      )
                    }
                  />
                  {trip.title}
                </label>
              ))}
            </div>
          </Section>
        </div>
      )}

      {tab === 'seo' && (
        <SeoPanel
            kind="trip"
          value={form.seo}
          onChange={(patch) => set('seo', { ...form.seo, ...patch })}
          inherited={{ title: form.title, description: form.excerpt }}
          ogImage={form.ogImage}
          onOgImage={(media) => set('ogImage', media)}
          url={publicUrl}
        />
      )}
    </EditorShell>
  );
}

export { Moon };
