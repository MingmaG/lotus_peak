'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { MediaPicker, type PickedMedia } from '@/components/media/media-picker';
import { Field, Section } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiPatch } from '@/lib/api-client';

interface Season {
  id: string;
  key: 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';
  name: string;
  monthsLabel: string;
  headline: string;
  summary: string;
  detail: string;
  image: PickedMedia | null;
}

/**
 * The four panels on the home page.
 *
 * All four on one screen, with no add and no delete, because there are four
 * seasons. A list with an Add button would be offering to invent a fifth.
 */
export function SeasonsScreen({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const [drafts, setDrafts] = React.useState<Record<string, Partial<Season>>>({});

  const { data, isLoading } = useQuery<{ items: Season[] }>({
    queryKey: ['seasons'],
    queryFn: () => fetch('/api/seasons').then((response) => response.json()),
  });

  const save = useMutation({
    mutationFn: ({ key, body }: { key: string; body: unknown }) =>
      apiPatch(`/api/seasons/${key.toLowerCase()}`, body),
    onSuccess: (_result, variables) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.key];
        return next;
      });
      void client.invalidateQueries({ queryKey: ['seasons'] });
      toast.success('Saved');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-64 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {(data?.items ?? []).map((season) => {
        const draft = { ...season, ...drafts[season.key] };
        const dirty = Boolean(drafts[season.key]);
        const set = (patch: Partial<Season>) =>
          setDrafts((current) => ({
            ...current,
            [season.key]: { ...current[season.key], ...patch },
          }));

        return (
          <Section
            key={season.key}
            title={season.name}
            description={season.monthsLabel}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={draft.name}
                  disabled={!canWrite}
                  onChange={(event) => set({ name: event.target.value })}
                />
              </Field>
              <Field label="Months" hint="As the panel prints them. “Mar – May”.">
                <Input
                  value={draft.monthsLabel}
                  disabled={!canWrite}
                  onChange={(event) => set({ monthsLabel: event.target.value })}
                />
              </Field>
            </div>

            <Field label="Headline" hint="The line under the season's name.">
              <Input
                value={draft.headline}
                disabled={!canWrite}
                onChange={(event) => set({ headline: event.target.value })}
              />
            </Field>

            <Field label="Summary" hint="Two sentences, shown closed.">
              <Textarea
                value={draft.summary}
                rows={2}
                disabled={!canWrite}
                onChange={(event) => set({ summary: event.target.value })}
              />
            </Field>

            <Field
              label="The detail"
              hint="Behind “Read more”. Temperatures, rainfall, which festivals fall in it."
            >
              <Textarea
                value={draft.detail}
                rows={6}
                disabled={!canWrite}
                onChange={(event) => set({ detail: event.target.value })}
              />
            </Field>

            <MediaPicker value={draft.image} onChange={(image) => set({ image })} />

            {canWrite && (
              <Button
                size="sm"
                disabled={!dirty || save.isPending}
                onClick={() =>
                  save.mutate({
                    key: season.key,
                    body: {
                      name: draft.name,
                      monthsLabel: draft.monthsLabel,
                      headline: draft.headline,
                      summary: draft.summary,
                      detail: draft.detail,
                      imageId: draft.image?.id ?? null,
                    },
                  })
                }
              >
                {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {dirty ? `Save ${season.name.toLowerCase()}` : 'Saved'}
              </Button>
            )}
          </Section>
        );
      })}
    </div>
  );
}
