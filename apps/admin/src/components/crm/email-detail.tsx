import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { Section } from '@/components/shared/editor-shell';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { EVENT_MEANING, STATUS_MEANING, STATUS_TONE } from '@/lib/email-status';
import { formatDateTime, humanise, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * One message, and everything that became of it.
 *
 * The list answers "what went out"; this answers "did it arrive, and what did
 * it say". Both questions are the office's, and the second one is the reason
 * the delivery webhook exists — a message that bounced looks exactly like a
 * traveller who did not reply until somebody can see the bounce.
 *
 * Read-only on purpose. Nothing here can be edited, resent or deleted: it is
 * the record of what somebody received, and a record that can be changed
 * afterwards answers the question wrongly.
 */

export interface EmailDetailData {
  id: string;
  kind: string;
  subject: string;
  toEmail: string;
  toName: string | null;
  fromEmail: string;
  replyTo: string | null;
  status: string;
  providerId: string | null;
  error: string | null;
  attempts: number;
  html: string;
  text: string;
  createdAt: string;
  sentAt: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  failedAt: string | null;
  enquiry: { id: string; reference: string; name: string } | null;
  template: { id: string; name: string } | null;
  events: {
    id: string;
    type: string;
    status: string | null;
    occurredAt: string;
    createdAt: string;
  }[];
}

interface Moment {
  at: string;
  label: string;
  detail: string;
  /** True for the ones this panel wrote itself, before any notice arrived. */
  ours: boolean;
  tone?: string;
}

/**
 * The history, as one list.
 *
 * The provider's events alone would start at "delivered" and leave the office
 * wondering when the message was written; the message's own timestamps alone
 * stop at "sent". Merged and sorted oldest first, it reads as what happened.
 */
function history(message: EmailDetailData): Moment[] {
  const moments: Moment[] = [
    {
      at: message.createdAt,
      label: 'Written down',
      detail: 'The website rendered it and recorded it here.',
      ours: true,
    },
  ];

  if (message.sentAt) {
    moments.push({
      at: message.sentAt,
      label: 'Handed to Resend',
      detail: 'Accepted by the provider. Acceptance is not arrival.',
      ours: true,
    });
  }

  if (!message.sentAt && message.failedAt) {
    moments.push({
      at: message.failedAt,
      label: message.status === 'SKIPPED' ? 'Not attempted' : 'The send failed',
      detail: message.error ?? 'No reason was recorded.',
      ours: true,
      tone: 'text-destructive',
    });
  }

  for (const event of message.events) {
    moments.push({
      at: event.occurredAt,
      label: humanise(event.type.replace(/^email\./, '')),
      detail: EVENT_MEANING[event.type] ?? event.type,
      ours: false,
      tone: event.status ? STATUS_TONE[event.status] : undefined,
    });
  }

  return moments.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export function EmailDetail({
  message,
  webhookConfigured,
}: {
  message: EmailDetailData;
  webhookConfigured: boolean;
}) {
  const moments = history(message);

  return (
    <>
      <PageHeader
        title={message.subject}
        description={`${humanise(message.kind)} · to ${
          message.toName ? `${message.toName} <${message.toEmail}>` : message.toEmail
        }`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/emails">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Email
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Section
            title="What became of it"
            description="What this panel wrote down, and every notice Resend has sent since. Oldest first."
          >
            <ol className="space-y-3">
              {moments.map((moment, index) => (
                <li key={`${moment.at}-${index}`} className="flex gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      moment.ours ? 'bg-muted-foreground/40' : 'bg-foreground/70',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', moment.tone)}>{moment.label}</span>
                    <span className="block text-xs text-muted-foreground">{moment.detail}</span>
                  </span>
                  <span
                    className="shrink-0 whitespace-nowrap text-xs text-muted-foreground"
                    title={formatDateTime(moment.at)}
                  >
                    {relativeTime(moment.at)}
                  </span>
                </li>
              ))}
            </ol>

            {!webhookConfigured && (
              <p className="rounded-lg border border-status-attention/40 bg-status-attention/5 p-3 text-xs text-muted-foreground">
                This history stops at “Sent”, which only means Resend accepted the message.{' '}
                <code className="rounded bg-muted px-1 py-0.5">RESEND_WEBHOOK_SECRET</code> is not
                set, so a delivery, a bounce or a spam complaint is never recorded — and a wrong
                address looks exactly like a traveller who did not reply.
              </p>
            )}

            {webhookConfigured && message.events.length === 0 && message.sentAt && (
              <p className="text-xs text-muted-foreground">
                Nothing further yet. Resend’s notices arrive within a minute or two of a message
                being delivered, opened or refused.
              </p>
            )}
          </Section>

          <Section
            title="What they received"
            description="Kept verbatim. A template edited later does not change this."
          >
            {/* Sandboxed to nothing: this is stored content, and the panel must
                not run it whatever it turns out to contain. */}
            <iframe
              title="The message as it was sent"
              srcDoc={message.html}
              sandbox=""
              className="h-[32rem] w-full rounded-lg border bg-white"
            />
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                The plain-text part — what a phone notification and a screen reader quote
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-xs">
                {message.text}
              </pre>
            </details>
          </Section>
        </div>

        <div className="space-y-5">
          <Section title="Where it stands">
            <p className={cn('text-sm', STATUS_TONE[message.status] ?? 'text-muted-foreground')}>
              {humanise(message.status)}
            </p>
            <p className="text-xs text-muted-foreground">
              {STATUS_MEANING[message.status] ?? 'No description for this status.'}
            </p>
            {message.error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                {message.error}
              </p>
            )}
          </Section>

          <Section title="The record">
            <dl className="space-y-2 text-xs">
              <Fact label="From" value={message.fromEmail} />
              <Fact label="To" value={message.toEmail} />
              <Fact
                label="Reply goes to"
                value={message.replyTo}
                hint="On a notification this is the traveller, which is what makes Reply work."
              />
              <Fact label="Wording" value={message.template?.name ?? 'Not from a saved template'} />
              <Fact
                label="Attempts"
                value={String(message.attempts)}
                hint="Counted on the handover, so a send that hung and was tried again reads as two."
              />
              <Fact
                label="Resend’s id"
                value={message.providerId}
                hint="What a delivery notice quotes. Without it this message has no later history."
              />
              <Fact label="Written down" value={formatDateTime(message.createdAt)} />
            </dl>

            {message.enquiry && (
              <Link
                href={`/enquiries/${message.enquiry.id}`}
                className="block text-xs hover:underline"
              >
                About enquiry {message.enquiry.reference} — {message.enquiry.name}
              </Link>
            )}

            {!message.enquiry && (
              <p className="text-xs text-muted-foreground">
                Not attached to an enquiry. That happens when the website sent it while this panel
                could not be reached to record the enquiry itself — the message is the only copy,
                and its own text says so.
              </p>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words">{value || <span className="text-muted-foreground">—</span>}</dd>
      {hint && <dd className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</dd>}
    </div>
  );
}
