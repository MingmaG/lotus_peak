# Effects integration audit — prototype

Scope: every motion/visual effect in the design project's website UI kit, checked at source.
Files audited: `ui_kits/website/Motion.jsx`, `Home.jsx`, `TrekList.jsx`, `TrekDetail.jsx`,
`About.jsx`, `Culture.jsx`, `Contact.jsx`, `index.html`, `tokens/motion.css`, `tokens/base.css`.

Verdict: **the effects are not all properly integrated.** Nine of them work. The section-motif
watermark system is entirely dead, one screen has no entrance animation at all, and the
reveal system is unsafe for server rendering. Details below, each with the fix the Next.js
port must apply.

**Status.** All fourteen are addressed in the built site — see the checklist in §C for what
was done and what is verified. This document stays as the record of what the prototype does,
so the defects are not reintroduced when a component is re-synced from the design project.

---

## A. What works

| Effect | Where | Status |
| --- | --- | --- |
| `Parallax` — image translates against scroll, `scale(1.14)` overscan | heroes, `Split`, `Band`, season images, overview images | Works. Guards `prefers-reduced-motion`, rAF-throttled, skips offscreen. |
| `breathe` — 8s scale 1 → 1.035 on the parallax wrapper | every `Parallax` | Works. |
| `mist` — 24s slow drift on the home hero image | `Home` hero only | Works. |
| `Reveal` — fade + rise + deblur, staggered by `delay` | most sections | Works in the browser. See **B4** for the SSR problem. |
| `Band` — full-bleed chapter opener, speed 1.2, staged 0/240/480/720ms | Home ×2, TrekDetail ×1, Culture ×1 | Works. |
| `Strip` — horizontal gallery scrubbed by page scroll | Home, TrekDetail | Works, with caveats **B5**, **B6**. |
| `Dignities` — page-wide fixed watermark cycling tiger → snow lion → garuda → dragon | site-wide, in `index.html` | Works. See **B7**. |
| `ScrollCue` — "Scroll" + the `cue` keyframe wiping a hairline | Home, Culture, TrekDetail heroes | Works. |
| `halo` — 8s radial white breath over the whole viewport | `index.html`, `zIndex 150` | Works. |
| Sticky section nav with scroll-spy + smooth jump | `TrekDetail` | Works. Measures nav height with a `ResizeObserver`. |
| `Season` disclosure — `grid-template-rows: 0fr → 1fr` | `Home` | Works. Correct technique for animating to auto height. |

## B. Defects

### B1 — The section motif system is dead on every light-ground section
**Severity: high.** `Motion.jsx` defines two functions. `ShadowArt` is the real implementation:
it places a desaturated illustration behind a section, masked to a radial falloff, drifting
on scroll, `mix-blend-mode: multiply` on paper and `luminosity` on pine. `Shadow` is a stub:

```js
function Shadow({ground}){ return ground ? <div …gradient…/> : null }
```

It accepts only `ground`. Every call site passes `name`, `side`, `size` and `offset`, and all
four are silently discarded. On a light ground it returns `null`.

Dead call sites:

| File | Call | Renders |
| --- | --- | --- |
| `Home.jsx` purpose section | `<Shadow name="dragon" side="center" size="min(1100px,92%)"/>` | nothing |
| `Home.jsx` Destinations | `<Section ground motif="friends" …>` | pine gradient only, no thangka |
| `Home.jsx` Reflections | `<Section motif="dzong-long" …>` | nothing |
| `TrekList.jsx` | `<Shadow name="dragon" side="right" size="60%"/>` | nothing |
| `About.jsx` hero | `<Shadow name="mural" side="right" size="50%"/>` | nothing |
| `About.jsx` pledge | `<Section ground motif="thangka" …>` | pine gradient only |
| `Culture.jsx` articles | `<Shadow name="animals" side="left" size="44%"/>` | nothing |
| `Contact.jsx` | `<Shadow name="chorten" size="34%" side="right"/>` | nothing |

