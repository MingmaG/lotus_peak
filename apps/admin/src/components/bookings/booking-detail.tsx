'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  CircleDollarSign,
  Loader2,
  Mail,
  MessageSquarePlus,
  Pencil,
  Phone,
  Trash2,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Section } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client';
import { balanceCents, paymentState } from '@/lib/booking-money';
import { formatDate, formatDateTime, money, relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BookingStatusBadge, PaymentStateBadge, PaymentStatusBadge } from './badges';
import {
  BOOKING_KIND,
  BOOKING_SOURCE,
  ITEM_KIND,
  PAYMENT_KIND,
  PAYMENT_METHOD,
  partyLabel,
} from './labels';
import { RecordPayment } from './record-payment';

export interface BookingDetailData {
  id: string;
  reference: string;
  kind: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  adults: number;
  children: number;
  currency: string;
  pricePerPersonCents: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  netPaidCents: number;
  refundedCents: number;
  couponCode: string | null;
  depositDueCents: number | null;
  depositDueAt: string | null;
  balanceDueAt: string | null;
  source: string | null;
  requests: string | null;
  internalNotes: string | null;
  cancellationReason: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  trip: { id: string; title: string; slug: string } | null;
  departure: { id: string; startDate: string; endDate: string; status: string } | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
  };
  assignee: { id: string; name: string } | null;
  enquiry: { id: string; reference: string } | null;
  items: {
    id: string;
    kind: string;
    label: string;
    detail: string | null;
    quantity: number;
    unitPriceCents: number;
    amountCents: number;
  }[];
  travellers: {
    id: string;
    isLead: boolean;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    passportNumber: string | null;
    passportExpiry: string | null;
    passportCountry: string | null;
    dietary: string | null;
    medical: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    roomPreference: string | null;
    notes: string | null;
  }[];
  payments: {
    id: string;
    reference: string;
    direction: string;
    kind: string;
    status: string;
    method: string;
    amountCents: number;
    currency: string;
    feeCents: number;
    providerRef: string | null;
    paidAt: string;
    notes: string | null;
    recordedBy: { id: string; name: string } | null;
  }[];
  noteRows: {
    id: string;
    body: string;
    createdAt: string;
    author: { name: string } | null;
  }[];
}

/**
 * One booking.
 *
 * Built around the two things somebody does with an open booking: take money
 * against it, and write down what just happened on the telephone. Everything
 * else — the itinerary, the passport numbers, the terms — is reference material
 * arranged so it can be read out, and edited on the form behind the Edit
 * button rather than in place.
 *
 * Editing in place was the first design and it was wrong: a booking's total is
 * computed from its lines and its coupon together, so a field that saves on
 * blur means a total that is briefly wrong on the screen somebody is reading
 * the figure off. The form saves the whole bill at once.
 */
