'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, Section } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiGet, apiPatch } from '@/lib/api-client';
import { humanise } from '@/lib/format';

interface Template {
  id: string;
  kind: string;
  name: string;
  isActive: boolean;
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  closing: string;
  summaryLabel: string;
  notesLabel: string;
  buttonLabel: string;
  buttonUrl: string;
  signOff: string;
  footNote: string;
}

const FIELDS: { key: keyof Template; label: string; hint?: string; rows?: number }[] = [
  { key: 'subject', label: 'Subject' },
  {
    key: 'preheader',
    label: 'Preview line',
    hint: 'What an inbox shows after the subject. Never rendered in the message itself.',
  },
  { key: 'eyebrow', label: 'Eyebrow', hint: 'Small, above the heading.' },
  { key: 'heading', label: 'Heading' },
  { key: 'intro', label: 'Opening', hint: 'Blank lines separate paragraphs.', rows: 5 },
  { key: 'summaryLabel', label: 'Heading above the summary table' },
  { key: 'notesLabel', label: 'Heading above their message' },
  { key: 'closing', label: 'Closing', rows: 3 },
  { key: 'signOff', label: 'Sign-off', rows: 2 },
  { key: 'buttonLabel', label: 'Button' },
  { key: 'buttonUrl', label: 'Where the button goes', hint: 'Relative to the site, or absolute. Empty hides it.' },
  { key: 'footNote', label: 'Small print', rows: 2 },
];

/**
 * The words the site's emails are made of.
 *
 * "Thank you for writing to us" is copy, and copy is the office's. Every field
 * may carry `{{tokens}}`; the ones this message can fill are listed beside the
 * form, and a token that does not exist is refused on save rather than going
 * out as a gap in a sentence to a customer.
 */
export function EmailTemplatesScreen({ canWrite }: { canWrite: boolean }) {
  const client = useQueryClient();
  const [drafts, setDrafts] = React.useState<Record<string, Partial<Template>>>({});

  const { data, isLoading } = useQuery<{
    templates: Template[];
    tokens: Record<string, string[]>;
  }>({
    queryKey: ['email-templates'],
    queryFn: () => apiGet('/api/email-templates'),
  });

  const save = useMutation({
    mutationFn: ({ kind, body }: { kind: string; body: unknown }) =>
      apiPatch(`/api/email-templates/${kind.toLowerCase()}`, body),
    onSuccess: (_result, variables) => {
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.kind];
        return next;
      });
      void client.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Saved');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 10_000 }),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-64 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {data.templates.map((template) => {
        const draft = { ...template, ...drafts[template.kind] };
        const dirty = Boolean(drafts[template.kind]);
        const tokens = data.tokens[template.kind] ?? [];
        const set = (patch: Partial<Template>) =>
          setDrafts((current) => ({
            ...current,
            [template.kind]: { ...current[template.kind], ...patch },
          }));

        return (
          <Section
            key={template.kind}
            title={template.name}
            description={humanise(template.kind)}
          >
            <div className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 p-2 text-[11px]">
              <span className="text-muted-foreground">It can use:</span>
              {tokens.map((token) => (
                <code key={token} className="rounded bg-background px-1 py-0.5">
                  {`{{${token}}}`}
                </code>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={draft.isActive}
                disabled={!canWrite}
                onCheckedChange={(isActive) => set({ isActive })}
              />
              Send this message
            </label>

            {FIELDS.map((field) =>
              field.rows ? (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <Textarea
                    value={String(draft[field.key] ?? '')}
                    rows={field.rows}
                    disabled={!canWrite}
                    onChange={(event) => set({ [field.key]: event.target.value } as Partial<Template>)}
                    className="text-sm"
                  />
                </Field>
              ) : (
                <Field key={field.key} label={field.label} hint={field.hint}>
                  <Input
                    value={String(draft[field.key] ?? '')}
                    disabled={!canWrite}
                    onChange={(event) => set({ [field.key]: event.target.value } as Partial<Template>)}
                    className="h-8 text-sm"
                  />
                </Field>
              ),
            )}

            {canWrite && (
              <Button
                size="sm"
                disabled={!dirty || save.isPending}
                onClick={() => {
                  const { id: _id, kind: _kind, ...body } = draft;
                  save.mutate({ kind: template.kind, body });
                }}
              >
                {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {dirty ? 'Save' : 'Saved'}
              </Button>
            )}
          </Section>
        );
      })}
    </div>
  );
}
