import { notFound } from 'next/navigation';

import { CustomerEditor } from '@/components/crm/customer-form';
import { requirePermission } from '@/lib/auth/session';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await db.customer.findFirst({
    where: { id, deletedAt: null },
    select: { name: true },
  });
  return { title: customer ? `Edit · ${customer.name}` : 'Customer' };
}

/** A date column as the `<input type="date">` value it is edited through. */
const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? '';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('customers.write');
  const { id } = await params;

  const customer = await db.customer.findFirst({ where: { id, deletedAt: null } });
  if (!customer) notFound();

  return (
    <CustomerEditor
      initial={{
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
        dateOfBirth: day(customer.dateOfBirth),
        nationality: customer.nationality ?? '',
        passportNumber: customer.passportNumber ?? '',
        passportExpiry: day(customer.passportExpiry),
        dietary: customer.dietary ?? '',
        emergencyContactName: customer.emergencyContactName ?? '',
        emergencyContactPhone: customer.emergencyContactPhone ?? '',
        marketingOptIn: customer.marketingOptIn,
      }}
    />
  );
}
