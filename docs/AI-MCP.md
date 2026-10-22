# Working the panel from an AI client

The admin panel speaks **MCP** (the Model Context Protocol), so somebody in the
office can point Claude, Claude Code or ChatGPT at it and work by conversation:
*"find the published journeys with no meta description and write one for each
from its overview"*, *"rewrite day 3 of the Jomolhari trek"*, *"which enquiries
from this week have nobody on them?"*

The split is deliberate. The AI brings the reasoning and the orchestration.
The panel keeps identity, permissions, the company's rules, a person's
approval and the record of what happened — server-side, where nothing a model
reads can talk its way round them.

---

## For the office

### Switching it on

Two switches, both off by default, the owner's included:

1. **The role.** On the Roles screen, *AI clients → Change* lets a role work
   through an AI client. Editors have it in a fresh install; Reservations and
   Viewer do not. *AI clients → Publish* lets a role approve what an AI asks
   for, and *→ Remove* lets it manage access and the policy.
2. **The person.** Under **AI clients → Access**, the switch beside each name.
   Turning it off disconnects that person's AI clients at once.

Then **AI clients → Connect a client** has the address and the steps.

### What happens at once, and what waits

| Happens at once | Waits for a person in AI clients → Approvals |
| --- | --- |
| Every read | Publishing and unpublishing anything |
| Edits to a **draft** journey, entry, page or place | Any edit to something **already published** |
| SEO fields, even on a published page | Any price — a journey's from-price, tiers, note |
| Photograph descriptions, uploads | A new departure; a departure's price or dates |
| Working an enquiry: status, priority, assignee, a note | Cancelling or deleting a departure |
| | Deleting a journey (critical: no setting can change this) or an entry |
| | A redirect |

**AI clients → Access → Approval policy → "Every write waits"** is the
cautious setting while the office learns to trust it. It can only add
approvals; nothing there lets a price or a published page through unattended.

An approval card shows what would change, field by field, as the record was
when the AI asked. If somebody edits the record before it is approved,
approving it is refused rather than carried out over their work.

### What an AI can never do

- Anything the person's own role does not allow.
- See a traveller's email address, telephone or IP address. Enquiries come
  back with a name, a country and what they wrote.
- Send anything to a traveller. Marking an enquiry *replied* records that
  somebody replied; it does not reply.
- Approve its own request, or have one approved by talking to somebody in a
  chat window. Approving happens in this panel, signed in, or not at all.
- Fetch from the office network. An upload from an address is https-only and
  refused if the address, or any redirect on the way, is private.

### If something looks wrong

**AI clients → AI activity** has every call any AI made — the refused ones
too, with the arguments it sent. Every change it made is also on the ordinary
**Activity** screen, under the person's name, marked as made through an AI
client. **AI clients → Access → Connected clients** disconnects a client or
blocks it outright; both cut it off on its next call.

---

## For whoever maintains it

### The shape

```
AI client ──OAuth 2.1 + PKCE──▶ /api/mcp (Streamable HTTP, stateless, JSON)
                                    │
                    token → person, role re-read on every call
                                    │
                    scope (mcp:read / mcp:write) ∩ the role's permission
                                    │
                             tool.prepare()  — reads, works out the diff
                                    │
                ┌───────────────────┼────────────────────┐
             dryRun            no approval           approval needed
           (preview)               │                       │
                                   ▼                       ▼
                            tool.execute()         mcp_approvals row
                                   │               … a person approves …
                                   │                       │
                                   │               re-check, tool.execute()
                                   ▼                       ▼
                 the same service the panel's Save calls → Postgres
                 → activity_logs, mcp_audit_logs, revalidate the website
```

```
apps/admin/src/server/mcp/
  oauth.ts          clients, codes, tokens; every token check
  context.ts        bearer token → Actor. Identity lives here and nowhere else
  consent.ts        the authorisation request, checked for the screen and the POST
  operation.ts      defineRead / defineWrite, PreparedOperation, assertUnchanged
  policy.ts         what waits for a person, from Setting(ai, policy)
  approvals.ts      request, approve, reject, expire
  server.ts         builds the server per request; the gate, reads, writes
  registry.ts       every tool, by name
  list-merge.ts     patch / append / remove / replace for a list
  incoming-file.ts  the guarded fetcher behind media_upload
  audit.ts          AI clients → Activity
  tools/            trips, departures, content (journal, pages, places), desk
apps/admin/src/app/
  api/mcp/                     the endpoint
  api/oauth/{register,token,revoke,authorize,well-known/*}
  (auth)/oauth/authorize/      the consent screen, behind the panel's sign-in
  (dashboard)/ai/*             Approvals, Access, AI activity, Connect
```

Discovery is at `/.well-known/oauth-protected-resource` and
`/.well-known/oauth-authorization-server` (rewrites in `next.config.ts`). The
middleware lets `/api/mcp`, the OAuth endpoints a client needs before it has a
token, and `/.well-known/` through without a cookie; the consent screen and
the POST that answers it stay behind the sign-in, because that is where the
person proves who they are. There is no second user system.

