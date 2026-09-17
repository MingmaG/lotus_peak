# 03 — Motion and effects

The effects are the design. A faithful port of the components with the motion approximated is
a failed port. This document is the contract: exact formulas, exact timings, exact guards.

Read `docs/audit/effects-integration.md` alongside it — it lists the fourteen things the
prototype gets wrong, referenced here as **B1**–**B14**.

## 1. Principles

- **Breath, not urgency.** Nothing is fast. `--dur-reveal` is 1.8s, `--dur-breath` is 8s,
  `--dur-mist` is 24s. There is no spring, no bounce, no overshoot.
- **Motion is additive.** The still page is the correct page. Every effect layers on top of a
  fully readable, fully laid-out document (**B4**).
- **One system per surface.** A section gets the page-wide `Dignities` ground *or* its own
  `ShadowArt` motif, never both (**B1**).
- **Reduced motion is a first-class state**, not a degradation. It is tested (`09-quality.md`).

## 2. Tokens

From `tokens/motion.css`, unchanged:

```css
--ease-breath: cubic-bezier(.4,0,.2,1);     /* generic transitions */
--ease-drift:  cubic-bezier(.25,.46,.45,.94);/* long ambient drift (mist) */
--ease-settle: cubic-bezier(.16,1,.3,1);    /* arrivals: transform on reveal */
--ease-inhale: cubic-bezier(.37,0,.63,1);   /* symmetric breath: opacity, loops */
--dur-quick:  .3s   --dur-slow: .7s   --dur-reveal: 1.8s
--dur-breath: 8s    --dur-mist: 24s
```

`@media (prefers-reduced-motion: reduce)` sets every duration to `0s`. That kills CSS
transitions and animations but **cannot stop a rAF loop** — JS guards are still required
(**B6**).

New tokens this port adds:

```css
--reveal-y: 18px;          /* default Reveal rise; Reveal accepts an override */
--reveal-blur: 6px;
--nav-h: 88px;             /* written by NavBar at runtime; see §7 */
```

## 3. `Reveal` — the entrance system

**Behaviour.** On entering the viewport, an element rises `y` pixels, fades in and
de-blurs over `--dur-reveal`, after an optional `delay`. Opacity uses `--ease-inhale`,
transform uses `--ease-settle`. `will-change` is dropped once the animation has finished
(the prototype clears it at `2400 + delay`ms — keep that).

**Staging cadence.** Reuse the prototype's rhythm exactly; it is what makes the site feel
composed rather than animated:

| Context | Delays (ms) |
| --- | --- |
| Section header (eyebrow → title → lead) | 0, 200, 400 |
| `Band` (eyebrow → title → body → cta) | 0, 240, 480, 720 |
| Hero (eyebrow → h1 → lead → cta → cue) | 0, 240, 520, 760 |
| Card / article grids | `index * 220`, `y = 40` |
| Gallery strip items | `index * 320` |
| Highlight list items | `index * 140`, `y = 18` |
| Destination rows | `index * 180` |

**SSR-safe implementation (B4).** The server renders the finished state. Animation is opted
into by a class on `<html>`, set before first paint by a blocking inline script:

```html
<script>
  try {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
      document.documentElement.classList.add('motion-ready')
  } catch {}
</script>
```

```css
.reveal { opacity: 1; transform: none; filter: none; }

.motion-ready .reveal {
  opacity: 0;
  transform: translateY(var(--reveal-y));
  filter: blur(var(--reveal-blur));
  will-change: opacity, transform, filter;
  transition:
    opacity   var(--dur-reveal) var(--ease-inhale) var(--reveal-delay, 0ms),
    transform var(--dur-reveal) var(--ease-settle) var(--reveal-delay, 0ms),
    filter    var(--dur-reveal) var(--ease-inhale) var(--reveal-delay, 0ms);
}
.motion-ready .reveal[data-in="true"] { opacity: 1; transform: none; filter: none; }
.motion-ready .reveal[data-done="true"] { will-change: auto; }
```