`ShadowArt` is **never exported** — it is absent from the `Object.assign(window, {…})` list at
the bottom of `Motion.jsx` — so it is unreachable dead code, and `MOTIF` and `SILHOUETTE`
exist only to serve it.

The in-file comment explains the intent: *"Section motifs are retired in favour of the
page-wide Dignities layer so the two never overlap."* So the retirement was deliberate, but it
was done by gutting the component instead of removing the call sites — leaving eight props
lying about a layer that does not exist.

**Fix in the port.** Decide per section, explicitly, and encode the decision in types:
- Keep `Dignities` as the site-wide ground (it is the stronger idea and it is working).
- Reinstate `ShadowArt` only for **dark (`ground`) sections**, where `Dignities`'
  `mix-blend-mode: multiply` at 9% opacity is invisible anyway, so the two cannot collide.
  That restores the `friends` thangka on Destinations and the `thangka` on the About pledge.
- Delete `motif` / `name` / `side` / `size` props from every light-ground call site rather
  than passing props that do nothing.
- `SectionProps.motif` must be typed so that it is only accepted when `ground` is `true`.

### B2 — `TrekList` has no entrance animation
**Severity: medium.** `TrekList.jsx` imports nothing from the motion module except the dead
`Shadow`. Its eyebrow, `h1`, lead paragraph, `Tabs` and the whole two-column card grid render
with no `Reveal`. It is the only screen where content appears instantly, and it sits directly
between Home and TrekDetail, both of which are heavily staged — so the break is visible in
normal navigation.

**Fix.** Wrap the header in `Reveal` (0 / 200 / 400ms, matching `Section`) and stagger the
cards at `i * 220` with `y={40}`, exactly as `Home`'s trip grid does. Re-stagger on filter
change, keyed by the active filter.

### B3 — Unanimated headers on About and Contact
**Severity: low.** `About.jsx`'s hero block (eyebrow, `h1`, the two `Divider`+copy pairs) and
all of `Contact.jsx` render without `Reveal`. `About`'s "Our purposes" rows and the
`WindowFrame` are also unwrapped. Same inconsistency as B2, smaller surface.

**Fix.** Apply the standard header cadence. `WindowFrame` gets `<Reveal y={40}>`.

### B4 — `Reveal` renders `opacity: 0` on the server
**Severity: high — this is the one that breaks in Next.js, not in the prototype.**

`Reveal` initialises `on = false` and renders `opacity: 0; transform: translateY(18px);
filter: blur(6px)`. `on` only becomes `true` inside `useEffect`. In the prototype that is
invisible because everything is client-rendered by Babel-in-the-browser. Under Next.js SSR,
**the server sends a page whose entire body is transparent**, and it stays that way until
hydration — a blank white screen on slow connections, and a blank page for anything that
reads the HTML without executing it.

`useInView` also fires a synchronous in-viewport check inside the effect, which still costs
one paint at `opacity: 0` — a flash on every navigation.

**Fix.** Invert the default. The finished state is the server-rendered state; animation is
additive:

```css
.reveal { opacity: 1; transform: none; filter: none; }
.motion-ready .reveal          { opacity: 0; transform: translateY(var(--reveal-y)); filter: blur(6px); }
.motion-ready .reveal[data-in]  { opacity: 1; transform: none; filter: none; }
```

`motion-ready` is set on `<html>` by a tiny inline script that runs before paint and only when
`prefers-reduced-motion` is not set. No JS, old browser, or reduced motion → fully visible,
correctly laid out, zero animation. See `docs/specs/03-motion-and-effects.md` §3.

### B5 — `Strip` fights the user
**Severity: medium.** `Strip`'s docstring says the gallery is *"scrubbed by wheel/drag **or**
the scroll of the page"*. It is not — the rAF loop assigns `el.scrollLeft` on every frame the
strip is in view, so any drag or trackpad swipe is overwritten on the next frame. The element
is horizontally scrollable (`overflow-x: auto`) and advertises itself as draggable, then
refuses to move. On touch devices this reads as broken.

