'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, Search, UserPlus, X } from 'lucide-react';
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
import { apiGet, apiPost, query } from '@/lib/api-client';

export interface PickedCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
}

/**
 * Who this booking is for.
 *
 * A search box over the existing records with "add a new one" beside it,
 * rather than a `<select>` of every customer. The office has a growing list and
 * a select of eight hundred names is a control nobody can use — but more to the
 * point, the person taking a booking on the telephone does not know yet
 * whether this caller is already in there. Searching answers that question as
 * a side effect of asking it.
 *
 * Creating one here rather than sending somebody to the Customers screen and
 * back: a booking cannot be saved without a customer, and a form that makes you
 * leave it to satisfy a required field is a form that loses what you had typed.
 */
export function CustomerPicker({
  value,
  onChange,
  disabled,
}: {
  value: PickedCustomer | null;
  onChange: (customer: PickedCustomer | null) => void;
  disabled?: boolean;
}) {
  const client = useQueryClient();
  const [search, setSearch] = React.useState('');
  const [adding, setAdding] = React.useState(false);

  /* Debounced, like the data table's own box: a request per keystroke makes
     the field feel laggy on a slow connection. */
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isFetching } = useQuery<{ items: PickedCustomer[] }>({
    queryKey: ['customers', 'picker', debounced],
    queryFn: () => apiGet(`/api/customers${query({ q: debounced, perPage: 8 })}`),
    enabled: !value && debounced.trim().length > 0,
  });

  if (value) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{value.name}</p>
          <p className="truncate text-xs text-muted-foreground">{value.email}</p>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setSearch('');
            }}
          >
            <X className="mr-1 size-3.5" />
            Change
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or email…"
            className="pl-8.5"
            aria-label="Search for a customer"
          />
          {isFetching && (
            <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button type="button" variant="outline" disabled={disabled} onClick={() => setAdding(true)}>
          <UserPlus className="mr-1.5 size-3.5" />
          New
        </Button>
      </div>

      {debounced.trim() && (
        <ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
          {(data?.items.length ?? 0) === 0 && !isFetching && (
            <li className="px-3 py-4 text-center text-xs text-muted-foreground">
              Nobody by that name. Add them with the button above.
            </li>
          )}
          {data?.items.map((customer) => (
            <li key={customer.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50"
                onClick={() => {
                  onChange(customer);
                  setSearch('');
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm">{customer.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {customer.email}
                    {customer.country ? ` · ${customer.country}` : ''}
                  </span>
                </span>
                <Check className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <NewCustomerSheet
        open={adding}
        onOpenChange={setAdding}
        onCreated={(customer) => {
          void client.invalidateQueries({ queryKey: ['customers'] });
          onChange(customer);
          setAdding(false);
          setSearch('');
        }}
      />
    </div>
  );
}

/**
 * The short form.
 *
 * Four fields, and the rest of a customer's record — passport, address,
 * dietary requirements — left to the Customers screen. The moment this opens
 * is the moment somebody is on the telephone, and a form asking for a passport
 * expiry date then is a form that gets `TBC` typed into it.
 */
function NewCustomerSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (customer: PickedCustomer) => void;
}) {
  const [form, setForm] = React.useState({ name: '', email: '', phone: '', country: '' });
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setForm({ name: '', email: '', phone: '', country: '' });
      setErrors({});
    }
  }, [open]);

  const create = useMutation({
    mutationFn: () =>
      apiPost<{ customer: PickedCustomer }>('/api/customers', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        country: form.country.trim() || null,
      }),
    onSuccess: (result) => {
      toast.success(`${result.customer.name} added`);
      onCreated(result.customer);
    },
    onError: (error: Error & { fields?: Record<string, string>; status?: number }) => {
      /* A 422 puts its messages beside the inputs; a 409 is the unique email,
         which belongs beside the email box rather than in a toast that covers
         the form. */
      if (error.fields) setErrors(error.fields);
      else if (error.status === 409) {
        setErrors({ email: 'Somebody is already on file with that address.' });
      } else toast.error(error.message);
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>A new customer</SheetTitle>
          <SheetDescription>
            Enough to take the booking. The rest of their record — address, passport, what
            they cannot eat — is on the Customers screen when you have it.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          <Field label="Name" error={errors.name}>
            <Input
              value={form.name}
              autoFocus
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Ana Rivas"
            />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="ana@example.com"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Telephone" error={errors.phone}>
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
              />
            </Field>
            <Field label="Country" error={errors.country}>
              <Input
                value={form.country}
                onChange={(event) => setForm({ ...form, country: event.target.value })}
                placeholder="Spain"
              />
            </Field>
          </div>
        </div>

        <SheetFooter className="flex-row justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending || !form.name.trim() || !form.email.trim()}
          >
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Add them
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
