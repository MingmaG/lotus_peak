# 02 — Design system

Ported 1:1 from the Claude design project `60f3a02b-9cc7-43ff-8aed-3458ffd6d9e3`
("Bhutan Sanctuary"). That project is the source of truth; `design-source/` in this repo is a
snapshot for reference. When they disagree, fetch the design project.

## 1. Tokens

Six files under `src/design-system/tokens/`, imported in order by `app/globals.css`:
`fonts` → `colors` → `typography` → `spacing` → `motion` → `base`.

They are copied verbatim from the design project and are already present in
`design-source/tokens/`. Do not edit values during the port; if something needs to change,
change it in the design project first.

### Colour

Premium white grounds, monk-robe accents, Himalayan greens, gold as line only.

```
Base       --paper #FFFFFF  --paper-2 #F7F7F6  --paper-3 #ECECEA
           --stone-1 #8A857C  --stone-2 #5E5A53  --wood #4B3A2F  --ink #1F1D1A
Robe       --saffron #D98A2B  --saffron-2 #E8A23C  --saffron-soft #F3DDBC
           --maroon #7A1F2B   --maroon-2 #5E1620
Himalaya   --pine #2F4032  --pine-2 #1F2B22  --pine-soft #D6DCD3
           --slate #4A5A66  --slate-soft #D9DEE2
Gold leaf  --gold #B9975B  --gold-soft #E6D8B8        (hairlines and rules only, never fills)
Flags      --flag-{blue,white,red,green,yellow}       (the Divider variant="flags" only,
                                                       at most once per page)
```

Semantic aliases are what components use: `--surface-page`, `--surface-sunken`,
`--surface-ground`, `--text-body`, `--text-muted`, `--text-faint`, `--text-accent`,
`--border-hairline`, `--border-gold`, `--cta-bg`, `--focus-ring`.

Never use a base token where a semantic one exists. Never use a raw hex — Stylelint rejects it
outside `tokens/`.

### Type

One family: **Commissioner**, self-hosted TTFs, weights 100–900. Display is 700, card titles
600, labels/nav 500, body 400.

```
--text-display  clamp(3rem, 6.5vw, 5.5rem)     --leading-display 1.05
--text-h1       clamp(2.5rem, 4.5vw, 4rem)     --leading-heading 1.2
--text-h2       clamp(2rem, 3.2vw, 2.875rem)   --leading-body    1.65
--text-h3       1.75rem                        --leading-lead    1.55
--text-lead     1.375rem                       --tracking-display -.01em
--text-body-size 1.125rem                      --tracking-label   .16em
--text-small    1rem                           --tracking-nav     .1em
--text-label    .875rem   --text-micro .75rem
```

Body is 18px — deliberately generous. Do not shrink it to fit a layout.

**Fonts in Next.** Use `next/font/local` with all eight weights, `display: 'swap'`,
`preload` on Regular (400) and Bold (700) only. Convert the supplied TTFs to WOFF2 in the
port — same files, roughly a third of the bytes. Add a Tibetan-coverage subset for the
Dzongkha in `Dignities` (see `03-motion-and-effects.md` §5).

### Space, radius, depth

4px base, `--space-1` (.25rem) to `--space-11` (12rem). Sections use `--space-10` vertical,
`--gutter` (`clamp(1.5rem, 6vw, 6rem)`) horizontal, inside `--container` (1360px).
Prose is capped at `--measure` (62ch) or `--measure-narrow` (44ch).

Radii are effectively square: `--radius-sm` and `--radius-md` are both `2px`. This is a
deliberate architectural reference — do not round anything up. Shadows are near-invisible
(`--shadow-soft`, `--shadow-lift`); the design separates by hairline and whitespace, not by
elevation.

## 2. Components

Twenty-one components in five groups. All are presentational: props in, markup out, no data
fetching, no domain types, no `process.env`. That is what keeps them testable and portable.

### core

| Component | API | Notes |
| --- | --- | --- |
| `Button` | `variant: primary\|outline\|ghost\|inverse`, `size: sm\|md\|lg`, `icon`, `href`, `disabled`, `onClick` | Saffron fill is `primary` and is limited to one per section |
| `Badge` | `tone: neutral\|pine\|saffron\|maroon\|gold` | Quiet metadata only — difficulty, season, altitude. Never promotional |
| `Divider` | `variant: hairline\|gold\|flags\|kera`, `width`, `height` | `kera` is a woven-textile rule, 6px default; `flags` at most once per page |
| `Eyebrow` | `number`, `tone: accent\|muted\|inverse` | Tracked caps label above a heading, optionally numbered (`01 — Our purpose`) |
| `SiteIcon` | `name: dzong\|chorten\|stupa\|monastery\|pavilion\|dzong-long\|buddha`, `size`, `color`, `framed`, `ring` | Flat single-colour mask of a Bhutanese silhouette. `framed` gives every icon the same square footprint inside a gold ring on a gold baseline — use it whenever several sit in a row |
| `Tooltip` | `label`, `children` | Hover/focus, for terse glosses (SDF, altitude) |
| `WindowFrame` | `src`, `alt`, `aspectRatio`, `tone: ink\|paper` | Photo inside a traditional rabsel window — carved cornice above, timber base below. One hero-scale image per page, never in a grid |

### forms

`Input` (underlined, `multiline` for messages), `Select` (underlined native with chevron),
`Checkbox` (pine-filled square), `Radio`, `Switch`, `FilterChip`.

All are label-above-in-tracked-caps, underline-only, no boxes. **Fix from audit B11**: they
must extend the corresponding native element's props and forward the rest, so
`defaultValue`, `readOnly`, `required`, `name`, `autoComplete` and `aria-*` work. The
prototype's `Input` silently drops them.