**Fix.** Either drop the affordance (`overflow-x: hidden`, transform the inner track instead
of setting `scrollLeft`) or yield: on `pointerdown` / `wheel` with `deltaX`, stop driving the
strip for that element for the rest of the session. Prefer the first — it also removes the
layout thrash of writing `scrollLeft` at 60fps.

### B6 — `Strip` ignores `prefers-reduced-motion`
**Severity: medium (accessibility).** `Parallax`, `ShadowArt` and `Dignities` all check
`matchMedia('(prefers-reduced-motion:reduce)')` before writing transforms. `Strip` does not,
so a user who has asked for no motion still gets a gallery that slides sideways as they
scroll. The `motion.css` media query zeroes durations but cannot stop a rAF loop.

**Fix.** Same guard as `useParallax`, plus centralise it: one `usePrefersReducedMotion()` hook
that every effect consumes, so the check can never be forgotten again.

### B7 — `Dignities` picks the wrong panel before images load
**Severity: low.** The index is `floor(scrollY / (scrollHeight - innerHeight) * 4)`, armed
700ms after mount. `scrollHeight` at 700ms is measured against a document whose images have
mostly not loaded, so the denominator is too small and the dignity can be one or two steps
ahead; it corrects on the next `scroll` or `resize`, which on a page the user has not scrolled
yet never comes.

**Fix.** Recompute on `load`, and observe `document.body` with a `ResizeObserver` instead of
relying on the 700ms timer.

### B8 — Hardcoded `marginTop: -88` vs. measured nav height
**Severity: low.** Three heroes pull themselves under the nav with `marginTop: -88`
(`Home`, `Culture`, `TrekDetail`), while `TrekDetail`'s sticky section nav *measures* the real
nav with a `ResizeObserver`. The two disagree the moment the nav changes height — which it
does when `scrolled` toggles and at mobile breakpoints, leaving a hairline gap or an overlap
at the top of the hero.

**Fix.** One source of truth: the nav writes its height to `--nav-h` on `:root`; heroes use
`margin-top: calc(var(--nav-h) * -1)`; the sticky sub-nav uses `top: var(--nav-h)`.

### B9 — Keyframes live in the prototype's page `<style>`, not in the design system
**Severity: high risk of silent loss.** `breathe`, `surface`, `halo`, `mist` and `cue` are
declared in `ui_kits/website/index.html`, not in `tokens/motion.css` — but they are referenced
from `Motion.jsx` (`breathe`, `cue`, `surface`), from `Home.jsx` (`mist`) and from the app
shell (`halo`, `surface`). A port that copies `styles.css` and the components, and not the
page `<style>` block, loses every looping animation on the site and fails silently.

Also in that block, and equally easy to lose:
```css
button,a,img,[role=button]{transition-timing-function:var(--ease-inhale)!important}
html{scroll-behavior:smooth} body{overscroll-behavior-y:none}
@media(prefers-reduced-motion:reduce){*{animation:none!important} html{scroll-behavior:auto}}
```

**Fix.** All five keyframes and those globals move into `src/motion/motion.css`, imported by
the root layout. `docs/specs/03-motion-and-effects.md` §6 has the full text.

