'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import {
  BookingEditor,
  type BookingDraft,
  type EditorOptions,
} from '@/components/bookings/booking-editor';

interface Loaded {
  id: string;
  kind: string;
  status: string;
  tripId: string | null;
  departureId: string | null;
  startDate: string | null;
  endDate: string | null;
  enquiryId: string | null;
  adults: number;
  children: number;
  currency: string;
  pricePerPersonCents: number;
  couponCode: string | null;
  depositDueCents: number | null;
  depositDueAt: string | null;
  balanceDueAt: string | null;
  source: string | null;
  assigneeId: string | null;
  requests: string | null;
  internalNotes: string | null;
  cancellationReason: string | null;
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
  };
  items: {
    id: string;
    kind: string;
    label: string;
    detail: string | null;
    quantity: number;
    unitPriceCents: number;
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
    passportName: string | null;
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
}

/**
 * A saved booking, turned into the form's shape.
 *
 * Every nullable column becomes an empty string, because a controlled input
 * given `null` is an uncontrolled input — React warns once and then the field
 * silently stops tracking what is typed in it.
 *
 * Dates are cut to ten characters for `<input type="date">`, which accepts
 * `YYYY-MM-DD` and silently shows nothing for a full ISO timestamp.
 */
function toDraft(booking: Loaded): BookingDraft {
  return {
    id: booking.id,
    kind: booking.kind,
    status: booking.status,
    tripId: booking.tripId ?? '',
    departureId: booking.departureId ?? '',
    startDate: booking.startDate?.slice(0, 10) ?? '',
    endDate: booking.endDate?.slice(0, 10) ?? '',
    customer: booking.customer,
    enquiryId: booking.enquiryId,
    adults: booking.adults,
    children: booking.children,
    currency: booking.currency,
    pricePerPersonCents: booking.pricePerPersonCents,
    items: booking.items.map((item) => ({
      key: item.id,
      kind: item.kind,
      label: item.label,
      detail: item.detail ?? '',
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
    })),
    travellers: booking.travellers.map((one) => ({
      key: one.id,
      isLead: one.isLead,
      firstName: one.firstName,
      lastName: one.lastName,
      email: one.email ?? '',
      phone: one.phone ?? '',
      dateOfBirth: one.dateOfBirth?.slice(0, 10) ?? '',
      nationality: one.nationality ?? '',
      passportName: one.passportName ?? '',
      passportNumber: one.passportNumber ?? '',
      passportExpiry: one.passportExpiry?.slice(0, 10) ?? '',
      passportCountry: one.passportCountry ?? '',
      dietary: one.dietary ?? '',
      medical: one.medical ?? '',
      emergencyContactName: one.emergencyContactName ?? '',
      emergencyContactPhone: one.emergencyContactPhone ?? '',
      roomPreference: one.roomPreference ?? '',
      notes: one.notes ?? '',
    })),
    couponCode: booking.couponCode ?? '',
    depositDueCents: booking.depositDueCents,
    depositDueAt: booking.depositDueAt?.slice(0, 10) ?? '',
    balanceDueAt: booking.balanceDueAt?.slice(0, 10) ?? '',
    source: booking.source ?? 'EMAIL',
    assigneeId: booking.assigneeId ?? '',
    requests: booking.requests ?? '',
    internalNotes: booking.internalNotes ?? '',
    cancellationReason: booking.cancellationReason ?? '',
  };
}

export function EditBooking({
  booking,
  options,
}: {
  booking: Loaded;
  options: EditorOptions;
}) {
  const router = useRouter();
  const [initial] = React.useState(() => toDraft(booking));

  return (
    <BookingEditor
      initial={initial}
      options={options}
      onSaved={(id) => router.push(`/bookings/${id}`)}
    />
  );
}
