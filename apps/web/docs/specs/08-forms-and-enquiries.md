# 08 — Forms and enquiries

The enquiry is the site's only conversion. Everything else is reading. Get this right and the
rest of the site is a brochure that works.

The design is emphatic about tone: *"No deposit, no obligation. Just a reply."* and
*"We write back personally, within two days."* The form must feel like the beginning of a
conversation, not a booking funnel.

## 1. Three entry points, one pipeline

| Surface | Fields | `source` |
| --- | --- | --- |
| `InquiryDrawer` — from any CTA, site-wide | name, email, journey (select), hopes (multiline), rest-days checkbox | `drawer` |
| `/trips/[slug]` `#enquiry` — in-page | journey (prefilled, read-only), name, email, country, phone, travellers, preferred dates, hopes | `trip-detail` |
| `/contact` | name, email, country, phone, trip, adults, children, message, rest-days checkbox | `contact` |

All three post to the same server action, validate against the same schema, and write one
`Enquiry`.

**Audit B11**: the trip-detail form prefills the journey with
`<Input defaultValue={trip.title} readOnly/>`, but `InputProps` accepts neither prop, so the
field renders empty and editable. Fix the component (forward native attributes) — and render
the prefilled journey as static text plus a hidden input, which is what it actually is.

## 2. Validation

One Zod schema, `EnquiryInput`, shared by the client and the server action.

```ts
name:      string, 2–100, trimmed                        required
email:     email, ≤254                                   required
country:   string ≤80                                    optional
phone:     string ≤40, loose — international formats vary optional
tripSlug:  enum of published slugs, or 'unsure'          optional
travellers: string ≤40  |  adults/children: 0–20         optional
preferredDates: string ≤120                              optional — free text by design
message:   string ≤4000                                  optional
restDays:  boolean                                       optional
consent:   literal(true)                                 required — see §5
```

Only name and email are required. Every additional required field costs enquiries, and the
business answers personally anyway.

**Do not add a date picker.** The design asks for "A month, or a season". A picker implies
availability the company does not publish and turns a conversation into a transaction.

## 3. Submission

A **server action**, progressively enhanced:

```tsx
const [state, action, pending] = useActionState(submitEnquiry, initialState)
<form action={action}>
```

The form works with JavaScript disabled — the action posts and the page re-renders with the
result. With JS, `pending` disables the button and the `Toast` confirms without navigation.

Server action steps, in order:

1. Rate limit by IP (`src/lib/ratelimit.ts`): 5 per hour, 20 per day. In-memory in dev, Redis
   in production, behind an adapter so neither is hardcoded.
2. Honeypot: a visually hidden, `tabindex="-1"`, `autocomplete="off"` field. Non-empty →
   return success without doing anything.
3. Timing check: a signed, timestamped token in the form; a submission under 2 seconds old is
   almost certainly a bot.
4. `EnquiryInput.parse()`. Failure returns field errors rendered under the fields.
5. `getContent().enquiries.create()`.
6. Send mail (§4). Mail failure must **not** fail the request — the record is already stored;
   log it and alert.
7. Return `{ ok: true }`. The client opens the `Toast`:
   *"Sent. We will write back within two days."*

No CAPTCHA. It is hostile, it hurts conversion on a site whose whole voice is calm, and the
three measures above handle the volume a site like this attracts. Revisit only if real spam
appears in the logs.

## 4. Mail

`src/lib/mail/` — an interface with a Resend adapter, a console adapter for dev, and an SMTP
adapter for self-hosting. No provider SDK outside that directory.

Two messages per enquiry:

- **To the team** (`ENQUIRY_TO`): subject `Enquiry — {name} — {journey or "General"}`, every
  field, `Reply-To` set to the enquirer so a reply goes straight back.
- **To the enquirer**: a short acknowledgement in the site's voice, plain text and a minimal
  HTML part. It confirms the two-day promise, repeats what they asked for, and gives the
  phone number. It does not upsell.

If `RESEND_API_KEY` is absent, the console adapter is used and a warning is logged at startup
— so a misconfigured deploy is loud, but never loses a record.

## 5. Privacy

Enquiries are personal data.

- A required consent checkbox with plain wording: *"I am happy for Lotus Peak to hold these
  details and write back to me."* Linked to `/privacy` (phase 3 — write it before launch).
- No analytics event carries the name, email or message. Track `enquiry_submitted` with
  `source` and `tripSlug` only.
- Admin read access restricted to `admin` and `viewer` roles (`06-cms-and-admin.md` §2).
- Retention: archive after 24 months, via a scheduled hook.
- The enquiries collection is never exposed through any public API.

## 6. Form components and accessibility

Using the design system's underlined fields (`02-design-system.md`), with these additions —
none of which the prototype has:

- `id` on every field, `<label for>`, and `aria-describedby` linking hint and error.
- Errors rendered under the field in `--maroon`, announced via `role="alert"`, and the first
  invalid field focused on submit.
- `autoComplete`: `name`, `email`, `tel`, `country-name`.
- `inputMode="email"` / `"tel"` for mobile keyboards.
- The submit button keeps its label while pending and shows a quiet inline state — no
  spinner, no layout shift.
- `InquiryDrawer` needs real dialog semantics: `role="dialog" aria-modal="true"`, focus trap,
  focus restored to the CTA on close, `Escape` to close, `inert` on the page behind, body
  scroll lock.
- The `Toast` is `role="status"` `aria-live="polite"`, and does **not** steal focus.
- Every form is completable and submittable by keyboard alone. This is an e2e test.
