'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  GripVertical,
  Loader2,
  Plus,
  Ticket,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { Field, Section } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiPatch, apiPost } from '@/lib/api-client';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { CustomerPicker, type PickedCustomer } from './customer-picker';
import { BOOKING_SOURCE, ITEM_KIND, partyLabel } from './labels';
import { MoneyInput } from './money-input';

/* -------------------------------------------------------------------------- */
/*  What the form holds                                                        */
/* -------------------------------------------------------------------------- */

export interface ItemDraft {
  key: string;
  kind: string;
  label: string;
  detail: string;
  quantity: number;
  unitPriceCents: number;
}

export interface TravellerDraft {
  key: string;
  isLead: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  nationality: string;
  passportName: string;
  passportNumber: string;
  passportExpiry: string;
  passportCountry: string;
  dietary: string;
  medical: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  roomPreference: string;
  notes: string;
}

export interface BookingDraft {
  id: string | null;
  kind: string;
  status: string;
  tripId: string;
  departureId: string;
  startDate: string;
  endDate: string;
  customer: PickedCustomer | null;
  enquiryId: string | null;
  adults: number;
  children: number;
  currency: string;
  pricePerPersonCents: number;
  items: ItemDraft[];
  travellers: TravellerDraft[];
  couponCode: string;
  depositDueCents: number | null;
  depositDueAt: string;
  balanceDueAt: string;
  source: string;
  assigneeId: string;
  requests: string;
  internalNotes: string;
  cancellationReason: string;
}

export interface EditorOptions {
  trips: { id: string; title: string; priceFromUsd: number }[];
  departures: {
    id: string;
    tripId: string;
    startDate: string;
    endDate: string;
    priceUsd: number;
    placesLeft: number | null;
    placesTotal: number | null;
  }[];
  users: { id: string; name: string }[];
}

let counter = 0;
const key = () => `draft-${(counter += 1)}`;

export function blankTraveller(isLead = false): TravellerDraft {
  return {
    key: key(),
    isLead,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    nationality: '',
    passportName: '',
    passportNumber: '',
    passportExpiry: '',
    passportCountry: '',
    dietary: '',
    medical: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    roomPreference: '',
    notes: '',
  };
}

export function blankBooking(): BookingDraft {
  return {
    id: null,
    kind: 'PRIVATE',
    status: 'DRAFT',
    tripId: '',
    departureId: '',
    startDate: '',
    endDate: '',
    customer: null,
    enquiryId: null,
    adults: 2,
    children: 0,
    currency: 'USD',
    pricePerPersonCents: 0,
    items: [],
    travellers: [blankTraveller(true)],
    couponCode: '',
    depositDueCents: null,
    depositDueAt: '',
    balanceDueAt: '',
    source: 'EMAIL',
    assigneeId: '',
    requests: '',
    internalNotes: '',
    cancellationReason: '',
  };
}

/* -------------------------------------------------------------------------- */
/*  The totals, mirrored                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The same arithmetic the server does, for the figure under the bill.
 *
 * Mirroring server logic in a client is normally a smell, and it is worth
 * saying why this one is not: the office builds a quote by watching the total
 * move as they add lines, and a round-trip per keystroke to learn what
 * `2 × $4,500` comes to is a form that lags behind the conversation it is being
 * typed during.
 *
 * What stops it drifting is that this figure is never sent. The POST carries
 * the lines and the coupon code; the server prices them and returns its own
 * totals, which is what is stored and what the detail screen reads. If the two
 * ever disagree, the screen shows the server's answer a moment later — a
 * visible correction rather than a wrong invoice.
 */
export function previewTotals(items: ItemDraft[], couponDiscountCents: number) {
  let subtotalCents = 0;
  let lineDiscountCents = 0;
  for (const item of items) {
    const amount = item.quantity * item.unitPriceCents;
    if (item.kind === 'DISCOUNT') lineDiscountCents += amount;
    else subtotalCents += amount;
  }
  const discountCents = Math.min(subtotalCents, lineDiscountCents + couponDiscountCents);
  return {
    subtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents),
  };
}

/* -------------------------------------------------------------------------- */
/*  The editor                                                                 */
/* -------------------------------------------------------------------------- */