export function BookingDetail({
  booking: initial,
  canWrite,
  canDelete,
  canTakePayments,
}: {
  booking: BookingDetailData;
  canWrite: boolean;
  canDelete: boolean;
  canTakePayments: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [note, setNote] = React.useState('');
  const [paying, setPaying] = React.useState(false);

  /* Seeded from the server render, then kept fresh by the mutations below —
     recording a payment moves the paid total, and the figure at the top of
     this screen is the one somebody is about to read out. */
  const { data } = useQuery<{ booking: BookingDetailData }>({
    queryKey: ['booking', initial.id],
    queryFn: () => apiGet(`/api/bookings/${initial.id}`),
    initialData: { booking: initial },
  });
  const booking = data.booking;

  const owed = balanceCents(booking);
  const state = paymentState(booking);

  const addNote = useMutation({
    mutationFn: () => apiPost(`/api/bookings/${booking.id}/notes`, { body: note.trim() }),
    onSuccess: () => {
      setNote('');
      void client.invalidateQueries({ queryKey: ['booking', booking.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /**
   * Voiding is a status, not a delete.
   *
   * `DELETE /api/payments/:id` hides the row, and a hidden row is not what the
   * sentence under this list promises — it says a voided payment stays on it,
   * and a mis-keyed amount that vanishes takes the explanation of the total
   * with it. `CANCELLED` stops it counting towards what has been paid and
   * leaves it legible. The delete endpoint is still there for an erasure
   * request, behind `payments.delete`.
   */
  const voidPayment = useMutation({
    mutationFn: (id: string) => apiPatch(`/api/payments/${id}`, { status: 'CANCELLED' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['booking', booking.id] });
      void client.invalidateQueries({ queryKey: ['bookings'] });
      void client.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Voided. It stays on the ledger.');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const destroy = useMutation({
    mutationFn: () => apiDelete(`/api/bookings/${booking.id}`),
    onSuccess: () => {
      toast.success('Hidden');
      router.push('/bookings');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const facts: [string, React.ReactNode][] = [
    ['Reference', <span key="r" className="font-mono">{booking.reference}</span>],
    ['Kind', BOOKING_KIND[booking.kind] ?? booking.kind],
    ['Journey', booking.trip?.title ?? 'Not yet chosen'],
    [
      'When',
      booking.startDate
        ? `${formatDate(booking.startDate)} – ${formatDate(booking.endDate)}`
        : 'Dates to agree',
    ],
    ['Party', partyLabel(booking.adults, booking.children)],
    ['Taken', `${formatDate(booking.createdAt)} · ${relativeTime(booking.createdAt)}`],
    ['Came from', booking.source ? (BOOKING_SOURCE[booking.source] ?? booking.source) : '—'],
    ['Looked after by', booking.assignee?.name ?? 'Nobody yet'],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/bookings">
            <ArrowLeft className="mr-1.5 size-3.5" />
            All bookings
          </Link>
        </Button>

        <div className="flex flex-wrap gap-2">
          {canTakePayments && (
            <Button size="sm" onClick={() => setPaying(true)}>
              <CircleDollarSign className="mr-1.5 size-3.5" />
              Record a payment
            </Button>
          )}
          {canWrite && (
            <Button asChild size="sm" variant="outline">
              <Link href={`/bookings/${booking.id}/edit`}>
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Link>
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (window.confirm('Hide this booking? Cancelling it is usually what you want.')) {
                  destroy.mutate();
                }
              }}
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Hide this booking</span>
            </Button>
          )}
        </div>
      </div>

      {/* ---- the headline figures -------------------------------------- */}
      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-medium tracking-tight">{booking.customer.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {booking.trip?.title ?? 'Journey not yet chosen'} ·{' '}
              {partyLabel(booking.adults, booking.children)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <BookingStatusBadge status={booking.status} />
              <PaymentStateBadge state={state} />
            </div>
          </div>

          <dl className="flex flex-wrap gap-x-6 gap-y-2">
            <div>
              <dt className="text-xs text-muted-foreground">Total</dt>
              <dd className="text-lg tabular-nums">
                {money(booking.totalCents, booking.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Received</dt>
              <dd className="text-lg tabular-nums">
                {money(booking.netPaidCents, booking.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {owed >= 0 ? 'Outstanding' : 'Overpaid by'}
              </dt>
              <dd
                className={cn(
                  'text-lg tabular-nums',
                  owed > 0 && 'text-status-attention',
                  owed < 0 && 'text-status-attention',
                )}
              >
                {money(Math.abs(owed), booking.currency)}
              </dd>
            </div>
          </dl>
        </div>

        {booking.status === 'CANCELLED' && booking.cancellationReason && (
          <p className="mt-4 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Cancelled {formatDate(booking.cancelledAt)} — {booking.cancellationReason}
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {/* ---- the bill ------------------------------------------------ */}
          <Section title="The bill">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="pb-2 font-medium">What</th>
                    <th scope="col" className="pb-2 text-right font-medium">Each</th>
                    <th scope="col" className="pb-2 text-right font-medium">Qty</th>
                    <th scope="col" className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {booking.items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-muted-foreground">
                        No lines yet.
                      </td>
                    </tr>
                  )}
                  {booking.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2">
                        <span className="block">{item.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {ITEM_KIND[item.kind] ?? item.kind}
                          {item.detail ? ` · ${item.detail}` : ''}
                        </span>
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {money(item.unitPriceCents, booking.currency)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {item.quantity}
                      </td>
                      <td
                        className={cn(
                          'py-2 text-right tabular-nums',
                          item.kind === 'DISCOUNT' && 'text-status-published',
                        )}
                      >
                        {item.kind === 'DISCOUNT' ? '−' : ''}
                        {money(item.amountCents, booking.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto w-full max-w-xs space-y-1.5 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="tabular-nums">
                  {money(booking.subtotalCents, booking.currency)}
                </dd>
              </div>
              {booking.discountCents > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">
                    Discount{booking.couponCode ? ` · ${booking.couponCode}` : ''}
                  </dt>
                  <dd className="tabular-nums text-status-published">
                    −{money(booking.discountCents, booking.currency)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5 font-medium">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(booking.totalCents, booking.currency)}</dd>
              </div>
            </dl>
          </Section>

          {/* ---- the payments -------------------------------------------- */}
          <Section
            title="Payments"
            description="Every transaction against this booking. A voided payment stays on the list — a ledger that can lose a row is not a ledger."
          >
            {booking.payments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nothing has been paid yet.
              </p>
            ) : (
              <ul className="divide-y">
                {booking.payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                    <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                      <p className="text-sm">
                        {PAYMENT_KIND[payment.kind] ?? payment.kind}
                        <span className="text-muted-foreground">
                          {' '}
                          · {PAYMENT_METHOD[payment.method] ?? payment.method}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{payment.reference}</span> ·{' '}
                        {formatDate(payment.paidAt)}
                        {payment.providerRef ? ` · ${payment.providerRef}` : ''}
                        {payment.recordedBy ? ` · ${payment.recordedBy.name}` : ''}
                      </p>
                      {payment.notes && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{payment.notes}</p>
                      )}
                    </div>

                    <span
                      className={cn(
                        'shrink-0 text-sm tabular-nums',
                        payment.direction === 'OUT' && 'text-status-attention',
                        /* Struck through when it no longer counts, so the
                           column of figures adds up to the total above it. */
                        payment.status !== 'COMPLETED' &&
                          'text-muted-foreground line-through',
                      )}
                    >
                      {payment.direction === 'OUT' ? '−' : '+'}
                      {money(payment.amountCents, payment.currency)}
                    </span>

                    <PaymentStatusBadge status={payment.status} className="shrink-0" />

                    {canTakePayments && payment.status !== 'CANCELLED' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Void payment ${payment.reference}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              'Void this payment? It stops counting towards the total and stays on the ledger.',
                            )
                          ) {
                            voidPayment.mutate(payment.id);
                          }
                        }}
                      >
                        <Undo2 className="size-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canTakePayments && (
              <Button variant="outline" size="sm" onClick={() => setPaying(true)}>
                <CircleDollarSign className="mr-1.5 size-3.5" />
                Record a payment
              </Button>
            )}
          </Section>

          {/* ---- who is travelling ---------------------------------------- */}
          <Section
            title="Who is travelling"
            description={`${booking.travellers.length} named of a party of ${booking.adults + booking.children}.`}
          >
            {booking.travellers.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nobody named yet.
              </p>
            ) : (
              <ul className="divide-y">
                {booking.travellers.map((traveller) => (
                  <li key={traveller.id} className="py-3">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-sm font-medium">
                        {[traveller.firstName, traveller.lastName].filter(Boolean).join(' ')}
                      </p>
                      {traveller.isLead && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <BadgeCheck className="size-3" aria-hidden />
                          lead
                        </span>
                      )}
                    </div>

                    <dl className="mt-1 grid gap-x-6 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                      {traveller.passportNumber && (
                        <div className="flex gap-1.5">
                          <dt>Passport</dt>
                          <dd className="font-mono">
                            {traveller.passportNumber}
                            {traveller.passportExpiry
                              ? ` · expires ${formatDate(traveller.passportExpiry)}`
                              : ''}
                          </dd>
                        </div>
                      )}
                      {traveller.nationality && (
                        <div className="flex gap-1.5">
                          <dt>Nationality</dt>
                          <dd>{traveller.nationality}</dd>
                        </div>
                      )}
                      {traveller.dateOfBirth && (
                        <div className="flex gap-1.5">
                          <dt>Born</dt>
                          <dd>{formatDate(traveller.dateOfBirth)}</dd>
                        </div>
                      )}
                      {traveller.roomPreference && (
                        <div className="flex gap-1.5">
                          <dt>Room</dt>
                          <dd>{traveller.roomPreference}</dd>
                        </div>
                      )}
                      {traveller.dietary && (
                        <div className="flex gap-1.5">
                          <dt>Diet</dt>
                          <dd>{traveller.dietary}</dd>
                        </div>
                      )}
                      {traveller.emergencyContactName && (
                        <div className="flex gap-1.5">
                          <dt>Emergency</dt>
                          <dd>
                            {traveller.emergencyContactName}
                            {traveller.emergencyContactPhone
                              ? ` · ${traveller.emergencyContactPhone}`
                              : ''}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {traveller.medical && (
                      /* Given its own line and not folded into the grid: it is
                         the one thing on this screen a guide has to read. */
                      <p className="mt-1.5 text-xs text-status-attention">
                        Medical — {traveller.medical}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* ---- notes ---------------------------------------------------- */}
          <Section
            title="Notes"
            description="What happened, so anybody in the office can pick up the conversation."
          >
            {canWrite && (
              <div className="space-y-2">
                <Textarea
                  rows={3}
                  value={note}
                  placeholder="Rang about the visa; will send passport scans on Tuesday."
                  onChange={(event) => setNote(event.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!note.trim() || addNote.isPending}
                  onClick={() => addNote.mutate()}
                >
                  {addNote.isPending ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <MessageSquarePlus className="mr-1.5 size-3.5" />
                  )}
                  Add the note
                </Button>
              </div>
            )}

            {booking.noteRows.length > 0 && (
              <ul className="space-y-3 border-t pt-3">
                {booking.noteRows.map((row) => (
                  <li key={row.id}>
                    <p className="whitespace-pre-wrap text-sm">{row.body}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.author?.name ?? 'Somebody'} · {formatDateTime(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* ---- the aside ------------------------------------------------- */}
        <aside className="space-y-5">
          <Section title="The facts">
            <dl className="space-y-2 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="shrink-0 text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section title="Who to contact">
            <p className="text-sm font-medium">{booking.customer.name}</p>
            <p className="text-xs text-muted-foreground">
              {booking.customer.country ?? 'Country not recorded'}
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" size="sm" className="justify-start">
                <a href={`mailto:${booking.customer.email}?subject=${encodeURIComponent(`Your booking — ${booking.reference}`)}`}>
                  <Mail className="mr-1.5 size-3.5" />
                  <span className="truncate">{booking.customer.email}</span>
                </a>
              </Button>
              {booking.customer.phone && (
                <Button asChild variant="outline" size="sm" className="justify-start">
                  <a href={`tel:${booking.customer.phone}`}>
                    <Phone className="mr-1.5 size-3.5" />
                    {booking.customer.phone}
                  </a>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="justify-start">
                <Link href={`/customers/${booking.customer.id}`}>Their whole record</Link>
              </Button>
            </div>
          </Section>

          <Section title="Terms">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Deposit</dt>
                <dd className="tabular-nums">
                  {booking.depositDueCents
                    ? money(booking.depositDueCents, booking.currency)
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Deposit by</dt>
                <dd>{formatDate(booking.depositDueAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Balance by</dt>
                <dd>{formatDate(booking.balanceDueAt)}</dd>
              </div>
            </dl>
          </Section>

          {booking.requests && (
            <Section title="What they asked for">
              <p className="whitespace-pre-wrap text-sm">{booking.requests}</p>
            </Section>
          )}

          {booking.internalNotes && (
            <Section title="Office notes" description="Never printed for a traveller.">
              <p className="whitespace-pre-wrap text-sm">{booking.internalNotes}</p>
            </Section>
          )}

          {booking.enquiry && (
            <Section title="Where it came from">
              <Button asChild variant="outline" size="sm" className="w-full justify-start">
                <Link href={`/enquiries/${booking.enquiry.id}`}>
                  Enquiry {booking.enquiry.reference}
                </Link>
              </Button>
            </Section>
          )}
        </aside>
      </div>

      <RecordPayment
        bookingId={booking.id}
        currency={booking.currency}
        outstandingCents={Math.max(0, owed)}
        open={paying}
        onOpenChange={setPaying}
      />
    </div>
  );
}
