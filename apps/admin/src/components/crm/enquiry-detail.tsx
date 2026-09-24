'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookMarked,
  Loader2,
  Mail,
  MessageSquarePlus,
  Phone,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Section } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiDelete, apiPatch } from '@/lib/api-client';
import { formatDateTime, humanise, relativeTime } from '@/lib/format';

export interface EnquiryDetailData {
  id: string;
  reference: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  travellers: string | null;
  adults: number | null;
  children: number | null;
  preferredDates: string | null;
  message: string | null;
  restDays: boolean;
  source: string;
  status: string;
  priority: string;
  assigneeId: string | null;
  pagePath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
  respondedAt: string | null;
  trip: { id: string; title: string; slug: string } | null;
  assignee: { id: string; name: string } | null;
  notes: { id: string; body: string; createdAt: string; author: { name: string } | null }[];
  messages: {
    id: string;
    kind: string;
    toEmail: string;
    subject: string;
    status: string;
    sentAt: string | null;
    error: string | null;
    createdAt: string;
  }[];
}

const STATUSES = ['NEW', 'READ', 'REPLIED', 'QUOTED', 'CONVERTED', 'CLOSED', 'SPAM'];

/**
 * How many are coming.
 *
 * The contact form asks in words ("2 adults, 1 child") and the drawer asks in
 * numbers, so an enquiry has one or the other and almost never both. The free
 * text wins when it is there — it is what they actually said.
 */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function travellers(enquiry: EnquiryDetailData): string {
  if (enquiry.travellers?.trim()) return enquiry.travellers;
  const parts = [
    enquiry.adults ? plural(enquiry.adults, 'adult', 'adults') : null,
    enquiry.children ? plural(enquiry.children, 'child', 'children') : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '—';
}

/**
 * One enquiry.
 *
 * Built around what somebody actually does with it: read what they wrote,
 * reply, and write down what happened. The reply button is a `mailto:` with
 * the subject and the greeting already in it, because this office answers from
 * their own mail client — a reply composer inside the panel would be a second
 * inbox to keep in step with the first.
 */
export function EnquiryDetail({
  enquiry: initial,
  users,
  canWrite,
  canDelete,
  canBook,
}: {
  enquiry: EnquiryDetailData;
  users: { id: string; name: string }[];
  canWrite: boolean;
  canDelete: boolean;
  /** `bookings.write`. Reservations has it; an Editor does not. */
  canBook: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [enquiry, setEnquiry] = React.useState(initial);
  const [note, setNote] = React.useState('');

  const patch = useMutation({
    mutationFn: (body: unknown) => apiPatch<{ enquiry: EnquiryDetailData }>(`/api/enquiries/${enquiry.id}`, body),
    onSuccess: (result) => {
      setEnquiry((current) => ({ ...current, ...result.enquiry }));
      setNote('');
      void client.invalidateQueries({ queryKey: ['enquiries'] });
      void client.invalidateQueries({ queryKey: ['dashboard', 'badges'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: () => apiDelete(`/api/enquiries/${enquiry.id}`),
    onSuccess: () => {
      toast.success('Hidden');
      router.push('/enquiries');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mailto = React.useMemo(() => {
    const subject = `Re: your enquiry — ${enquiry.reference}`;
    const body = `Dear ${enquiry.name.split(' ')[0] ?? enquiry.name},\n\n`;
    return `mailto:${enquiry.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [enquiry.email, enquiry.name, enquiry.reference]);

  const facts: [string, React.ReactNode][] = [
    ['Reference', <span key="ref" className="font-mono">{enquiry.reference}</span>],
    ['Arrived', `${formatDateTime(enquiry.createdAt)} · ${relativeTime(enquiry.createdAt)}`],
    ['Journey', enquiry.trip?.title ?? 'Not yet chosen'],
    ['When', enquiry.preferredDates ?? '—'],
    ['Travellers', travellers(enquiry)],
    ['Country', enquiry.country ?? '—'],
    ['Rest days', enquiry.restDays ? 'Wanted' : '—'],
    ['Came from', `${humanise(enquiry.source)}${enquiry.pagePath ? ` · ${enquiry.pagePath}` : ''}`],
    [
      'Campaign',
      [enquiry.utmSource, enquiry.utmMedium, enquiry.utmCampaign].filter(Boolean).join(' · ') || '—',
    ],
    ['Answered', enquiry.respondedAt ? formatDateTime(enquiry.respondedAt) : 'Not yet'],
  ];

  return (
    <div className="pb-10">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/enquiries">
            <ArrowLeft className="mr-1.5 size-4" />
            Enquiries
          </Link>
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-medium">{enquiry.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{enquiry.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/**
           * Where an enquiry goes when the answer is yes.
           *
           * A link rather than a button that creates one: a booking needs a
           * price and a party size that this enquiry does not have, and a
           * half-made booking appearing in the list because somebody clicked
           * to see what it did is worse than one more screen. The booking form
           * arrives pre-filled, and saving it marks this enquiry converted.
           */}
          {canBook && (
            <Button size="sm" asChild>
              <Link href={`/bookings/new?enquiry=${enquiry.id}`}>
                <BookMarked className="size-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Turn into a booking</span>
              </Link>
            </Button>
          )}

          <Button variant="outline" size="sm" asChild>
            <a href={mailto}>
              <Mail className="size-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Reply</span>
            </a>
          </Button>

          {enquiry.phone && (
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${enquiry.phone.replace(/\s+/g, '')}`}>
                <Phone className="size-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Call</span>
              </a>
            </Button>
          )}

          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (
                  window.confirm(
                    'Hide this enquiry? It stays in the database — this is not an erasure request.',
                  )
                ) {
                  destroy.mutate();
                }
              }}
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Hide</span>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Section title="What they wrote">
            {enquiry.message ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{enquiry.message}</p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                They left the message blank. Everything else they told us is on the right.
              </p>
            )}
          </Section>

          <Section
            title="Notes"
            description="For the office. Nothing here is ever shown to the person who wrote in."
          >
            {canWrite && (
              <div className="space-y-2">
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Rang them. Wants the October departure, checking with their sister."
                />
                <Button
                  size="sm"
                  disabled={!note.trim() || patch.isPending}
                  onClick={() => patch.mutate({ note })}
                >
                  {patch.isPending ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <MessageSquarePlus className="mr-1.5 size-3.5" />
                  )}
                  Add a note
                </Button>
              </div>
            )}

            {enquiry.notes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing written down yet.</p>
            ) : (
              <ul className="space-y-3">
                {enquiry.notes.map((row) => (
                  <li key={row.id} className="rounded-lg border bg-muted/30 p-3">
                    <p className="whitespace-pre-wrap text-sm">{row.body}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {row.author?.name ?? 'Somebody'} · {relativeTime(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="What was sent"
            description="Every message this enquiry produced, exactly as it went out. A template edited later does not change this record."
          >
            {enquiry.messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing recorded. The website sends an enquiry’s email and then writes it
                here, so if that is a surprise, check that MAIL_REPORT_SECRET matches on
                both — mail may well have gone out with nothing to show for it.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {enquiry.messages.map((message) => (
                  <li key={message.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{message.subject}</span>
                      <span className="text-xs text-muted-foreground">
                        to {message.toEmail}
                        {message.error && (
                          <span className="text-destructive"> — {message.error}</span>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {humanise(message.status)} · {relativeTime(message.sentAt ?? message.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Handling">
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium">Status</span>
                <Select
                  value={enquiry.status}
                  disabled={!canWrite}
                  onValueChange={(status) => {
                    setEnquiry((current) => ({ ...current, status }));
                    patch.mutate({ status });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {humanise(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium">Priority</span>
                <Select
                  value={enquiry.priority}
                  disabled={!canWrite}
                  onValueChange={(priority) => {
                    setEnquiry((current) => ({ ...current, priority }));
                    patch.mutate({ priority });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium">With</span>
                <Select
                  value={enquiry.assigneeId ?? 'nobody'}
                  disabled={!canWrite}
                  onValueChange={(value) => {
                    const assigneeId = value === 'nobody' ? null : value;
                    setEnquiry((current) => ({ ...current, assigneeId }));
                    patch.mutate({ assigneeId });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nobody">Nobody yet</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
          </Section>

          <Section title="What they told us">
            <dl className="space-y-2 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="min-w-0 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}
