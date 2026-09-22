'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  BookingEditor,
  blankBooking,
  type EditorOptions,
} from '@/components/bookings/booking-editor';
import type { PickedCustomer } from '@/components/bookings/customer-picker';

interface FromEnquiry {
  id: string;
  tripId: string | null;
  adults: number | null;
  children: number | null;
  source: string | null;
  message: string | null;
}

/**
 * The blank form.
 *
 * A thin client wrapper so the page itself stays a server component: the
 * starting draft carries generated keys for the traveller rows, and a value
 * generated during a server render would not match the one hydration makes.
 *
 * `React.useState(() => …)` and not a plain call — the initial draft is built
 * once. Rebuilding it on a re-render would replace the traveller rows' keys and
 * throw away whatever had been typed into them.
 */
export function NewBooking({
  options,
  customer,
  enquiry,
}: {
  options: EditorOptions;
  customer: PickedCustomer | null;
  enquiry: FromEnquiry | null;
}) {
  const router = useRouter();

  const [initial] = React.useState(() => {
    const draft = blankBooking();
    if (customer) draft.customer = customer;
    if (enquiry) {
      draft.enquiryId = enquiry.id;
      draft.tripId = enquiry.tripId ?? '';
      draft.adults = enquiry.adults ?? draft.adults;
      draft.children = enquiry.children ?? 0;
      draft.source = enquiry.source ?? draft.source;
      /* What they wrote, carried across as what they asked for. It is the
         office's starting point for the itinerary and retyping it from the
         other tab is how half of it gets lost. */
      draft.requests = enquiry.message ?? '';
    }
    return draft;
  });

  return (
    <BookingEditor
      initial={initial}
      options={options}
      onSaved={(id) => router.push(`/bookings/${id}`)}
    />
  );
}
