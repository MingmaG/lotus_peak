/*
 * The editable shape and its empty starting value, kept out of the editor's
 * 'use client' module on purpose: the `new` route is a Server Component and
 * calls the blank factory. A function exported from a client module is only a
 * reference on the server, and calling it there throws.
 */

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
