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
  { value: 'DZONG', label: 'Dzong', file: 'dzong' },
  { value: 'DZONG_LONG', label: 'Dzong, long', file: 'dzong-long' },
  { value: 'CHORTEN', label: 'Chorten', file: 'chorten' },
  { value: 'STUPA', label: 'Stupa', file: 'stupa' },
  { value: 'MONASTERY', label: 'Monastery', file: 'monastery' },
  { value: 'PAVILION', label: 'Pavilion', file: 'pavilion' },
  { value: 'BUDDHA', label: 'Buddha', file: 'buddha' },
] as const;

/**
 * The silhouette itself, beside its name, so the office picks the drawing
 * rather than a word for it — "Pavilion" and "Monastery" are not obvious.
 *
 * The PNGs are copies of `apps/web/public/assets/icons/`, not a URL into the
 * site: the two apps deploy separately and the panel must not depend on the
 * website being up to draw its own form. Drawn as a mask, as the site does, so
 * the shape takes the text colour in either theme instead of being black on
 * the dark one.
 */
function IconPreview({ file }: { file: string }) {
  const url = `url(/site-icons/${file}.png)`;
  return (
    <span
      aria-hidden
      className="inline-block h-5 w-8 shrink-0 bg-current"
      style={{
        WebkitMaskImage: url,
        maskImage: url,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}

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
            <IconPreview file={icon.file} />
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
