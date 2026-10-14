'use client'

import Image from 'next/image'
import { Prose } from '@/components/site/Prose'
import { useId, useState, type CSSProperties } from 'react'
import { PlusMinus } from '../primitives/Disclosure'
import { PhotoLightbox, position, type LightboxPhoto } from '../media/PhotoLightbox'

export type ItineraryDay = {
  day?: number
  rest?: boolean
  title: string
  meta?: string
  body?: string
  /**
   * The day's own photographs, under its prose.
   *
   * Distinct from a photograph inside `body`, which arrives as a `<figure>` in
   * the HTML and belongs to a sentence. These belong to the day.
   */
  images?: LightboxPhoto[]
}

/**
 * How many tiles a day's strip draws before it starts counting.
 *
 * Two rows at most on a wide screen, which is as much as a day can carry
 * before the itinerary stops reading as a sequence of days.
 */
const DAY_IMAGES = 8

/**
 * A day's photographs: a strip under its prose, and the viewer over the page.
 *
 * The strip used to be a hard `slice(0, 6)` with nothing to click. A day with
 * ten photographs showed six and the other four existed only in the database —
 * no count, no overflow, no way to reach them, and nothing anywhere said so.
 * Now the last tile counts what is left and opens the viewer on it, so the
 * strip stays the size the design wants while every photograph is one tap
 * away. A day may hold as many as the office likes.
 *
 * `aspect-ratio` with `fill` rather than intrinsic dimensions, because the
 * cells are a grid and a portrait among landscapes would otherwise set the
 * row's height. Each is lazy: an eleven-day itinerary with four photographs a
 * day is forty-four requests if they are all eager, and the visitor has read
 * two days of it.
 */
function DayImages({ images, dayLabel }: { images: LightboxPhoto[]; dayLabel: string }) {
  const [viewing, setViewing] = useState<number | null>(null)

  /* Where there are more than fit, the last tile becomes the counter — so it
     is `DAY_IMAGES - 1` photographs plus the one the counter stands on. */
  const overflowing = images.length > DAY_IMAGES
  const shown = overflowing ? images.slice(0, DAY_IMAGES - 1) : images
  const rest = images.length - shown.length

  return (
    <>
      <div
        style={{
          marginTop: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 8,
          maxWidth: 'var(--measure)',
        }}
      >
        {shown.map((image, i) => (
          <button
            key={image.src + i}
            type="button"
            className="lp-mosaic-tile"
            onClick={() => setViewing(i)}
            aria-label={`Open photograph ${i + 1} of ${images.length}, ${dayLabel}`}
            style={{ aspectRatio: '4/3' }}
          >
            <Image
              src={image.src}
              alt={image.alt ?? ''}
              fill
              loading="lazy"
              sizes="(max-width: 900px) 33vw, 220px"
              style={{ objectFit: 'cover', objectPosition: position(image) }}
            />
          </button>
        ))}

        {overflowing && (
          <button
            type="button"
            className="lp-mosaic-tile"
            onClick={() => setViewing(shown.length)}
            aria-label={`Show the other ${rest} photographs of ${dayLabel}`}
            style={{ aspectRatio: '4/3' }}
          >
            {/* The photograph under the count is the first of the ones being
                counted, so the tile shows what it is offering. */}
            <Image
              src={images[shown.length]!.src}
              alt=""
              fill
              loading="lazy"
              sizes="(max-width: 900px) 33vw, 220px"
              style={{ objectFit: 'cover', objectPosition: position(images[shown.length]!) }}
            />
            <span className="lp-day-more" aria-hidden>
              +{rest}
            </span>
          </button>
        )}
      </div>

      <PhotoLightbox
        photos={images}
        index={viewing}
        onIndex={setViewing}
        onClose={() => setViewing(null)}
        label={`Photograph viewer, ${dayLabel}`}
      />
    </>
  )
}

export type ItineraryProps = {
  days: ItineraryDay[]
  /** Accordion mode: bodies hidden until toggled. */
  collapsible?: boolean
  /** Indexes of open days (controlled). */
  expanded?: number[]
  onToggle?: (index: number) => void
  style?: CSSProperties
}

/**
 * Day-by-day vertical timeline. Rest days get a hollow gold node and read
 * "Rest" instead of a number. `collapsible` renders circled day nodes on a
 * dashed connector with a plus/minus toggle per day.
 */