```tsx
'use client'
export function Reveal({ children, delay = 0, y, as: As = 'div', ...rest }: RevealProps) {
  const [ref, inView] = useInView()
  const done = useDelayedFlag(inView, 2400 + delay)
  return (
    <As ref={ref} className="reveal" data-in={inView} data-done={done}
        style={{ '--reveal-delay': `${delay}ms`, ...(y != null && { '--reveal-y': `${y}px` }) }}
        {...rest}>
      {children}
    </As>
  )
}
```

No JS, hydration not finished, reduced motion, crawler → visible, laid out, still. This is
non-negotiable; there is a Playwright test for it.

**`useInView`.** `IntersectionObserver` with `rootMargin: '0px 0px -12% 0px'`,
`threshold: 0.08`, disconnecting on first intersection. If the element is already in the
viewport at mount, set `data-in` synchronously in a layout effect so there is no flash
(**B4**). No `IntersectionObserver` → treat as in view.

## 4. `ScrollBroker` — the one listener (B10)

Every scroll-driven effect subscribes to a single broker. There is an ESLint rule banning
`addEventListener('scroll'` anywhere else.

```ts
type Frame = { scrollY: number; vh: number; docHeight: number }
type Reader<T> = (el: Element, f: Frame) => T          // measure phase — may read layout
type Writer<T> = (el: HTMLElement, v: T) => void       // mutate phase  — may not read layout

subscribe<T>(el: Element, read: Reader<T>, write: Writer<T>): () => void
```

One passive `scroll` listener, one `resize` listener, one `ResizeObserver` on
`document.body`, one `requestAnimationFrame`. Each frame runs **all reads, then all writes**,
so layout is never thrashed. Subscribers whose element is outside the viewport are skipped
before the read. The loop does not run at all when `usePrefersReducedMotion()` is true.

## 5. The effects

### `Parallax`

The signature effect. A container with `overflow: hidden`; inside it a wrapper carrying the
8s `breathe` animation; inside that the image at `scale(1.14)` translated against scroll.

```
p  = (rect.top + rect.height / 2 - vh / 2) / (vh + rect.height)    // -0.5 … 0.5
ty = -p * speed * 100                                              // px
transform = translate3d(0, ty px, 0) scale(1.14)
```

Speeds in use — do not invent new ones without a reason:

| Use | speed |
| --- | --- |
| `Band` (full-bleed chapter opener) | `1.2` |
| Page heroes | `0.6` |
| `Split` image, trip overview image | `0.5` |
| Season images | `0.4` |

The `1.14` overscan is what keeps the image covering the frame at maximum offset. If you
change a speed, check the overscan still covers: `speed * 100 * 0.5 ≤ 0.07 * height`.

Guards: skip when offscreen; bail entirely under reduced motion (leaving a static
`scale(1.14)` image, which is correct and looks intentional).

### `Band`

`Parallax` at speed 1.2, `height` default `88vh`, `min-height: 560px`, with two overlays:
a flat `rgba(31,29,26,.38)` scrim and a `linear-gradient(to top, rgba(31,29,26,.55),
transparent 40%, rgba(31,29,26,.25))`. Centred copy, gold hairlines flanking the eyebrow,
staged 0/240/480/720. `align="left"` widens the container to `--container` and drops the
right-hand hairline.

### `Split`

