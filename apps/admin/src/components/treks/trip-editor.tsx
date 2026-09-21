'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Moon, Wand2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { ItineraryEditor } from './itinerary-editor';
import { TripGalleryEditor } from './trip-gallery-editor';
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
  faqs: { question: string; answer: string }[];
  gallery: { mediaId: string; url: string; alt: string; ratio: string | null; width: string | null }[];
  hero: PickedMedia | null;
  ogImage: PickedMedia | null;
  destinationIds: string[];
  offeredByDestinationIds: string[];
  relatedTripIds: string[];
  featured: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  seo: SeoValue;
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
  siteUrl: string;
  canPublish: boolean;
}

const TABS = [
  { value: 'journey', label: 'Journey' },
  { value: 'itinerary', label: 'Itinerary' },
  { value: 'details', label: 'Details' },
  { value: 'photographs', label: 'Photographs' },
  { value: 'questions', label: 'Questions' },
  { value: 'links', label: 'Links' },
  { value: 'seo', label: 'SEO' },
];

export function TripEditor({
  initial,
  destinations,
  otherTrips,
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
        gallery: form.gallery.map((item) => ({
          mediaId: item.mediaId,
          ratio: item.ratio,
          width: item.width,
        })),
        heroId: form.hero?.id ?? null,
        destinationIds: form.destinationIds,
        offeredByDestinationIds: form.offeredByDestinationIds,
        relatedTripIds: form.relatedTripIds,
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
        </div>
      )}

      {tab === 'photographs' && (
        <TripGalleryEditor
          items={form.gallery}
          onChange={(gallery) => set('gallery', gallery)}
        />
      )}

      {tab === 'questions' && (
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
            onAdd={() => set('faqs', [...form.faqs, { question: '', answer: '' }])}
            addLabel="Add a question"
            empty="No questions yet. The five on every journey — why Bhutan, who guides, when to come, what the SDF is, can the pace change — are a good start."
            describeItem={(faq, index) => faq.question || `question ${index + 1}`}
            renderItem={(faq, index) => (
              <div className="space-y-2">
                <Input
                  value={faq.question}
                  placeholder="What is the SDF?"
                  onChange={(event) => {
                    const next = [...form.faqs];
                    next[index] = { ...faq, question: event.target.value };
                    set('faqs', next);
                  }}
                />
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

          <Section
            title="Other journeys to offer"
            description="Shown at the foot of this page. Left empty, the site offers the next few in catalogue order."
          >
            <div className="space-y-2">
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
