import type { CSSProperties } from 'react'
import { asset } from '@/lib/assets'

export type SiteIconName =
  | 'dzong'
  | 'chorten'
  | 'stupa'
  | 'monastery'
  | 'pavilion'
  | 'dzong-long'
  | 'buddha'
  | 'taktsang'
  | 'punakha'
  | 'jakar'

/** Intrinsic width/height of each silhouette drawing. */
const RATIO: Record<SiteIconName, number> = {
  dzong: 150 / 120,
  chorten: 120 / 135,
  stupa: 110 / 110,
  monastery: 315 / 140,
  pavilion: 120 / 125,
  'dzong-long': 320 / 110,
  buddha: 110 / 125,
  taktsang: 140 / 132,
  punakha: 320 / 110,
  jakar: 300 / 120,
}

/**
 * Framed-mode enlargement. Wide silhouettes fitted by their longest side sit
 * low and small in the ring, so they may run closer to it than the square ones
 * without reading oversized. Ported from the design project's FIT map.
 */
const FIT: Partial<Record<SiteIconName, number>> = {
  punakha: 1.32,
  jakar: 1.25,
}

export type SiteIconProps = {
  name?: SiteIconName
  /** Height in px (unframed) or the square box size (framed). Framed reads best at 72–96. */
  size?: number
  color?: string
  framed?: boolean
  ring?: string
  style?: CSSProperties
}

/**
 * Bhutanese architectural silhouette rendered as a flat single-colour mask.
 *
 * The generic names (dzong, chorten, stupa, monastery, pavilion, dzong-long,
 * buddha) are building types; `taktsang`, `punakha` and `jakar` are the three
 * place-specific silhouettes — Tiger's Nest on its cliff, Punakha Dzong's long
 * wall with three towers, and Jakar Dzong's tall utse on its hill.
 *
 * `framed` gives every silhouette the same square footprint: fitted by its
 * longest side inside a size×size box, standing on a gold hairline baseline
 * inside a thin gold ring. Use framed wherever several icons sit side by side.
 */
export function SiteIcon({
  name = 'dzong',
  size = 40,
  color,
  framed = false,
  ring = 'var(--gold)',
  style,
}: SiteIconProps) {
  const url = asset(`icons/${name}.png`)
  const r = RATIO[name] ?? 1

  const mask: CSSProperties = {
    background: color || 'var(--ink)',
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center bottom',
    maskPosition: 'center bottom',
  }

  if (!framed) {
    return (
      <span
        role="img"
        aria-label={name}
        style={{
          display: 'inline-block',
          width: Math.round(size * r),
          height: size,
          ...mask,
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          ...style,
        }}
      />
    )
  }

  const inner = Math.round(size * 0.56 * (FIT[name] ?? 1))
  const w = r >= 1 ? inner : Math.round(inner * r)
  const h = r >= 1 ? Math.round(inner / r) : inner

  return (
    <span
      role="img"
      aria-label={name}
      style={{
        position: 'relative',
        display: 'inline-grid',
        placeItems: 'end center',
        width: size,
        height: size,
        boxSizing: 'border-box',
        borderRadius: '50%',
        border: `1px solid ${ring}`,
        ...style,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '18%',
          right: '18%',
          bottom: '26%',
          borderTop: `1px solid ${ring}`,
          opacity: 0.7,
        }}
      />
      <span style={{ position: 'relative', width: w, height: h, marginBottom: Math.round(size * 0.26), ...mask }} />
    </span>
  )
}
