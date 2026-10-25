'use client';

import { ArrowRight, X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * What the website will draw, drawn here while it is being written.
 *
 * The colours are copies of the website's tokens (`apps/web/src/design-system/
 * tokens/colors.css`, the `--notice-*` and `--banner-*` sets), because the
 * panel cannot import the site's CSS and should not try: the boundary between
 * the two apps is HTTP. A preview that is a shade off is a preview; the
 * website is the authority. If a token there changes, change it here too.
 *
 * The message is the editor's own HTML, set as inner HTML. It is the office's
 * writing, produced by an editor whose schema allows paragraphs, emphasis and
 * links and nothing else — this is the panel showing its user their own words.
 */

export type Tone = 'GENERAL' | 'OFFER' | 'ADVISORY' | 'FESTIVAL';

export const TONES: Record<
  Tone,
  { label: string; hint: string; bg: string; fg: string; chipBg: string; chipFg: string; link: string }
> = {
  GENERAL: {
    label: 'General',
    hint: 'News, a new journey, anything worth saying',
    bg: '#0C3E5C',
    fg: '#FFFFFF',
    chipBg: 'rgba(255,255,255,.14)',
    chipFg: '#FFFFFF',
    link: '#F3DDBC',
  },
  OFFER: {
    label: 'Offer',
    hint: 'A discount, an early-booking rate',
    bg: '#F2F8FD',
    fg: '#0C3E5C',
    chipBg: '#D98A2B',
    chipFg: '#1F1D1A',
    link: '#15618F',
  },
  ADVISORY: {
    label: 'Advisory',
    hint: 'A closure, a permit rule, a weather warning',
    bg: '#7A1F2B',
    fg: '#FFFFFF',
    chipBg: 'rgba(255,255,255,.16)',
    chipFg: '#FFFFFF',
    link: '#F3DDBC',
  },
  FESTIVAL: {
    label: 'Festival',
    hint: 'A tshechu, a national day, a celebration',
    bg: '#F3DDBC',
    fg: '#1F1D1A',
    chipBg: '#7A1F2B',
    chipFg: '#FFFFFF',
    link: '#7A1F2B',
  },
};

export function AnnouncementPreview({
  tone,
  label,
  message,
  href,
  linkLabel,
  dismissible,
}: {
  tone: Tone;
  label: string;
  message: string;
  href: string;
  linkLabel: string;
  dismissible: boolean;
}) {
  const t = TONES[tone];
  return (
    <div className="overflow-hidden rounded-lg border shadow-sm">
      <div
        className="lp-notice-preview flex items-center gap-4 px-5 py-2.5"
        style={{ background: t.bg, color: t.fg, ['--notice-link' as string]: t.link }}
      >
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          {label && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[.14em]"
              style={{ background: t.chipBg, color: t.chipFg }}
            >
              {label}
            </span>
          )}
          {message ? (
            <div className="min-w-0" dangerouslySetInnerHTML={{ __html: message }} />
          ) : (
            <span className="text-sm opacity-60">Your message appears here.</span>
          )}
          {href && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[.12em] underline-offset-4"
              style={{ color: t.link }}
            >
              {linkLabel || 'Read more'}
              <ArrowRight className="size-3" />
            </span>
          )}
        </div>
        {dismissible && <X className="size-4 shrink-0 opacity-70" aria-hidden />}
      </div>
      {/* A suggestion of the navigation beneath it, so the bar reads in place. */}
      <div className="flex items-center justify-between bg-white px-5 py-3 text-[10px] uppercase tracking-[.16em] text-neutral-500">
        <span className="font-semibold text-neutral-800">Lotus Peak</span>
        <span className="hidden gap-4 sm:flex">
          <span>Journeys</span>
          <span>Where we go</span>
          <span>Journal</span>
        </span>
      </div>
    </div>
  );
}

export type Theme = 'PAPER' | 'MIST' | 'INK';
export type Layout = 'IMAGE_LEFT' | 'IMAGE_RIGHT' | 'BACKDROP';
export type Placement = 'PAGE_END' | 'POPUP';

export const THEMES: Record<Theme, { label: string; bg: string; fg: string; muted: string; accent: string }> = {
  PAPER: { label: 'White', bg: '#FFFFFF', fg: '#1F1D1A', muted: '#5E5A53', accent: '#15618F' },
  MIST: { label: 'Mist', bg: '#F2F8FD', fg: '#1F1D1A', muted: '#5E5A53', accent: '#15618F' },
  INK: { label: 'Lotus ink', bg: '#0C3E5C', fg: '#FFFFFF', muted: 'rgba(255,255,255,.72)', accent: '#E8A23C' },
};

export function BannerPreview({
  placement,
  layout,
  theme,
  eyebrow,
  heading,
  body,
  imageUrl,
  linkLabel,
  href,
  secondaryLabel,
}: {
  placement: Placement;
  layout: Layout;
  theme: Theme;
  eyebrow: string;
  heading: string;
  body: string;
  imageUrl: string | null;
  linkLabel: string;
  href: string;
  secondaryLabel: string;
}) {
  const backdrop = layout === 'BACKDROP' && imageUrl;
  const t = backdrop ? THEMES.INK : THEMES[theme];
  const popup = placement === 'POPUP';

  const words = (
    <div className={cn('relative flex flex-col justify-center gap-2', popup ? 'p-5' : 'p-6')}>
      {eyebrow && (
        <span className="text-[10px] font-semibold uppercase tracking-[.18em]" style={{ color: t.accent }}>
          {eyebrow}
        </span>
      )}
      <h3 className={cn('font-light leading-tight', popup ? 'text-xl' : 'text-2xl')} style={{ color: t.fg }}>
        {heading || 'Your heading'}
      </h3>
      {body && (
        <div
          className="lp-banner-preview-body line-clamp-4 text-xs leading-relaxed"
          style={{ color: t.muted }}
          dangerouslySetInnerHTML={{ __html: body }}
        />
      )}
      {(href || secondaryLabel) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {href && linkLabel && (
            <span
              className="rounded-sm px-3 py-2 text-[10px] font-medium uppercase tracking-[.14em]"
              style={{ background: theme === 'INK' || backdrop ? '#FFFFFF' : '#15618F', color: theme === 'INK' || backdrop ? '#0C3E5C' : '#FFFFFF' }}
            >
              {linkLabel}
            </span>
          )}
          {secondaryLabel && (
            <span
              className="py-2 text-[10px] font-medium uppercase tracking-[.14em]"
              style={{ color: theme === 'INK' || backdrop ? t.fg : t.accent }}
            >
              {secondaryLabel} →
            </span>
          )}
        </div>
      )}
    </div>
  );

  const image = imageUrl ? (
    <div className={cn('relative min-h-40 bg-muted', !popup && 'sm:min-h-0')}>
      <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
    </div>
  ) : null;

  const card = backdrop ? (
    <div className="relative overflow-hidden" style={{ background: t.bg }}>
      <img src={imageUrl!} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(12,62,92,.82), rgba(12,62,92,.35))' }} />
      <div className="relative max-w-md">{words}</div>
    </div>
  ) : (
    <div
      className={cn('grid overflow-hidden', image && !popup && 'sm:grid-cols-2')}
      style={{ background: t.bg }}
    >
      {image && (popup || layout === 'IMAGE_LEFT') && image}
      {words}
      {image && !popup && layout === 'IMAGE_RIGHT' && image}
    </div>
  );

  if (popup) {
    return (
      <div className="relative flex min-h-80 items-center justify-center overflow-hidden rounded-lg border bg-neutral-200 p-6">
        <div className="absolute inset-0" style={{ background: 'rgba(12,62,92,.55)' }} />
        <div className="relative w-full max-w-xs overflow-hidden rounded-sm shadow-2xl">
          <span className="absolute right-2 top-2 z-10 inline-flex size-6 items-center justify-center rounded-full bg-white/90 text-neutral-700">
            <X className="size-3.5" />
          </span>
          {card}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="h-6 bg-white" />
      {card}
      <div className="flex h-10 items-center bg-[#08293D] px-5 text-[10px] uppercase tracking-[.16em] text-white/60">
        The footer
      </div>
    </div>
  );
}
