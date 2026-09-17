# Imported design source

Reference snapshot from the Claude design-system project **"Bhutan Sanctuary"**.

- Project: `60f3a02b-9cc7-43ff-8aed-3458ffd6d9e3`
- Prototype: https://claude.ai/design/p/60f3a02b-9cc7-43ff-8aed-3458ffd6d9e3
- Imported: 2026-09-17

**The design project is the source of truth.** This directory is a snapshot for reading
offline. Nothing under `app/` or `src/` may import from it, and it is excluded from
`tsconfig.json` and the Next build.

## What is here

```
tokens/{fonts,colors,typography,spacing,motion,base}.css   verbatim
styles.css                                                 verbatim
```

Everything else is read on demand from the design project — see below.

## What is not here yet

**Binary assets.** Fonts, imagery, illustrations, icons, ornaments and textures. The design
MCP serves binaries one file at a time as base64, which is impractical to pull in bulk from a
chat session. Export them from the design project UI, or script `pnpm assets:pull`, into
`public/assets/` preserving the paths listed in `docs/specs/02-design-system.md` §4. This is
phase 0 of `docs/specs/10-roadmap.md`.

Until then the site has no imagery and no brand font — everything else can be built.

## Re-fetching a file

With the `claude_design` MCP connected (`/design-login` if not):

```
DesignSync  method=get_file
            projectId=60f3a02b-9cc7-43ff-8aed-3458ffd6d9e3
            path=components/core/Button.jsx
```

Useful paths:

| What | Path |
| --- | --- |
| Design rules | `CLAUDE.md` |
| Effects system | `ui_kits/website/Motion.jsx` |
| Screens | `ui_kits/website/{Home,TrekList,TrekDetail,About,Culture,Contact}.jsx` |
| App shell, keyframes | `ui_kits/website/index.html` |
| Kit notes | `ui_kits/website/README.md` |
| Components | `components/{core,forms,navigation,journey,feedback}/<Name>.jsx` |
| Component APIs | `components/…/<Name>.d.ts` |
| Component intent | `components/…/<Name>.prompt.md` |
| Token guidelines | `guidelines/*.html` (colour, type, spacing, motion, brand) |

`components/…/<Name>.prompt.md` is worth reading before porting a component — it records the
design intent, including states the `.jsx` does not show.

## Design rules carried into this repo

From the design project's own `CLAUDE.md`, reproduced in this repo's `CLAUDE.md` §1:

- Page and section backgrounds are premium white (`#FFFFFF`) or neutral off-white
  (`#F7F7F6`). Never cream/beige/warm-tinted grounds (`#EFE8DD`, `#F7F3EC`).
- Do not use any Claude/Anthropic brand colours, type or visual language in this design
  system.

## Known issues in the prototype

Fourteen, catalogued in `docs/audit/effects-integration.md`. Do not port them. In particular
`Motion.jsx`'s `Shadow` is a stub that discards four of its five props, and `ShadowArt` — the
real implementation — is never exported.