Editorial two-column: `Parallax` image at speed 0.5 one side, copy the other, `flip` swaps
them with `direction: rtl` on the grid and `ltr` on each child. Copy stages at 0/200/400/600.
`columns` overrides the default `1fr 1fr` (Home's Jomzo split uses `1.35fr 1fr`).

### `Strip`

Horizontal gallery scrubbed by page scroll:

```
p = clamp((vh - rect.top) / (vh + rect.height), 0, 1)
offset = p * (scrollWidth - clientWidth) * 0.9
```

Two fixes from the audit. **B5**: transform an inner track instead of writing `scrollLeft`,
and set `overflow-x: hidden` — the element must not advertise a drag it will override. **B6**:
under reduced motion, render as a static overflow-scrollable row with real pointer scrolling
and no scroll-driven movement. Items stage at `index * 320`.

Item widths are per-instance (`['src', '4/5', '26vw']`); keep the mixed-ratio rhythm — it is
what makes the strip read as a contact sheet rather than a carousel.

### `Dignities` (B7)

The site-wide ground, and the single best idea in the design. One fixed full-viewport layer,
rendered **once** in `(site)/layout.tsx`. As the reader moves through the page, the watermark
turns through the Four Dignities:

| Index | Art | English | Dzongkha | Side | Width |
| --- | --- | --- | --- | --- | --- |
| 0 | `dignity-tiger.png` | Awareness | དྲན་པ་དང་ཤེས་བཞིན། | right | 56vw |
| 1 | `dignity-snow-lion.png` | Joy and love | དགའ་བ་དང་བདེ་བ། | left | 50vw |
| 2 | `dignity-garuda.png` | Wisdom | ཤེས་རབ་དང་ཡེ་ཤེས། | right | 54vw |
| 3 | `dignity-dragon.jpg` | Compassion | སྙིང་རྗེ། | left | 58vw |

```
p = clamp(scrollY / (docHeight - vh), 0, 0.999)
index = floor(p * 4)
layer transform = translate3d(0, -p * 140 px, 0)
```

Each panel: `grayscale` + brightness/contrast per-entry, `mix-blend-mode: multiply`,
`opacity: .09`, radial mask `ellipse 50% 50% at 50% 50%, #000 40%, transparent 92%`, inside
the 8s `breathe` wrapper. Entering panel: `opacity 2.6s var(--ease-inhale)` +
`transform 3.2s var(--ease-settle)` from a 9% lateral offset. Leaving panel: `opacity 1.4s`,
then the transform resets with `0s 1.4s` delay so it does not visibly snap back.

A bottom-right caption shows the current dignity in English and Dzongkha (each re-keyed so
the 1.6s `surface` animation replays on change) over four dots, the active one gold.

**Fix B7**: `docHeight` comes from the broker, which recomputes on `load` and via a
`ResizeObserver` on `document.body` — not from a 700ms timer. Keep the initial arming delay
so the first paint does not flash a dignity in, but drive the index from real measurements.

Dzongkha text requires a font with Tibetan coverage. Commissioner has none — ship a subset of
Noto Serif Tibetan scoped to `[lang="dz"]`, preloaded, and mark the caption
`lang="dz"`. Without it these render as tofu.

### `ShadowArt` (B1)

The per-section motif. Currently dead; reinstate for **dark sections only**, where
`Dignities` (multiply at 9% on pine) is invisible and the two cannot collide.

A desaturated illustration absolutely positioned in the section, drifting `p * 60`px on
scroll, `mix-blend-mode: luminosity`, opacity `.28` for illustrations and `.14` for
silhouettes, radial-masked, plus the left-to-right pine gradient
`linear-gradient(to right, rgba(31,43,34,.7), rgba(31,43,34,0) 55%)` that `Shadow` currently
provides on its own.

Motif keys: `dragon`, `mural`, `friends`, `thangka`, `animals` (illustrations, masked and
multiplied) and `dzong`, `dzong-long`, `chorten`, `stupa`, `monastery`, `pavilion`, `buddha`
(silhouettes, unmasked, bottom-anchored, inverted on dark).

Type it so the mistake cannot recur:

```ts
type SectionProps =
  | { ground: true;  motif?: MotifName; motifSide?: 'left'|'right'|'center'; motifSize?: string }
  | { ground?: false; motif?: never; motifSide?: never; motifSize?: never }
```

Dark sections that get their motif back: Home → Destinations (`friends`),
About → the 30% pledge (`thangka`). Every light-ground call site drops the props.

### `ScrollCue`

"Scroll" in tracked caps over a 48px hairline running the `cue` keyframe — a line that wipes
down from the top, then out from the bottom, on the 8s breath. Heroes only.

### `Halo`

A fixed, `pointer-events: none` radial white wash over the whole viewport at `z-index: 150`,
pulsing 0 → 7% → 0 on the 8s breath. Rendered once in `(site)/layout.tsx`. It sits above the
nav deliberately: it is a bloom over the entire frame.

### `Disclosure` (B12)

One primitive, three uses — seasons, FAQ, itinerary days. Animate with
`grid-template-rows: 0fr → 1fr` over `--dur-slow` `--ease-breath` (the prototype's season
technique — the only way to transition to auto height), with the content also fading and
rising 6px. The toggle is a plus/minus built from two 1px rules, the vertical one
`scaleY(0)` when open over `--dur-quick`.

ARIA, which the prototype omits entirely: `<button aria-expanded aria-controls={panelId}>`
and `<div id={panelId} role="region">`. Panel content stays in the DOM when closed (it is
`0fr`, not unmounted) so it is findable by in-page search and by crawlers.

## 6. Global CSS (B9)

These live in `src/motion/motion.css`, imported by the root layout. In the prototype they are
stranded in the page's `<style>` block and would be silently lost in a naive port.

```css
@keyframes breathe { 0%,100% { transform: scale(1) }   50% { transform: scale(1.035) } }
@keyframes surface { from { opacity:0; transform: translateY(14px); filter: blur(8px) }
                     to   { opacity:1; transform: none;             filter: none } }
@keyframes halo    { 0%,100% { opacity: 0 } 50% { opacity: .07 } }
@keyframes mist    { from { transform: scale(1.14) translateY(0) }
                     to   { transform: scale(1.2)  translateY(-1.5%) } }
@keyframes cue     { 0%     { transform: scaleY(0); transform-origin: top }
                     50%    { transform: scaleY(1); transform-origin: top }
                     50.01% { transform: scaleY(1); transform-origin: bottom }
                     100%   { transform: scaleY(0); transform-origin: bottom } }

html { scroll-behavior: smooth }
body { overscroll-behavior-y: none }
button, a, img, [role=button] { transition-timing-function: var(--ease-inhale) !important }

@media (prefers-reduced-motion: reduce) {
  *    { animation: none !important }
  html { scroll-behavior: auto }
}
```

`mist` is applied only to the home hero image, on top of its parallax transform — note it
overrides the parallax `transform` while running, which is intentional: the hero drifts on its
own 24s cycle and the parallax offset is re-applied each frame underneath it.

## 7. `--nav-h` (B8)

`NavBar` measures itself with a `ResizeObserver` and writes
`document.documentElement.style.setProperty('--nav-h', h + 'px')`. Everything else reads it:

- Full-bleed heroes: `margin-top: calc(var(--nav-h) * -1)` — replaces the hardcoded `-88`.
- Trip detail sticky sub-nav: `top: calc(var(--nav-h) - 1px)`.
- Scroll-spy jump offset: `var(--nav-h) + 56px`.

Initial value `88px` in `:root` so the server-rendered page is right before hydration.

## 8. Performance budget

- **At most 6 active parallax subscribers per viewport.** Trip detail has hero + overview +
  two `Band`s + a `Split`; that is fine. If a page exceeds six, the broker warns in dev.
- `will-change` is set only while an element is animating and cleared afterwards. The
  prototype already does this for `Reveal`; do it for `Parallax` too — drop `will-change`
  when the element leaves the viewport.
- Every parallax image is `next/image` with `sizes` set and `priority` only on the LCP hero.
- The `Dignities` art is four large PNG/JPGs. Serve them as AVIF/WebP at ≤ 1200px wide;
  they sit at 9% opacity behind a mask, so quality can be low. Lazy-load panels 1–3.
- Target: no layout shift from any effect. All parallax and motif layers are absolutely
  positioned inside a sized container, so none of them can shift content — keep it that way.

## 9. Acceptance tests

| Test | Assertion |
| --- | --- |
| No-JS | JS disabled, `/` and `/trips/valleys` show every heading and paragraph, correctly positioned |
| Reduced motion | With the emulated preference: zero `transform` mutations after load, no rAF loop running, all content visible |
| Reveal | With JS, elements below the fold start at `opacity: 0` and reach `1`; elements above the fold never paint at `0` |
| Broker | Exactly one `scroll` listener on `window` after load on every route |
| Nav offset | `--nav-h` equals the nav's measured height at 360px, 768px and 1440px, scrolled and unscrolled |
| Dignities | Exactly one instance in the DOM; index advances 0→3 across a full scroll of `/` |
| Strip | Reduced motion: horizontal scroll position does not change on vertical scroll |
| Disclosure | `aria-expanded` and `aria-controls` correct on seasons, FAQ and itinerary |