### Why every tool is published

A client reads `tools/list` once, when a conversation starts, and never
again. A tool missing from that list cannot be called in that conversation,
however it is discovered later — so partial publishing schemes trade a smaller
list for a capability that silently does not exist. At 51 tools the whole list
is about 63 KB, roughly 16,000 tokens. If it grows past a hundred or so, that
trade needs looking at again.

Publishing is not authorising. Every call goes through the gate, and `whoami`
tells a model in advance which tools its person may use.

### Things that are not obvious from the code

**Lists are patched, not replaced.** `updateTrip` replaces a list wholesale,
which suits the editor. A model reads eleven FAQs, rewrites one and sends that
one — which under replace semantics deletes ten and reports success. So every
list argument takes a `mode`, defaulting to `patch`, with rows addressed by
their 1-based `index` from the last read. A journey's child rows are recreated
on every save, so their ids do not survive one; positions do.

**`build` runs twice.** A section tool works out the patch in `prepare`
against the record as it was, and again in `execute` against the record as it
is; the `updatedAt` lock between them makes the two the same. An approved
"change day 3" means day 3, not a whole list computed an hour ago.

**Rich text goes out as stored.** Reads return a body's HTML exactly as the
column holds it, figures as `data-media-id`. Plain text would let a model flatten
every heading in an article by sending it back; the editor's resolved copy
would put derived URLs into the column.

**The record can only add approvals.** A tool's `requiresApproval` is decided
before anyone knows which record is meant; `prepare` adds `escalation` when
the record is live. `approvalRequired` checks it last, so it can only ever
tighten.

**The approver needs the request's permission too.** `ai.publish` lets
somebody decide; approving a price change also needs `trips.write`. The
request then runs as the person who asked, re-read at that moment.

**Some route handlers became services.** Saving a journal entry, a page, a
place and an enquiry lived in route handlers. They are now
`services/{post,page,destination-save,enquiry}.ts`, called by both the route
and the tool, so the rules — publish checks, slug redirects, "a fixed page
keeps its address" — exist once.

### Adding a tool

1. A `defineRead` or `defineWrite` in the right file under `tools/`, added to
   that file's exported list. The schema is a `.strict()` `ZodObject` with no
   `.refine()` on the outside — the SDK publishes a refined object as an empty
   schema and the model then calls the tool with nothing.
2. Its `permission` from the panel's own catalogue. There is no second list.
3. For a write: `prepare` reads and describes, never writes; `execute` re-reads,
   calls `assertUnchanged`, then the same service the panel calls. Record the
   change with `recordAiActivity` and tell the site with `pushToSite`.
4. Write the description's first sentence so it stands alone, and say what the
   tool will *not* do and which tool does — a model that cannot find the right
   tool improvises with a wrong one.

### Configuration

`MCP_BASE_URL` only when a client reaches the panel somewhere other than
`ADMIN_PUBLIC_URL` (a tunnel to a development machine). `MCP_EXTRA_ORIGINS`
for further addresses of the same panel. Tokens minted for any of them are
accepted; a token minted for another server never is. There is no API key and
no model key: the office uses its own Claude or ChatGPT subscription.

### Connecting

**Claude Code** — the repo's `.mcp.json` points at
`http://localhost:6011/api/mcp`. With the panel running, `/mcp` offers it and
signs you in through the panel.

**Claude and ChatGPT** need an https address reachable from the internet: the
production panel, or a tunnel to a development one with `MCP_BASE_URL` set to
the tunnel's origin.

### Not built, on purpose

- **MCP tasks.** An approval comes back as `approval_required` and an id, and
  `approval_status` finishes the job. Every client supports that; task
  support varies.
- **Idempotency keys.** A model that repeats a call that needed approval files
  a second card. `approvals_list_mine` lets it see what it already asked for.
- **Bookings, payments, customers, coupons, culture, gallery, menus,
  company settings** — not exposed. The bookings side holds passport numbers
  and money; it wants its own design rather than an afterthought.
- **An AI chat inside the panel, a model API key, scheduled AI jobs.** The AI
  client is the brain and lives elsewhere.

### Verifying a change

There is no test runner in this repo, so the integration has a smoke script
that drives it end to end against a running development panel:

```bash
npm run dev:admin
MCP_SMOKE_EMAIL=owner@lotuspeak.local MCP_SMOKE_PASSWORD=… \
  npm run mcp:smoke --workspace=@lotuspeak/admin
```

It covers OAuth with PKCE, a replayed code tearing down its tokens, refresh
rotation and reuse, consent refused while access is off, an argument a tool
does not have, a patch touching one day of twelve and nothing else, a stale
`expectedVersion`, a published edit waiting and being approved, a second
approval refused, an approval refused because the record moved, a price
change waiting and a rejection reaching the model with its reason, enquiries
without contact details, and the fetcher refusing `169.254.169.254` and
`127.0.0.1.nip.io`. It puts back every edit it makes. Anything with a button —
the approval card, the access switches — is checked in a browser as well.
