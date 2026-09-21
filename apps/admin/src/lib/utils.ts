import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind-aware class concatenation. `cn('p-2', 'p-4')` is `p-4`. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