Each gains, for the port: `id` (auto-generated when absent), `error?: string` rendered under
the field in `--maroon`, and `aria-describedby` wiring for hint and error.

### navigation

| Component | API | Notes |
| --- | --- | --- |
| `NavBar` | `items`, `active`, `cta`, `onCta`, `onNavigate`, `inverse`, `scrolled`, `logoSrc`, `brand`, `menu`, `search`, `searchPlaceholder` | Transparent over a hero, frosted paper (`--blur-nav`) when scrolled or open. Default: wordmark + outlined search + a "Menu" toggle opening a paper panel in large display type. `menu={false}` puts items inline |
| `Footer` | `brand`, `logoSrc`, `onHome`, `line`, `columns`, `note` | Deep pine, three link columns, hairline legal row, short prayer-flag rule |
| `Tabs` | `tabs`, `value`, `onChange` | Underline tabs |

In the port, `onNavigate`/`onCta` callbacks are replaced by real `href`s driven by
`SiteSettings.nav` — see `07-pages-and-routing.md`. The prototype's string-matching footer
router (`{'Our trips':'trips', 'Blog':'culture', …}` in `index.html`) goes away entirely.

### journey

| Component | API | Notes |
| --- | --- | --- |
| `TrekCard` | `image`, `region`, `title`, `days`, `altitude`, `difficulty`, `price`, `excerpt`, `href`, `size: md\|lg`, `kera` | Woven kera edge on top, portrait photo with region label, meta row, light display title. No border, no shadow. `size="lg"` + `kera={false}` is the trips-index variant |
| `Itinerary` | `days: {day?, title, meta?, body?, rest?}[]`, `collapsible`, `expanded`, `onToggle` | Vertical timeline. Rest days get a hollow gold node and read "Rest" instead of a number. `collapsible` adds circled nodes on a dashed connector with a per-day toggle |
| `Reflection` | `quote`, `name`, `detail` | Testimonial as reflection: gold rule, quote, quiet attribution. **No stars, no ratings** |

### feedback

| Component | API | Notes |
| --- | --- | --- |
| `InquiryDrawer` | `open`, `onClose`, `title`, `intro`, `children`, `footer` | Right-side drawer, gold hairline edge, slides on `--ease-settle` |
| `Toast` | `open`, `message`, `tone: pine\|error` | Ink toast with one saffron dot. Confirmation copy stays calm |

`InquiryDrawer` needs real dialog semantics in the port, which the prototype lacks:
`role="dialog" aria-modal="true"`, focus trap, focus restore on close, `Escape` to close,
`inert` on the rest of the page, and body scroll lock.

### primitives (new)

`Disclosure` — one animated show/hide with correct ARIA, replacing the three different
implementations in the prototype (`Season`, `Faq`, `Itinerary`). See
`03-motion-and-effects.md` §5.

## 3. Porting rules

- **One component per PR**, with a Storybook-equivalent route under `/_dev/ds/<name>`
  (dev-only, excluded from the production build) showing every variant side by side.
- **Styles stay as inline style objects, as in the design project.** This was specified as a
  move to CSS Modules and changed during the port: the components' hover and focus states are
  JS-state-driven by design (the Button's water fill, TrekCard's image scale and title
  recolour, NavLink's growing underline), so translating them to CSS `:hover` would have meant
  reinterpreting them rather than porting them. Every value is still a token reference, and
  the no-raw-hex rule still applies. Revisit only if a measured render cost justifies it.
- **No new visual decisions.** If the prototype does not specify a hover, focus or disabled
  state, fetch the component's `.prompt.md` from the design project — most have one — before
  inventing it.
- Every component gets a typed props interface, a unit test for its variant matrix, and an
  axe check.
- Components are server components unless they hold state. `Button` with `onClick`,
  `Tabs`, `InquiryDrawer`, `Toast`, `Itinerary` with `collapsible`, `NavBar` and the form
  fields are client. `Badge`, `Divider`, `Eyebrow`, `SiteIcon`, `WindowFrame`, `Reflection`,
  `TrekCard` and `Footer` are not.

## 4. Assets

Not yet imported — they are binary and the design MCP returns them one file at a time. Run
`pnpm assets:pull` (to be written, see `10-roadmap.md` phase 0) or export them from the design
project UI into `public/assets/`, preserving paths:

```
assets/logo.webp
assets/fonts/Commissioner-{Thin,ExtraLight,Regular,Medium,SemiBold,Bold,ExtraBold,Black}.ttf
assets/icons/{buddha,chorten,dzong,dzong-long,monastery,pavilion,stupa}.png
assets/illustrations/{bhutan-dragon.jpg, bhutan-silhouettes.png, druk-dragon-mural.jpg,
                      four-animals.jpg, four-harmonious-friends.jpg,
                      harmonious-friends-thangka.jpg,
                      dignity-{tiger,snow-lion,garuda}.png, dignity-dragon.jpg}
assets/imagery/{taktshang, punakha-foggy-dzong, punakha-dzong-bridge, memorial-chorten,
                travellers-hike, tshechu-crowd}.webp
assets/imagery/{tashichho-dzong, traditional-dress, season-spring, season-summer,
                season-autumn, season-winter}.jpg
assets/ornaments/{window-base.png, window-cornice.png, window-rabsel.jpg, window-balcony.jpg}
assets/textures/{kera-full.jpg, kera-strip.png}
```

Processing on import: fonts TTF → WOFF2; imagery → AVIF + WebP at 640/1024/1600/2400;
illustrations used as watermarks → WebP ≤ 1200px (they render at 9% opacity behind a mask);
icons and ornaments → keep PNG with alpha, they are used as CSS masks.

Every image needs a `MediaAsset` record (`04-content-model.md`) carrying real dimensions —
`next/image` needs them and CLS depends on them.