export function BookingEditor({
  initial,
  options,
  onSaved,
}: {
  initial: BookingDraft;
  options: EditorOptions;
  /** Where to go afterwards. The new-booking page sends you to the booking. */
  onSaved?: (bookingId: string) => void;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [draft, setDraft] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const patch = (changes: Partial<BookingDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));

  const party = draft.adults + draft.children;
  const departures = options.departures.filter(
    (one) => !draft.tripId || one.tripId === draft.tripId,
  );

  /* ---- the coupon, checked as it is typed ------------------------------- */

  const preview = previewTotals(draft.items, 0);

  const { data: couponVerdict } = useQuery<{
    ok: boolean;
    reason: string | null;
    discountCents: number;
    coupon: { code: string; description: string | null } | null;
  }>({
    queryKey: [
      'coupon-try',
      draft.couponCode.trim().toUpperCase(),
      preview.subtotalCents,
      draft.tripId,
      draft.customer?.id,
    ],
    queryFn: () =>
      apiPost('/api/coupons/try', {
        code: draft.couponCode.trim(),
        subtotalCents: preview.subtotalCents,
        tripId: draft.tripId || null,
        customerId: draft.customer?.id ?? null,
        bookingId: draft.id,
      }),
    enabled: draft.couponCode.trim().length >= 3,
    /* Nothing is redeemed by asking, so a failed check is not worth retrying
       and a stale answer is not worth keeping. */
    retry: false,
    staleTime: 0,
  });

  const couponDiscount = couponVerdict?.ok ? couponVerdict.discountCents : 0;
  const totals = previewTotals(draft.items, couponDiscount);

  /* ---- saving ----------------------------------------------------------- */

  const save = useMutation({
    mutationFn: () => {
      const body = {
        kind: draft.kind,
        status: draft.status,
        tripId: draft.tripId || null,
        departureId: draft.departureId || null,
        startDate: draft.startDate ? new Date(draft.startDate).toISOString() : null,
        endDate: draft.endDate ? new Date(draft.endDate).toISOString() : null,
        customerId: draft.customer?.id ?? '',
        enquiryId: draft.enquiryId,
        adults: draft.adults,
        children: draft.children,
        currency: draft.currency,
        pricePerPersonCents: draft.pricePerPersonCents,
        items: draft.items.map((item) => ({
          kind: item.kind,
          label: item.label,
          detail: item.detail || null,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
        })),
        travellers: draft.travellers
          /* A row somebody added and left empty is not a traveller. Sending it
             would fail validation on the first name and blame a field they
             never meant to fill in. */
          .filter((one) => one.firstName.trim())
          .map((one) => ({
            isLead: one.isLead,
            firstName: one.firstName.trim(),
            lastName: one.lastName.trim(),
            email: one.email.trim() || null,
            phone: one.phone.trim() || null,
            dateOfBirth: one.dateOfBirth || null,
            nationality: one.nationality.trim() || null,
            passportName: one.passportName.trim() || null,
            passportNumber: one.passportNumber.trim() || null,
            passportExpiry: one.passportExpiry || null,
            passportCountry: one.passportCountry.trim() || null,
            dietary: one.dietary.trim() || null,
            medical: one.medical.trim() || null,
            emergencyContactName: one.emergencyContactName.trim() || null,
            emergencyContactPhone: one.emergencyContactPhone.trim() || null,
            roomPreference: one.roomPreference.trim() || null,
            notes: one.notes.trim() || null,
          })),
        couponCode: draft.couponCode.trim() || null,
        depositDueCents: draft.depositDueCents,
        depositDueAt: draft.depositDueAt ? new Date(draft.depositDueAt).toISOString() : null,
        balanceDueAt: draft.balanceDueAt ? new Date(draft.balanceDueAt).toISOString() : null,
        source: draft.source || null,
        assigneeId: draft.assigneeId || null,
        requests: draft.requests || null,
        internalNotes: draft.internalNotes || null,
        cancellationReason: draft.cancellationReason || null,
      };

      return draft.id
        ? apiPatch<{ booking: { id: string } }>(`/api/bookings/${draft.id}`, body)
        : apiPost<{ booking: { id: string } }>('/api/bookings', body);
    },
    onSuccess: (result) => {
      setErrors({});
      void client.invalidateQueries({ queryKey: ['bookings'] });
      void client.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Saved');
      if (onSaved) onSaved(result.booking.id);
      else router.refresh();
    },
    onError: (error: Error & { fields?: Record<string, string> }) => {
      if (error.fields) {
        setErrors(error.fields);
        toast.error('Some fields need attention.');
      } else toast.error(error.message, { duration: 8_000 });
    },
  });

  const canSave = Boolean(draft.customer) && !save.isPending;

  /* ---- lines ------------------------------------------------------------ */

  const addItem = (kind = 'EXTRA') =>
    patch({
      items: [
        ...draft.items,
        { key: key(), kind, label: '', detail: '', quantity: 1, unitPriceCents: 0 },
      ],
    });

  /**
   * The journey line, from the party size and a price per head.
   *
   * The commonest line on every booking, and the one somebody would otherwise
   * type four times a day. Replaces the existing journey line rather than
   * adding a second, because two journey lines on one booking is always a
   * mistake and never a feature.
   */
  const fillJourneyLine = () => {
    const rest = draft.items.filter((item) => item.kind !== 'JOURNEY');
    const trip = options.trips.find((one) => one.id === draft.tripId);
    patch({
      items: [
        {
          key: key(),
          kind: 'JOURNEY',
          label: trip ? trip.title : 'The journey',
          detail: '',
          quantity: party,
          unitPriceCents: draft.pricePerPersonCents,
        },
        ...rest,
      ],
    });
  };

  return (
    <div className="space-y-5 pb-24">
      {/* ------------------------------------------------------------------ */}
      <Section
        title="Who it is for"
        description="The person the office deals with and invoices. Everybody travelling is listed further down — they are often not the same people."
      >
        <Field label="Customer" error={errors.customerId}>
          <CustomerPicker
            value={draft.customer}
            onChange={(customer) => patch({ customer })}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Adults" error={errors.adults}>
            <Input
              type="number"
              min={1}
              value={draft.adults}
              onChange={(event) => patch({ adults: Number(event.target.value) || 1 })}
            />
          </Field>
          <Field label="Children" error={errors.children}>
            <Input
              type="number"
              min={0}
              value={draft.children}
              onChange={(event) => patch({ children: Number(event.target.value) || 0 })}
            />
          </Field>
          <Field label="Party" hint="Solo or a group is this figure, not a setting.">
            <p className="flex h-9 items-center text-sm text-muted-foreground">
              {partyLabel(draft.adults, draft.children)}
            </p>
          </Field>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="What they are booking"
        description="A fixed departure takes its dates from the departure itself, so a booking cannot drift away from the date it is on."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind" error={errors.kind}>
            <Select value={draft.kind} onValueChange={(kind) => patch({ kind })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED_DEPARTURE">On a fixed departure</SelectItem>
                <SelectItem value="PRIVATE">Private — their own dates</SelectItem>
                <SelectItem value="CUSTOM">Made to order</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Journey" error={errors.tripId}>
            <Select
              value={draft.tripId || 'none'}
              onValueChange={(value) =>
                patch({ tripId: value === 'none' ? '' : value, departureId: '' })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not yet chosen</SelectItem>
                {options.trips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {draft.kind === 'FIXED_DEPARTURE' ? (
          <Field
            label="Departure"
            error={errors.departureId}
            hint={
              departures.length === 0
                ? 'This journey has no departures scheduled. Add one on the Departures screen, or take this as a private booking.'
                : 'The dates come from here.'
            }
          >
            <Select
              value={draft.departureId || 'none'}
              onValueChange={(value) => {
                const departure = options.departures.find((one) => one.id === value);
                patch({
                  departureId: value === 'none' ? '' : value,
                  /* Shown straight away rather than waiting for the save to
                     echo them back, so the dates on screen are the ones being
                     agreed on the telephone. */
                  startDate: departure ? departure.startDate.slice(0, 10) : draft.startDate,
                  endDate: departure ? departure.endDate.slice(0, 10) : draft.endDate,
                  tripId: departure ? departure.tripId : draft.tripId,
                  pricePerPersonCents: departure
                    ? departure.priceUsd * 100
                    : draft.pricePerPersonCents,
                });
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose a departure</SelectItem>
                {departures.map((departure) => (
                  <SelectItem key={departure.id} value={departure.id}>
                    {departure.startDate.slice(0, 10)} — {departure.endDate.slice(0, 10)}
                    {departure.placesLeft !== null ? ` · ${departure.placesLeft} left` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" error={errors.startDate}>
              <Input
                type="date"
                value={draft.startDate}
                onChange={(event) => patch({ startDate: event.target.value })}
              />
            </Field>
            <Field label="Ends" error={errors.endDate}>
              <Input
                type="date"
                value={draft.endDate}
                onChange={(event) => patch({ endDate: event.target.value })}
              />
            </Field>
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section
        title="The bill"
        description="Every line as it will appear on the invoice. Amounts are what the traveller pays, per line."
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Price per person" hint="What was agreed per head.">
            <MoneyInput
              cents={draft.pricePerPersonCents}
              onCents={(pricePerPersonCents) => patch({ pricePerPersonCents })}
            />
          </Field>
          <Field label="&nbsp;" className="self-start">
            <Button type="button" variant="outline" onClick={fillJourneyLine}>
              Make that the journey line
            </Button>
          </Field>
        </div>

        <ul className="space-y-3">
          {draft.items.map((item, index) => (
            <li
              key={item.key}
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-[130px_1fr_70px_130px_auto]"
            >
              <Select
                value={item.kind}
                onValueChange={(kind) =>
                  patch({
                    items: draft.items.map((one, i) => (i === index ? { ...one, kind } : one)),
                  })
                }
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ITEM_KIND).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={item.label}
                placeholder="What this line is for"
                aria-label="Line description"
                onChange={(event) =>
                  patch({
                    items: draft.items.map((one, i) =>
                      i === index ? { ...one, label: event.target.value } : one,
                    ),
                  })
                }
              />

              <Input
                type="number"
                min={1}
                value={item.quantity}
                aria-label="Quantity"
                className="tabular-nums"
                onChange={(event) =>
                  patch({
                    items: draft.items.map((one, i) =>
                      i === index
                        ? { ...one, quantity: Math.max(1, Number(event.target.value) || 1) }
                        : one,
                    ),
                  })
                }
              />

              <MoneyInput
                cents={item.unitPriceCents}
                onCents={(unitPriceCents) =>
                  patch({
                    items: draft.items.map((one, i) =>
                      i === index ? { ...one, unitPriceCents } : one,
                    ),
                  })
                }
              />

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <span
                  className={cn(
                    'text-sm tabular-nums',
                    item.kind === 'DISCOUNT' && 'text-status-published',
                  )}
                >
                  {/* A discount is stored positive and shown with a minus, so
                      the column reads the way an invoice does without a
                      negative number being anywhere in the database. */}
                  {item.kind === 'DISCOUNT' ? '−' : ''}
                  {money(item.quantity * item.unitPriceCents, draft.currency)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove this line"
                  onClick={() =>
                    patch({ items: draft.items.filter((_, i) => i !== index) })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => addItem('EXTRA')}>
            <Plus className="mr-1.5 size-3.5" />
            A line
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addItem('SUPPLEMENT')}>
            <Plus className="mr-1.5 size-3.5" />
            A supplement
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addItem('DISCOUNT')}>
            <Plus className="mr-1.5 size-3.5" />
            A discount
          </Button>
        </div>

        <Field
          label="Coupon"
          error={errors.couponCode}
          hint="Checked as you type. Nothing is redeemed until the booking is saved."
        >
          <div className="flex items-start gap-2">
            <div className="relative flex-1">
              <Ticket className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={draft.couponCode}
                className="pl-8.5 font-mono uppercase"
                placeholder="SPRING26"
                onChange={(event) => patch({ couponCode: event.target.value })}
              />
            </div>
          </div>
          {draft.couponCode.trim().length >= 3 && couponVerdict && (
            <p
              className={cn(
                'text-xs',
                couponVerdict.ok ? 'text-status-published' : 'text-status-attention',
              )}
            >
              {couponVerdict.ok
                ? `${couponVerdict.coupon?.code} takes off ${money(couponVerdict.discountCents, draft.currency)}.`
                : couponVerdict.reason}
            </p>
          )}
        </Field>

        <dl className="ml-auto w-full max-w-xs space-y-1.5 border-t pt-3 text-sm sm:w-64">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular-nums">{money(totals.subtotalCents, draft.currency)}</dd>
          </div>
          {totals.discountCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular-nums text-status-published">
                −{money(totals.discountCents, draft.currency)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-1.5 font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(totals.totalCents, draft.currency)}</dd>
          </div>
        </dl>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <TravellersSection
        travellers={draft.travellers}
        party={party}
        error={errors.travellers}
        onChange={(travellers) => patch({ travellers })}
      />

      {/* ------------------------------------------------------------------ */}
      <Section
        title="Terms"
        description="What is due and when. Nothing here chases anybody automatically — it is what the Payments screen measures against."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Deposit due">
            <MoneyInput
              cents={draft.depositDueCents ?? 0}
              onCents={(depositDueCents) => patch({ depositDueCents })}
            />
          </Field>
          <Field label="Deposit due by">
            <Input
              type="date"
              value={draft.depositDueAt}
              onChange={(event) => patch({ depositDueAt: event.target.value })}
            />
          </Field>
          <Field label="Balance due by">
            <Input
              type="date"
              value={draft.balanceDueAt}
              onChange={(event) => patch({ balanceDueAt: event.target.value })}
            />
          </Field>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="The office" description="Where it stands, and who is looking after it.">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status" error={errors.status}>
            <Select value={draft.status} onValueChange={(status) => patch({ status })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft — not offered yet</SelectItem>
                <SelectItem value="PROVISIONAL">Held — waiting on a deposit</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="COMPLETED">Travelled</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Looked after by">
            <Select
              value={draft.assigneeId || 'nobody'}
              onValueChange={(value) =>
                patch({ assigneeId: value === 'nobody' ? '' : value })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nobody">Nobody yet</SelectItem>
                {options.users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Came from">
            <Select value={draft.source} onValueChange={(source) => patch({ source })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(BOOKING_SOURCE).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {draft.status === 'CANCELLED' && (
          <Field
            label="Why it was cancelled"
            error={errors.cancellationReason}
            hint="Required, because six months later nobody remembers."
          >
            <Input
              value={draft.cancellationReason}
              onChange={(event) => patch({ cancellationReason: event.target.value })}
            />
          </Field>
        )}

        <Field
          label="What they asked for"
          hint="Read out to the guide. A ground-floor room, no early starts."
        >
          <Textarea
            rows={3}
            value={draft.requests}
            onChange={(event) => patch({ requests: event.target.value })}
          />
        </Field>

        <Field label="Office notes" hint="Never printed on anything a traveller sees.">
          <Textarea
            rows={3}
            value={draft.internalNotes}
            onChange={(event) => patch({ internalNotes: event.target.value })}
          />
        </Field>
      </Section>

      {/**
       * The save bar sticks to the bottom.
       *
       * This form is long enough to scroll several screens, and a Save button
       * at the end of it is a button somebody has to go looking for after every
       * change.
       */}
      {/* The negative margin bleeds this to the edges, so it has to be the
          shell's own padding — `px-3 sm:px-5 lg:px-8` on `<main>` in
          `layout/app-shell.tsx`. It was `-mx-4 sm:-mx-6` and overhung by 4px,
          which is invisible to look at and makes the whole page scroll
          sideways on a phone. If the shell's padding changes, this changes. */}
      <div className="sticky bottom-0 -mx-3 flex items-center justify-between gap-3 border-t bg-background/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8">
        <p className="text-xs text-muted-foreground">
          {draft.customer
            ? `${money(totals.totalCents, draft.currency)} · ${partyLabel(draft.adults, draft.children)}`
            : 'Choose a customer to save this booking.'}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="button" onClick={() => save.mutate()} disabled={!canSave}>
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {draft.id ? 'Save' : 'Take the booking'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Travellers                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Who is actually going.
 *
 * Collapsed to a name and a passport number per person, expanding to the rest.
 * Bhutan wants a passport number, a date of birth and a nationality per visitor
 * before it issues the permit, and the office collects those weeks after the
 * deposit — so the fields have to be here and must not be in the way on the
 * day the booking is taken.
 */
function TravellersSection({
  travellers,
  party,
  error,
  onChange,
}: {
  travellers: TravellerDraft[];
  party: number;
  error?: string;
  onChange: (next: TravellerDraft[]) => void;
}) {
  const [open, setOpen] = React.useState<string | null>(travellers[0]?.key ?? null);

  const update = (index: number, changes: Partial<TravellerDraft>) =>
    onChange(travellers.map((one, i) => (i === index ? { ...one, ...changes } : one)));

  return (
    <Section
      title="Who is travelling"
      description={`${travellers.length} named of a party of ${party}. Passport details can wait — the permit needs them, the deposit does not.`}
    >
      {error && <p className="text-xs text-destructive">{error}</p>}

      <ul className="space-y-2">
        {travellers.map((traveller, index) => {
          const expanded = open === traveller.key;
          const name = [traveller.firstName, traveller.lastName].filter(Boolean).join(' ');

          return (
            <li key={traveller.key} className="rounded-md border">
              <div className="flex items-center gap-2 p-2">
                <GripVertical className="size-4 shrink-0 text-muted-foreground/40" aria-hidden />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => setOpen(expanded ? null : traveller.key)}
                  aria-expanded={expanded}
                >
                  <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {name || <span className="text-muted-foreground">Somebody new</span>}
                    {traveller.isLead && (
                      <span className="ml-2 text-xs text-muted-foreground">lead</span>
                    )}
                  </span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {traveller.passportNumber || 'no passport yet'}
                  </span>
                  <ChevronDown
                    className={cn(
                      'size-4 shrink-0 text-muted-foreground transition-transform',
                      expanded && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${name || 'this traveller'}`}
                  onClick={() => onChange(travellers.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              {expanded && (
                <div className="space-y-4 border-t p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="First name">
                      <Input
                        value={traveller.firstName}
                        onChange={(event) => update(index, { firstName: event.target.value })}
                      />
                    </Field>
                    <Field label="Last name">
                      <Input
                        value={traveller.lastName}
                        onChange={(event) => update(index, { lastName: event.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Email">
                      <Input
                        type="email"
                        value={traveller.email}
                        onChange={(event) => update(index, { email: event.target.value })}
                      />
                    </Field>
                    <Field label="Telephone">
                      <Input
                        value={traveller.phone}
                        onChange={(event) => update(index, { phone: event.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Date of birth">
                      <Input
                        type="date"
                        value={traveller.dateOfBirth}
                        onChange={(event) => update(index, { dateOfBirth: event.target.value })}
                      />
                    </Field>
                    <Field label="Nationality">
                      <Input
                        value={traveller.nationality}
                        onChange={(event) => update(index, { nationality: event.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Passport number"
                      hint="Bhutan needs this before it issues the permit."
                    >
                      <Input
                        value={traveller.passportNumber}
                        className="font-mono"
                        onChange={(event) =>
                          update(index, { passportNumber: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="Passport expires">
                      <Input
                        type="date"
                        value={traveller.passportExpiry}
                        onChange={(event) =>
                          update(index, { passportExpiry: event.target.value })
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Name as printed"
                      hint="When it is not simply first name and last name."
                    >
                      <Input
                        value={traveller.passportName}
                        onChange={(event) => update(index, { passportName: event.target.value })}
                      />
                    </Field>
                    <Field label="Issued by">
                      <Input
                        value={traveller.passportCountry}
                        onChange={(event) =>
                          update(index, { passportCountry: event.target.value })
                        }
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Dietary">
                      <Input
                        value={traveller.dietary}
                        onChange={(event) => update(index, { dietary: event.target.value })}
                      />
                    </Field>
                    <Field label="Room">
                      <Input
                        value={traveller.roomPreference}
                        placeholder="Twin with Dorji"
                        onChange={(event) =>
                          update(index, { roomPreference: event.target.value })
                        }
                      />
                    </Field>
                  </div>

                  <Field
                    label="Medical"
                    hint="What the guide has to know about at 4,000 metres."
                  >
                    <Textarea
                      rows={2}
                      value={traveller.medical}
                      onChange={(event) => update(index, { medical: event.target.value })}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="In an emergency, call">
                      <Input
                        value={traveller.emergencyContactName}
                        onChange={(event) =>
                          update(index, { emergencyContactName: event.target.value })
                        }
                      />
                    </Field>
                    <Field label="On">
                      <Input
                        value={traveller.emergencyContactPhone}
                        onChange={(event) =>
                          update(index, { emergencyContactPhone: event.target.value })
                        }
                      />
                    </Field>
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="lead-traveller"
                      checked={traveller.isLead}
                      onChange={() =>
                        /* A radio, not a tick box: there is exactly one lead,
                           and the API refuses two. Making it a tick box would
                           let somebody build a state the server rejects. */
                        onChange(
                          travellers.map((one, i) => ({ ...one, isLead: i === index })),
                        )
                      }
                    />
                    This is the lead traveller
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const next = blankTraveller(travellers.length === 0);
          onChange([...travellers, next]);
          setOpen(next.key);
        }}
      >
        <Plus className="mr-1.5 size-3.5" />
        Another traveller
      </Button>
    </Section>
  );
}
