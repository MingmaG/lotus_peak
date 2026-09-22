'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookMarked, Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { toast } from 'sonner';

import { BookingStatusBadge, PaymentStateBadge } from '@/components/bookings/badges';
import { Section } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { apiDelete } from '@/lib/api-client';
import { balanceCents, paymentState } from '@/lib/booking-money';
import { formatDate, formatDateTime, humanise, money, relativeTime } from '@/lib/format';
import { CustomerSheet, type CustomerForm } from './customer-form';

export interface CustomerDetailData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  notes: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  dietary: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  marketingOptIn: boolean;
  createdAt: string;
  bookings: {
    id: string;
    reference: string;
    status: string;
    kind: string;
    startDate: string | null;
    currency: string;
    totalCents: number;
    netPaidCents: number;
    refundedCents: number;
    trip: { title: string } | null;
  }[];
  enquiries: {
    id: string;
    reference: string;
    status: string;
    createdAt: string;
    trip: { title: string } | null;
  }[];
  noteRows: {
    id: string;
    body: string;
    createdAt: string;
    author: { name: string } | null;
  }[];
}

/**
 * One customer, and everything they have ever done.
 *
 * The bookings come first, because the reason somebody opens a customer record
 * is almost always a booking — either to find one, or to check what this person
 * has already travelled on before quoting them for the next.
 */
export function CustomerDetail({
  customer,
  canWrite,
  canDelete,
  canSeeBookings,
}: {
  customer: CustomerDetailData;
  canWrite: boolean;
  canDelete: boolean;
  canSeeBookings: boolean;
}) {
  const router = useRouter();
  const client = useQueryClient();
  const [editing, setEditing] = React.useState(false);

  const destroy = useMutation({
    mutationFn: () => apiDelete(`/api/customers/${customer.id}`),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Hidden');
      router.push('/customers');
    },
    onError: (error: Error) => toast.error(error.message, { duration: 8_000 }),
  });

  const address = [
    customer.addressLine1,
    customer.addressLine2,
    customer.city,
    customer.region,
    customer.postalCode,
    customer.country,
  ].filter(Boolean);

  const form: CustomerForm = {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? '',
    country: customer.country ?? '',
    notes: customer.notes ?? '',
    addressLine1: customer.addressLine1 ?? '',
    addressLine2: customer.addressLine2 ?? '',
    city: customer.city ?? '',
    region: customer.region ?? '',
    postalCode: customer.postalCode ?? '',
    countryCode: customer.countryCode ?? '',
    dateOfBirth: customer.dateOfBirth?.slice(0, 10) ?? '',
    nationality: customer.nationality ?? '',
    passportNumber: customer.passportNumber ?? '',
    passportExpiry: customer.passportExpiry?.slice(0, 10) ?? '',
    dietary: customer.dietary ?? '',
    emergencyContactName: customer.emergencyContactName ?? '',
    emergencyContactPhone: customer.emergencyContactPhone ?? '',
    marketingOptIn: customer.marketingOptIn,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/customers">
            <ArrowLeft className="mr-1.5 size-3.5" />
            All customers
          </Link>
        </Button>

        <div className="flex flex-wrap gap-2">
          {canWrite && canSeeBookings && (
            <Button asChild size="sm">
              <Link href={`/bookings/new?customer=${customer.id}`}>
                <Plus className="mr-1.5 size-3.5" />
                Take a booking
              </Link>
            </Button>
          )}
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="mr-1.5 size-3.5" />
              Edit
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (window.confirm(`Hide ${customer.name}'s record?`)) destroy.mutate();
              }}
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Hide this customer</span>
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 sm:p-5">
        <h1 className="text-xl font-medium tracking-tight">{customer.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Known since {formatDate(customer.createdAt)} · {relativeTime(customer.createdAt)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`mailto:${customer.email}`}>
              <Mail className="mr-1.5 size-3.5" />
              {customer.email}
            </a>
          </Button>
          {customer.phone && (
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${customer.phone}`}>
                <Phone className="mr-1.5 size-3.5" />
                {customer.phone}
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          {canSeeBookings && (
            <Section title="Bookings">
              {customer.bookings.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nothing booked yet.
                </p>
              ) : (
                <ul className="divide-y">
                  {customer.bookings.map((booking) => {
                    const owed = balanceCents(booking);
                    return (
                      <li key={booking.id}>
                        <Link
                          href={`/bookings/${booking.id}`}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 transition-colors hover:text-primary"
                        >
                          <BookMarked
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                            <span className="block text-sm">
                              {booking.trip?.title ?? 'Journey not chosen'}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              <span className="font-mono">{booking.reference}</span>
                              {booking.startDate ? ` · ${formatDate(booking.startDate)}` : ''}
                            </span>
                          </span>
                          <BookingStatusBadge status={booking.status} className="shrink-0" />
                          <span className="shrink-0 text-sm tabular-nums">
                            {money(booking.totalCents, booking.currency)}
                          </span>
                          {owed > 0 ? (
                            <span className="shrink-0 text-xs tabular-nums text-status-attention">
                              {money(owed, booking.currency)} owing
                            </span>
                          ) : (
                            <PaymentStateBadge
                              state={paymentState(booking)}
                              className="shrink-0 text-muted-foreground"
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          )}

          <Section title="Enquiries">
            {customer.enquiries.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Nothing linked to this record.
              </p>
            ) : (
              <ul className="divide-y">
                {customer.enquiries.map((enquiry) => (
                  <li key={enquiry.id}>
                    <Link
                      href={`/enquiries/${enquiry.id}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm transition-colors hover:text-primary"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block">{enquiry.trip?.title ?? 'No journey named'}</span>
                        <span className="block text-xs text-muted-foreground">
                          <span className="font-mono">{enquiry.reference}</span> ·{' '}
                          {formatDate(enquiry.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {humanise(enquiry.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {customer.noteRows.length > 0 && (
            <Section title="Notes">
              <ul className="space-y-3">
                {customer.noteRows.map((row) => (
                  <li key={row.id}>
                    <p className="whitespace-pre-wrap text-sm">{row.body}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.author?.name ?? 'Somebody'} · {formatDateTime(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <aside className="space-y-5">
          <Section title="Where to send an invoice">
            {address.length > 0 ? (
              <address className="not-italic text-sm">
                {address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            ) : (
              <p className="text-sm text-muted-foreground">No address on file.</p>
            )}
          </Section>

          <Section title="For the permit">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Born</dt>
                <dd>{formatDate(customer.dateOfBirth)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Nationality</dt>
                <dd>{customer.nationality ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Passport</dt>
                <dd className="font-mono">{customer.passportNumber ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Expires</dt>
                <dd>{formatDate(customer.passportExpiry)}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Worth knowing">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Dietary</dt>
                <dd className="text-right">{customer.dietary ?? '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Emergency</dt>
                <dd className="text-right">
                  {customer.emergencyContactName
                    ? `${customer.emergencyContactName}${customer.emergencyContactPhone ? ` · ${customer.emergencyContactPhone}` : ''}`
                    : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Newsletter</dt>
                <dd>{customer.marketingOptIn ? 'Asked to hear from us' : 'Has not asked'}</dd>
              </div>
            </dl>
          </Section>

          {customer.notes && (
            <Section title="Notes on file">
              <p className="whitespace-pre-wrap text-sm">{customer.notes}</p>
            </Section>
          )}
        </aside>
      </div>

      <CustomerSheet
        form={form}
        open={editing}
        onOpenChange={setEditing}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
