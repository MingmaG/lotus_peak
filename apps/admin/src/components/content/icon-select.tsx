'use client';

import type { SiteIcon } from '@prisma/client';
import type { SiteIconName } from '@lotuspeak/api-contracts';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ICON_TO_WIRE } from '@/server/services/content-paths';

/**
 * The Bhutanese silhouettes the design ships, as the office reads them.
 *
 * `Record<SiteIcon, string>`, so a drawing added to the enum and not named
 * here is a compile error rather than a blank row in the menu. The order is
 * the enum's: the seven building types first, then the eight drawings of a
 * single place.
 */
const LABEL: Record<SiteIcon, string> = {
  DZONG: 'Dzong',
  DZONG_LONG: 'Dzong, long',
  CHORTEN: 'Chorten',
  STUPA: 'Stupa',
  MONASTERY: 'Monastery',
  PAVILION: 'Pavilion',
  BUDDHA: 'Buddha',
  TAKTSANG: 'Taktsang, Paro',
  PUNAKHA: 'Punakha Dzong',
  JAKAR: 'Jakar Dzong, Bumthang',
  TRONGSA: 'Trongsa Dzong',
  MONGAR: 'Mongar Dzong',
  PEMAGATSHEL: 'Pemagatshel',
  TRASHIGANG: 'Trashigang Dzong',
  GASA: 'Gasa Dzong',
};

/**
 * The two halves, in the order the menu shows them.
 *
 * Split because they are different kinds of answer: a building type is a
 * choice about what sort of place this is, and a named dzong is a picture of
 * one particular building. Somewhere that has its own drawing should use it —
 * the generic dzong beside Taktsang reads as a stand-in.
 */
const TYPES: SiteIcon[] = [
  'DZONG',
  'DZONG_LONG',
  'CHORTEN',
  'STUPA',
  'MONASTERY',
  'PAVILION',
  'BUDDHA',
];

const PLACES: SiteIcon[] = [
  'TAKTSANG',
  'PUNAKHA',
  'JAKAR',
  'TRONGSA',
  'MONGAR',
  'PEMAGATSHEL',
  'TRASHIGANG',
  'GASA',
];

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
function IconPreview({ name }: { name: SiteIconName }) {
  const url = `url(/site-icons/${name}.png)`;
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

/**
 * Which spelling the field round this select stores.
 *
 * A destination, an activity and a culture article hold a `SiteIcon` column,
 * so they read and write `TAKTSANG`. A page section's points are JSON that
 * goes out on the wire as written, so they hold `taktsang`. Both were pointed
 * at this one select, which wrote the enum spelling into both — and a page
 * whose point carried `DZONG` failed its own validator on save, so the office
 * could not pick a point's icon at all.
 */
export type IconNaming = 'enum' | 'wire';

export function IconSelect({
  value,
  onChange,
  naming = 'enum',
}: {
  value: string;
  onChange: (value: string) => void;
  naming?: IconNaming;
}) {
  const stored = (icon: SiteIcon) => (naming === 'wire' ? ICON_TO_WIRE[icon] : icon);

  const group = (icons: SiteIcon[], heading: string) => (
    <SelectGroup>
      <SelectLabel>{heading}</SelectLabel>
      {icons.map((icon) => (
        <SelectItem key={icon} value={stored(icon)}>
          <IconPreview name={ICON_TO_WIRE[icon]} />
          {LABEL[icon]}
        </SelectItem>
      ))}
    </SelectGroup>
  );

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {group(TYPES, 'Building types')}
        {group(PLACES, 'Places')}
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
