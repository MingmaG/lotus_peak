'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Field } from '@/components/shared/editor-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiPatch, apiPost } from '@/lib/api-client';

export interface CustomerForm {
  id: string | null;
  name: string;
  email: string;
  phone: string;
  country: string;
  notes: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber: string;
  passportExpiry: string;
  dietary: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  marketingOptIn: boolean;
}

export function blankCustomer(): CustomerForm {
  return {
    id: null,
    name: '',
    email: '',
    phone: '',
    country: '',
    notes: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    postalCode: '',
    countryCode: '',
    dateOfBirth: '',
    nationality: '',
    passportNumber: '',
    passportExpiry: '',
    dietary: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    marketingOptIn: false,
  };
}

/**
 * The whole customer record.
 *
 * Longer than the short form the booking screen offers, and that is the
 * division: a booking is taken on the telephone with a name and an address,
 * and the passport and the billing address arrive afterwards. Both write to the
 * same row.
 *
 * Everything below the contact details is optional in the API as well as here.
 * A form that demanded a passport number to save a name is a form that gets
 * `TBC` typed into it, and `TBC` in a passport column is worse than an empty
 * one — an empty one can be counted and chased.
 */
export function CustomerSheet({
  form: initial,
  open,
  onOpenChange,
  onSaved,
}: {
  form: CustomerForm | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (id: string) => void;
}) {
  const client = useQueryClient();
  const [form, setForm] = React.useState<CustomerForm>(initial ?? blankCustomer());
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setForm(initial ?? blankCustomer());
      setErrors({});
    }
  }, [open, initial]);

  const patch = (changes: Partial<CustomerForm>) =>
    setForm((current) => ({ ...current, ...changes }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        country: form.country.trim() || null,
        notes: form.notes.trim() || null,
        addressLine1: form.addressLine1.trim() || null,
        addressLine2: form.addressLine2.trim() || null,
        city: form.city.trim() || null,
        region: form.region.trim() || null,
        postalCode: form.postalCode.trim() || null,
        countryCode: form.countryCode.trim().toUpperCase() || null,
        dateOfBirth: form.dateOfBirth || null,
        nationality: form.nationality.trim() || null,
        passportNumber: form.passportNumber.trim() || null,
        passportExpiry: form.passportExpiry || null,
        dietary: form.dietary.trim() || null,
        emergencyContactName: form.emergencyContactName.trim() || null,
        emergencyContactPhone: form.emergencyContactPhone.trim() || null,
        marketingOptIn: form.marketingOptIn,
      };

      return form.id
        ? apiPatch<{ customer: { id: string } }>(`/api/customers/${form.id}`, body)
        : apiPost<{ customer: { id: string } }>('/api/customers', body);
    },
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: ['customers'] });
      void client.invalidateQueries({ queryKey: ['customer'] });
      toast.success('Saved');
      onOpenChange(false);
      onSaved?.(result.customer.id);
    },
    onError: (error: Error & { fields?: Record<string, string>; status?: number }) => {
      if (error.fields) setErrors(error.fields);
      else if (error.status === 409) {
        setErrors({ email: 'Somebody is already on file with that address.' });
      } else toast.error(error.message, { duration: 8_000 });
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{form.id ? form.name || 'This customer' : 'A new customer'}</SheetTitle>
          <SheetDescription>
            Only the name and the email address are needed. The rest is what a permit
            application asks for, and it can be filled in when it arrives.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 py-4">
          <div className="space-y-4">
            <Field label="Name" error={errors.name}>
              <Input
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
              />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => patch({ email: event.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Telephone" error={errors.phone}>
                <Input
                  value={form.phone}
                  onChange={(event) => patch({ phone: event.target.value })}
                />
              </Field>
              <Field label="Country" error={errors.country}>
                <Input
                  value={form.country}
                  placeholder="Spain"
                  onChange={(event) => patch({ country: event.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">Where to send an invoice</p>
            <Field label="Address" error={errors.addressLine1}>
              <Input
                value={form.addressLine1}
                onChange={(event) => patch({ addressLine1: event.target.value })}
              />
            </Field>
            <Field label="And">
              <Input
                value={form.addressLine2}
                onChange={(event) => patch({ addressLine2: event.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Town">
                <Input
                  value={form.city}
                  onChange={(event) => patch({ city: event.target.value })}
                />
              </Field>
              <Field label="Region">
                <Input
                  value={form.region}
                  onChange={(event) => patch({ region: event.target.value })}
                />
              </Field>
              <Field label="Postcode">
                <Input
                  value={form.postalCode}
                  onChange={(event) => patch({ postalCode: event.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-medium">For the permit</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date of birth">
                <Input
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(event) => patch({ dateOfBirth: event.target.value })}
                />
              </Field>
              <Field label="Nationality">
                <Input
                  value={form.nationality}
                  onChange={(event) => patch({ nationality: event.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Passport number">
                <Input
                  value={form.passportNumber}
                  className="font-mono"
                  onChange={(event) => patch({ passportNumber: event.target.value })}
                />
              </Field>
              <Field label="Expires">
                <Input
                  type="date"
                  value={form.passportExpiry}
                  onChange={(event) => patch({ passportExpiry: event.target.value })}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <Field label="Dietary">
              <Input
                value={form.dietary}
                onChange={(event) => patch({ dietary: event.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="In an emergency, call">
                <Input
                  value={form.emergencyContactName}
                  onChange={(event) => patch({ emergencyContactName: event.target.value })}
                />
              </Field>
              <Field label="On">
                <Input
                  value={form.emergencyContactPhone}
                  onChange={(event) => patch({ emergencyContactPhone: event.target.value })}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </Field>

            <label className="flex items-start gap-2 text-sm">
              <Switch
                checked={form.marketingOptIn}
                onCheckedChange={(marketingOptIn) => patch({ marketingOptIn })}
              />
              {/* Off by default and deliberately. Somebody who booked a journey
                  did not thereby ask for the newsletter, and a box that starts
                  ticked is a consent record that proves nothing. */}
              <span>
                They have asked to hear from us
                <span className="block text-xs text-muted-foreground">
                  Only tick this if they said so.
                </span>
              </span>
            </label>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.name.trim() || !form.email.trim()}
          >
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
