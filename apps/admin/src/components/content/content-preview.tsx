'use client';

import { useMutation } from '@tanstack/react-query';
import { ExternalLink, Eye, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { toast } from 'sonner';

import { RichTextEditor } from '@/components/editor/rich-text-editor';
import { SearchPreview } from '@/components/content/seo-panel';
import { PreviewFrame } from '@/components/preview/preview-frame';
import { Breadcrumbs, type Crumb } from '@/components/shared/breadcrumbs';
import { SortableList } from '@/components/shared/sortable-list';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { apiPatch } from '@/lib/api-client';
import type { ContentStatus } from '@prisma/client';

/**
 * What a record opens on: the page, not the form.
 *
 * Opening a place used to put the office straight into a column of inputs.
 * Most visits are to *look* — is this still right, what does it link to,
 * does it have a photograph — and a form is the worst way to read a page: the
 * body is in a box with a toolbar over it, the headings are the editor's and
 * not the site's, and the links to other sections are a list of checkboxes.
 *
 * So a record opens here, drawn roughly the way the website draws it, with
 * what only the office needs underneath: the search result, the details, and
 * what links to it. Editing is one button away, on a page of its own.
 *
 * "Roughly": this is the panel's rendering of the saved row, not the site's.
 * **Preview on site** opens the real page, rendered from the same row, and is
 * the one to trust about layout.
 */

export interface ContentPreviewLink {
  title: string;
  status: ContentStatus;
  /** The panel's own page for it. */
  href: string;
  /** Its address on the website. */
  detail: string;
}

export interface ContentPreviewData {
  kind: 'destination' | 'culture' | 'post';
  id: string;
  title: string;
  path: string;
  status: ContentStatus;
  updatedAt: string;
  eyebrow: string;
  standfirst: string;
  /** A destination's one-line card text. */
  blurb: string | null;
  /** Rich text, with every figure's URL resolved. */
  body: string;
  image: { url: string; alt: string } | null;
  icon: string | null;
  facts: [label: string, value: string][];
  seo: { title: string; description: string; noIndex: boolean };
  parent: { id: string; title: string; href: string } | null;
  /** A valley's places. Null where the record cannot have any. */
  places:
    | {
        id: string;
        title: string;
        detail: string;
        status: ContentStatus;
        href: string;
        image: string | null;
      }[]
    | null;
  links: { title: string; hint: string; items: ContentPreviewLink[] }[];
}

const SECTION: Record<ContentPreviewData['kind'], { label: string; href: string }> = {
  destination: { label: 'Where we go', href: '/destinations' },
  culture: { label: 'Culture', href: '/culture' },
  post: { label: 'Journal', href: '/journal' },
};

export function ContentPreview({
  data,
  siteUrl,
  canEdit,
}: {
  data: ContentPreviewData;
  siteUrl: string;
  canEdit: boolean;
}) {
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const section = SECTION[data.kind];
  const base = `${section.href}/${data.id}`;

  const crumbs: Crumb[] = [
    { label: section.label, href: section.href },
    ...(data.parent ? [{ label: data.parent.title, href: data.parent.href }] : []),
    { label: data.title },
  ];

  return (
    <div className="mx-auto max-w-5xl pb-12">
      <Breadcrumbs items={crumbs} />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{data.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <StatusBadge status={data.status} />
            <span className="font-mono text-xs">{data.path}</span>
            <span className="text-xs">
              Updated{' '}
              {new Date(data.updatedAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-1.5 size-4" />
            Preview on site
          </Button>
          {data.status === 'PUBLISHED' && (
            <Button variant="ghost" size="sm" asChild>
              <a href={`${siteUrl}${data.path}`} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 size-4" />
                Open on the website
              </a>
            </Button>
          )}
          {canEdit && (
            <Button size="sm" asChild>
              <Link href={`${base}/edit`}>
                <Pencil className="mr-1.5 size-4" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      <PreviewFrame
        url={`/api/preview/${data.kind}/${data.id}`}
        title={data.title}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      {data.status !== 'PUBLISHED' && (
        <p className="mb-4 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          {data.status === 'ARCHIVED'
            ? 'Archived. The website does not show it.'
            : 'Not published yet. The website does not show it — Preview on site shows it as it will look.'}
        </p>
      )}

      {/* The page, on the site's white ground. */}
      <article className="lp-preview-canvas overflow-hidden rounded-lg border shadow-sm">
        {data.image ? (
          <div className="relative aspect-[16/7] w-full bg-muted">
            <img
              src={data.image.url}
              alt={data.image.alt}
              className="absolute inset-0 size-full object-cover"
            />
          </div>
        ) : (
          <div className="flex aspect-[16/5] w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground">
            No photograph yet
          </div>
        )}

        <div className="px-5 py-8 sm:px-10 sm:py-10">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b6b66]">
            {data.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
            {data.title}
          </h2>
          {data.standfirst ? (
            <p className="mt-4 max-w-[60ch] text-lg leading-relaxed text-[#4a4a45]">
              {data.standfirst}
            </p>
          ) : (
            <p className="mt-4 text-sm italic text-[#8a8a84]">
              No standfirst — the sentence under the title. Search results fall back to the card
              line.
            </p>
          )}

          <hr className="my-8 border-[#e7e5df]" />

          {data.body && data.body !== '<p></p>' ? (
            <RichTextEditor value={data.body} onChange={() => undefined} readOnly />
          ) : (
            <p className="text-sm italic text-[#8a8a84]">
              Nothing written yet. {canEdit ? 'Edit, then the Body tab, to write the page.' : ''}
            </p>
          )}
        </div>
      </article>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-sm font-medium">In a search result</h3>
          <SearchPreview
            url={`${siteUrl}${data.path}`}
            title={data.seo.title}
            description={data.seo.description}
          />
          {data.seo.noIndex && (
            <p className="text-xs text-destructive">
              Marked “do not index” on the SEO tab, so search engines are asked to leave it out.
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Details</h3>
          <dl className="divide-y rounded-lg border text-sm">
            {data.blurb !== null && (
              <Detail label="On the card">{data.blurb || '—'}</Detail>
            )}
            <Detail label="Address">
              <span className="font-mono text-xs">{data.path}</span>
            </Detail>
            {data.facts.map(([label, value]) => (
              <Detail key={label} label={label}>
                {value}
              </Detail>
            ))}
          </dl>
        </section>
      </div>

      {data.places && (
        <PlacesPanel
          valleyId={data.id}
          valleyName={data.title}
          initial={data.places}
          canEdit={canEdit}
        />
      )}

      {data.links.map((group) => (
        <section key={group.title} className="mt-8">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">{group.title}</h3>
            <p className="text-xs text-muted-foreground">{group.hint}</p>
          </div>
          {group.items.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
              None yet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm hover:bg-muted/40"
                  >
                    <span className="font-medium">{item.title}</span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-xs text-muted-foreground">{item.detail}</span>
                      <StatusBadge status={item.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/**
 * A valley's places, in the order its page lists them.
 *
 * Here rather than on the Where we go list, because that list is the valleys
 * and their order; nesting every valley's places under it would turn a list of
 * six into a list of thirty with two kinds of drag. A place is found from its
 * valley, the way a traveller finds it.
 */
function PlacesPanel({
  valleyId,
  valleyName,
  initial,
  canEdit,
}: {
  valleyId: string;
  valleyName: string;
  initial: NonNullable<ContentPreviewData['places']>;
  canEdit: boolean;
}) {
  const [places, setPlaces] = React.useState(initial);

  const reorder = useMutation({
    mutationFn: (ids: string[]) => apiPatch('/api/destinations', { ids }),
    onError: (error: Error) => {
      toast.error(`Could not save the new order: ${error.message}`);
      setPlaces(initial);
    },
  });

  return (
    <section className="mt-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Places in {valleyName}</h3>
          <p className="text-xs text-muted-foreground">
            Each has a page of its own under {valleyName}’s. Drag to change the order the page lists
            them in.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" variant="outline" asChild>
            <Link href={`/destinations/new?parent=${valleyId}`}>
              <Plus className="mr-1.5 size-4" />
              Add a place
            </Link>
          </Button>
        )}
      </div>

      {places.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          No places yet. Taktsang is a place in Paro; Punakha Dzong is a place in Punakha.
        </p>
      ) : (
        <SortableList
          items={places}
          itemKey={(place) => place.id}
          disabled={!canEdit}
          describeItem={(place) => place.title}
          onChange={(next) => {
            setPlaces(next);
            reorder.mutate(next.map((place) => place.id));
          }}
          renderItem={(place) => (
            <Link href={place.href} className="group flex w-full items-center gap-4">
              <span className="size-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                {place.image && (
                  <img src={place.image} alt="" className="size-full object-cover" loading="lazy" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium group-hover:underline">
                  {place.title}
                </span>
                <span className="block truncate text-sm text-muted-foreground">{place.detail}</span>
              </span>
              <StatusBadge status={place.status} className="shrink-0" />
            </Link>
          )}
        />
      )}
    </section>
  );
}