export function Itinerary({ days = [], collapsible = false, expanded, onToggle, style }: ItineraryProps) {
  const [local, setLocal] = useState<number[]>([])
  const open = expanded ?? local
  const baseId = useId()

  const toggle = (i: number) =>
    onToggle ? onToggle(i) : setLocal((o) => (o.includes(i) ? o.filter((x) => x !== i) : [...o, i]))

  const label = (d: ItineraryDay, i: number) => (d.rest ? 'Rest' : `Day ${d.day ?? i + 1}`)

  if (!collapsible) {
    return (
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          position: 'relative',
          fontFamily: 'var(--font-sans-body)',
          ...style,
        }}
      >
        {days.map((d, i) => (
          <li
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '96px 1fr',
              gap: 32,
              position: 'relative',
              paddingBottom: i < days.length - 1 ? 'var(--space-8)' : 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 112,
                top: 8,
                bottom: 0,
                width: 1,
                background: 'var(--border-hairline)',
                display: i < days.length - 1 ? 'block' : 'none',
              }}
            />
            <div
              style={{
                fontSize: 'var(--text-micro)',
                letterSpacing: 'var(--tracking-label)',
                textTransform: 'uppercase',
                color: d.rest ? 'var(--gold)' : 'var(--text-muted)',
                paddingTop: 6,
              }}
            >
              {label(d, i)}
            </div>
            <div style={{ position: 'relative', paddingLeft: 40 }}>
              <span
                style={{
                  position: 'absolute',
                  left: 11,
                  top: 9,
                  width: 11,
                  height: 11,
                  borderRadius: '50%',
                  border: `1px solid ${d.rest ? 'var(--gold)' : 'var(--pine)'}`,
                  background: d.rest ? 'transparent' : 'var(--pine)',
                }}
              />
              <h3
                style={{
                  fontFamily: 'var(--font-serif-display)',
                  fontWeight: 'var(--weight-semibold)',
                  fontSize: 'var(--text-h3)',
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {d.title}
              </h3>
              {d.meta && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 'var(--text-micro)',
                    letterSpacing: '.14em',
                    textTransform: 'uppercase',
                    color: 'var(--text-faint)',
                  }}
                >
                  {d.meta}
                </div>
              )}
              {d.body && (
                <Prose
                  html={d.body}
                  compact
                  style={{ margin: '14px 0 0', color: 'var(--text-muted)', maxWidth: 'var(--measure)' }}
                />
              )}
              {d.images && d.images.length > 0 && (
                <DayImages images={d.images} dayLabel={`${label(d, i)}: ${d.title}`} />
              )}
            </div>
          </li>
        ))}
      </ol>
    )
  }

  return (
    <ol
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        position: 'relative',
        fontFamily: 'var(--font-sans-body)',
        ...style,
      }}
    >
      {days.map((d, i) => {
        const on = open.includes(i)
        const last = i === days.length - 1
        const panelId = `${baseId}-panel-${i}`
        const buttonId = `${baseId}-button-${i}`

        return (
          <li
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '64px 1fr',
              gap: 32,
              position: 'relative',
              paddingBottom: last ? 0 : 12,
            }}
          >
            {!last && (
              <div
                style={{
                  position: 'absolute',
                  left: 32,
                  top: 64,
                  bottom: -12,
                  width: 0,
                  borderLeft: `1px dashed ${d.rest ? 'var(--gold)' : 'var(--border-strong)'}`,
                }}
              />
            )}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                border: `1px solid ${d.rest ? 'var(--gold)' : 'var(--pine)'}`,
                background: 'var(--surface-page)',
                display: 'grid',
                placeItems: 'center',
                fontSize: 'var(--text-micro)',
                fontWeight: 500,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: d.rest ? 'var(--gold)' : 'var(--pine)',
                position: 'relative',
                zIndex: 1,
              }}
            >
              {label(d, i)}
            </div>

            <div
              style={{
                borderBottom: last ? 0 : '1px solid var(--border-hairline)',
                paddingBottom: 24,
                minHeight: 64,
                boxSizing: 'border-box',
              }}
            >
              <button
                type="button"
                id={buttonId}
                aria-expanded={on}
                aria-controls={d.body ? panelId : undefined}
                onClick={() => toggle(i)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 24px',
                  gap: 24,
                  alignItems: 'start',
                  width: '100%',
                  background: 'none',
                  border: 0,
                  padding: '18px 0 0',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: 'inherit',
                }}
              >
                <span>
                  <span
                    style={{
                      display: 'block',
                      fontFamily: 'var(--font-serif-display)',
                      fontWeight: 'var(--weight-semibold)',
                      fontSize: 'var(--text-h3)',
                      lineHeight: 1.2,
                    }}
                  >
                    {d.title}
                  </span>
                  {d.meta && (
                    <span
                      style={{
                        display: 'block',
                        marginTop: 8,
                        fontSize: 'var(--text-micro)',
                        letterSpacing: '.14em',
                        textTransform: 'uppercase',
                        color: 'var(--text-faint)',
                      }}
                    >
                      {d.meta}
                    </span>
                  )}
                </span>
                <span style={{ marginTop: 4 }}>
                  <PlusMinus open={on} />
                </span>
              </button>

              {(d.body || (d.images && d.images.length > 0)) && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  style={{
                    display: 'grid',
                    gridTemplateRows: on ? '1fr' : '0fr',
                    transition: 'grid-template-rows var(--dur-slow) var(--ease-breath)',
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <Prose
                      html={d.body ?? ''}
                      compact
                      style={{
                        margin: '16px 0 0',
                        color: 'var(--text-muted)',
                        maxWidth: 'var(--measure)',
                        opacity: on ? 1 : 0,
                        transform: on ? 'none' : 'translateY(-6px)',
                        transition:
                          'opacity var(--dur-slow) var(--ease-breath),transform var(--dur-slow) var(--ease-breath)',
                      }}
                    />
                    {d.images && d.images.length > 0 && (
                      <DayImages images={d.images} dayLabel={`${label(d, i)}: ${d.title}`} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