### B10 — Roughly a dozen independent scroll listeners per page
**Severity: medium (performance).** `TrekDetail` alone attaches: one per `Parallax` (hero +
overview + `Band`'s inner `Parallax` = 3), one per `Strip` (1), the section spy (1), plus
`Dignities` (1) and the app's `scrolled` flag (1) from the shell — each with its own rAF
throttle, each calling `getBoundingClientRect()` on a different element in a different frame.
`useInView` adds one more per `Reveal` until it fires, and `TrekDetail` has upwards of 15
`Reveal`s.

**Fix.** One `ScrollBroker`: a single passive `scroll` listener, one rAF, one batched read
phase and one write phase. Everything subscribes. See spec §4.

### B11 — `Input`'s type declaration is incomplete
**Severity: low. Corrected after reading the implementation.** This was first
recorded as a runtime bug on the strength of `Input.d.ts`, which declares only
`label, hint, multiline, placeholder, value, onChange, type, style`. The
implementation in `Input.jsx` does spread `...rest` onto the element, so
`defaultValue` and `readOnly` reach it and the trip-detail form's prefilled
journey field does work. The defect is the declaration, not the behaviour.

**Fix.** Type it as extending the native element's props, which is what the
component already does at runtime. Done in the port: `InputProps` extends
`InputHTMLAttributes & TextareaHTMLAttributes`, and `Select` and `Checkbox`
follow the same rule.

### B12 — Disclosure inconsistency between `Season` and `Faq`
**Severity: low.** `Season` animates open with `grid-template-rows: 0fr → 1fr` over
`--dur-slow`. `Faq` on the same site does `{on && <p>}` — an instant pop. Two disclosure
behaviours in one design system.

**Fix.** One `Disclosure` primitive using the `0fr → 1fr` technique, with
`aria-controls` / `id` wired up (neither currently pairs the button to its panel).

### B13 — Dead route persistence
**Severity: cosmetic.** `index.html` writes `{r, t}` to `localStorage['lp-route']` but only
ever reads `saved.t`. The saved route is never restored. Moot after the port — Next's router
replaces it — but do not carry the `localStorage` call over.

### B14 — Content gaps behind the effects
**Severity: high for launch, not an effect bug.** `TrekDetail`'s `DAYS` map contains only
`valleys`. `meditation`, `festival` and `jomolhari` all fall through to
`DAYS[id] || DAYS.valleys` and render the sacred-valleys itinerary under their own title.
`HIGHLIGHTS`, `INCLUDED`, `EXCLUDED` and `FAQ` are single flat constants shared by all four
trips. The prototype is a design artefact, so this is expected — but it means **three quarters
of the trip content does not exist yet** and must be authored before launch. Tracked in
`docs/specs/04-content-model.md`.

---

## C. Port checklist

Every item below must be ticked before the Next.js site is considered to have the design's
effects "properly integrated".

- [x] `Reveal` is visible without JS and under reduced motion (B4) — **verified**: the
      server HTML carries `class="reveal"` with no inline `opacity:0`; the hidden state
      lives under `.motion-ready`, added before paint only when motion is wanted
- [x] One scroll broker; zero bare `scroll` listeners outside it (B10) — `src/motion/ScrollBroker.ts`.
      `NavBar`'s scrolled flag is the one remaining exception, and is intentional: it must
      run before the broker has any subscribers
- [x] One `usePrefersReducedMotion`; every rAF effect consumes it (B6)
- [x] All five keyframes + the three globals live in `src/motion/motion.css` (B9) — **verified**
      present in the built stylesheet
- [x] `--nav-h` drives every hero offset and the sticky sub-nav (B8) — `NavBar` publishes it
      from a `ResizeObserver`; `:root` seeds it at 88px for the server render
- [x] `ShadowArt` reinstated on dark sections; motif props removed from light ones (B1) —
      `SectionProps` is a discriminated union, so a motif on a paper ground is a type error
- [x] `TrekList` staged like every other screen (B2); About/Contact headers staged (B3)
- [x] `Strip` does not fight pointer input and stops under reduced motion (B5, B6) — the inner
      track is transformed, the frame is `overflow-x: hidden`, and reduced motion turns it
      into a real scroll region
- [x] `Dignities` rendered exactly once, in the site layout, driven by the broker's measured
      document height (B7) — **verified**: one instance in the DOM
- [x] One `Disclosure` primitive with correct ARIA, used by the seasons, the FAQ and the
      itinerary (B12)
- [x] `Input` types match what it already forwarded (B11)
- [x] Itinerary, highlights, inclusions and FAQ exist for all four journeys (B14) — `valleys`
      is the design's own copy; the other three are **drafted and need Lotus Peak's sign-off**
      (`src/content/data/trips.ts`)

Still to do, as e2e tests rather than code (`docs/specs/09-quality.md` §5): the no-JS,
reduced-motion, single-listener and keyboard-enquiry suites. The behaviour is built; the
regression guard is not.
