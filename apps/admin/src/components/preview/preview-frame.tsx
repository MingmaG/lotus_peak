'use client';

import { ExternalLink, Laptop, RefreshCw, Smartphone, Tablet } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * The website, in a frame, at three widths.
 *
 * The iframe points at the real site's preview URL, so what is inside it is
 * the real page: the real components, the real motion, the real breakpoints,
 * rendered from unpublished rows. Nothing here draws a second version of the
 * design, which is the only arrangement where a preview cannot drift.
 *
 * The three widths are the ones that matter for this design rather than a
 * catalogue of devices:
 *
 * - **390** — a phone. Where the office answers enquiries, and where the
 *   two-column bands become one.
 * - **834** — a tablet in portrait. Where the journey page's facts row wraps
 *   and the itinerary loses its left rail.
 * - **full** — whatever the panel has. The design's container tops out at
 *   1320, so anything above that is margin.
 */

const WIDTHS = [
  { key: 'phone', label: 'Phone', width: 390, icon: Smartphone },
  { key: 'tablet', label: 'Tablet', width: 834, icon: Tablet },
  { key: 'desktop', label: 'Desktop', width: null, icon: Laptop },
] as const;

type WidthKey = (typeof WIDTHS)[number]['key'];

export function PreviewFrame({
  url,
  title,
  open,
  onOpenChange,
}: {
  /** The admin's own `/api/preview/...` route, which redirects to the site. */
  url: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [width, setWidth] = React.useState<WidthKey>('desktop');

  /**
   * Bumped to force a reload.
   *
   * Setting `src` to the same URL does nothing, and reaching into
   * `contentWindow.location` fails across origins — the site is on a different
   * port. A changing `key` makes React replace the element, which is a fresh
   * load with the preview cookie still in place.
   */
  const [reloads, setReloads] = React.useState(0);

  const chosen = WIDTHS.find((item) => item.key === width) ?? WIDTHS[2];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[95vw] flex-col gap-3 p-4 sm:max-w-[95vw]">
        <DialogTitle className="text-sm font-medium">Preview — {title}</DialogTitle>
        <DialogDescription className="sr-only">
          The website, rendered from the unpublished version of this page.
        </DialogDescription>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            {WIDTHS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setWidth(item.key)}
                  aria-pressed={width === item.key}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition-colors',
                    width === item.key
                      ? 'bg-muted font-medium'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-xs tabular-nums text-muted-foreground">
            {chosen.width ? `${chosen.width} px` : 'Full width'}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReloads((count) => count + 1)}
            >
              <RefreshCw className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Reload</span>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Open in a tab</span>
              </a>
            </Button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 justify-center overflow-auto rounded-lg border bg-muted/30 p-3">
          <iframe
            key={`${width}-${reloads}`}
            src={url}
            title={`Preview of ${title}`}
            className="h-full rounded bg-white shadow-sm"
            style={{ width: chosen.width ?? '100%', maxWidth: '100%' }}
            /**
             * Sandboxed, with scripts.
             *
             * The site's motion is JavaScript, so a frame without scripts shows
             * a page that never reveals — the one thing a motion-heavy design's
             * preview must not do. `allow-same-origin` is safe because the
             * frame holds this company's own website, not third-party content.
             */
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
