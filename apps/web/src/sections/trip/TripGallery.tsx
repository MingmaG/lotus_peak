'use client'

import Image from 'next/image'
import { useCallback, useState } from 'react'
import { CloseButton, Layer, PhotoLightbox, position, ratio } from '@/design-system'
import type { TripPhoto } from '@/content/types'

/**
 * A journey's photographs: a mosaic on the page, every photograph in a sheet,
 * and a viewer over both.
 *
 * Three layers, each a native `<dialog>` above the last. The dialog and the
 * viewer are `design-system/media/PhotoLightbox` — a day's strip in the
 * itinerary opens the same viewer, and one of them had to stop owning it.
 * What is left here is this band's own two things: the mosaic, and the sheet
 * that lists everything.
 */
export function TripGallery({ photos, title }: { photos: TripPhoto[]; title: string }) {
  const [sheet, setSheet] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)

  const closeSheet = useCallback(() => setSheet(false), [])
  const closeViewer = useCallback(() => setViewing(null), [])

  if (photos.length === 0) return null
  const shown = photos.slice(0, 5)

  return (
    <>
      <div style={{ position: 'relative' }}>
        <div className="lp-mosaic" data-count={shown.length}>
          {shown.map((photo, i) => (
            <button
              key={photo.src + i}
              type="button"
              className="lp-mosaic-tile"
              onClick={() => setViewing(i)}
              aria-label={`Open photograph ${i + 1} of ${photos.length}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt ?? ''}
                fill
                sizes={i === 0 ? '(max-width: 700px) 100vw, 50vw' : '(max-width: 700px) 50vw, 25vw'}
                style={{ objectFit: 'cover', objectPosition: position(photo) }}
              />
            </button>
          ))}
        </div>

        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => setSheet(true)}
            className="lp-gallery-all"
            style={{
              position: 'absolute',
              right: 'var(--space-4)',
              bottom: 'var(--space-4)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 18px',
              background: 'var(--surface-veil)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              border: '1px solid var(--border-hairline)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--ink)',
              fontFamily: 'inherit',
              fontSize: 'var(--text-label)',
              fontWeight: 500,
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            <GridIcon />
            View all {photos.length} photographs
          </button>
        )}
      </div>

      <Layer open={sheet} onClose={closeSheet} label={`Photographs from ${title}`} tone="light">
        {sheet && <Sheet photos={photos} title={title} onClose={closeSheet} onOpen={setViewing} />}
      </Layer>

      <PhotoLightbox
        photos={photos}
        index={viewing}
        onIndex={setViewing}
        onClose={closeViewer}
        label={`Photograph viewer, ${title}`}
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/*  Every photograph                                                           */
/* -------------------------------------------------------------------------- */

function Sheet({
  photos,
  title,
  onClose,
  onOpen,
}: {
  photos: TripPhoto[]
  title: string
  onClose: () => void
  onOpen: (index: number) => void
}) {
  return (
    <div style={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'contain' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-5)',
          padding: 'var(--space-4) var(--gutter)',
          background: 'var(--surface-page)',
          borderBottom: '1px solid var(--border-hairline)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-label)',
              letterSpacing: 'var(--tracking-label)',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            {photos.length} photographs
          </p>
          <h2
            style={{
              margin: '4px 0 0',
              fontSize: 'var(--text-h3)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </h2>
        </div>
        <CloseButton onClick={onClose} tone="light" autoFocus />
      </header>

      <div
        className="lp-gallery"
        style={{
          maxWidth: 'var(--container)',
          margin: '0 auto',
          padding: 'var(--space-7) var(--gutter) var(--space-9)',
        }}
      >
        {photos.map((photo, i) => (
          <figure key={photo.src + i} style={{ margin: '0 0 var(--space-6)', breakInside: 'avoid' }}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              aria-label={`Open photograph ${i + 1} of ${photos.length}`}
              className="lp-mosaic-tile"
              style={{ aspectRatio: ratio(photo), width: '100%' }}
            >
              <Image
                src={photo.src}
                alt={photo.alt ?? ''}
                fill
                sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                style={{ objectFit: 'cover', objectPosition: position(photo) }}
              />
            </button>
            {photo.caption && (
              <figcaption
                style={{ marginTop: 10, fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}
              >
                {photo.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  )
}

function GridIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.1">
      <rect x="1" y="1" width="5" height="5" />
      <rect x="8" y="1" width="5" height="5" />
      <rect x="1" y="8" width="5" height="5" />
      <rect x="8" y="8" width="5" height="5" />
    </svg>
  )
}
