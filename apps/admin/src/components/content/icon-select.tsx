'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * The Bhutanese silhouettes the design ships.
 *
 * A closed list because the component switches on the name and renders nothing
 * for a value outside it — which looks like a styling problem rather than a
 * data one, and is therefore the kind of bug that survives a review.
 */
const ICONS = [
  { value: 'DZONG', label: 'Dzong' },
  { value: 'DZONG_LONG', label: 'Dzong, long' },
  { value: 'CHORTEN', label: 'Chorten' },
  { value: 'STUPA', label: 'Stupa' },
  { value: 'MONASTERY', label: 'Monastery' },
  { value: 'PAVILION', label: 'Pavilion' },
  { value: 'BUDDHA', label: 'Buddha' },
] as const;

export function IconSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ICONS.map((icon) => (
          <SelectItem key={icon.value} value={icon.value}>
            {icon.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export const STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ARCHIVED', label: 'Archived' },
] as const;

export function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            {status.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
