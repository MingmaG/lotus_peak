/**
 * The MCP integration, end to end, against a running development panel.
 *
 *   npm run dev:admin
 *   MCP_SMOKE_EMAIL=owner@lotuspeak.local MCP_SMOKE_PASSWORD=… npm run mcp:smoke
 *
 * OAuth with PKCE, consent through the panel's own session, then real tool
 * calls. It edits the first journey and puts every edit back, uploads a
 * one-pixel photograph and deletes it, and leaves its approval cards and audit
 * lines behind as the record of the run. Development databases only.
 */
import { createHash, randomBytes } from 'node:crypto';

const BASE = process.env.MCP_SMOKE_URL ?? 'http://localhost:6011';
const log = (label, value) => {
  const line = `${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`;
  console.log(line.length > 600 ? line.slice(0, 600) + ' …' : line);
};
const expect = (cond, label) => {
  log(cond ? 'PASS' : 'FAIL', label);
  if (!cond) process.exitCode = 1;
};

// 1. Cold connect
let r = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
expect(r.status === 401 && /resource_metadata=/.test(r.headers.get('www-authenticate') ?? ''), 'no token → 401 with challenge');

r = await fetch(`${BASE}/.well-known/oauth-protected-resource`);
const prm = await r.json();
expect(r.status === 200 && prm.resource?.endsWith('/api/mcp'), `protected-resource metadata ${JSON.stringify(prm)}`);
r = await fetch(`${BASE}/.well-known/oauth-authorization-server`);
const asm = await r.json();
expect(r.status === 200 && asm.token_endpoint, 'authorization-server metadata');

// 2. Register
const redirectUri = 'http://localhost:33418/callback';
r = await fetch(`${BASE}/api/oauth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ client_name: 'E2E test client', redirect_uris: [redirectUri], token_endpoint_auth_method: 'none' }),
});
const reg = await r.json();
expect(r.status === 201 && reg.client_id, 'dynamic registration');
r = await fetch(`${BASE}/api/oauth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ client_name: 'bad', redirect_uris: ['http://evil.example.com/cb'] }),
});
expect(r.status === 400, 'plain-http non-loopback redirect refused');

// 3. Sign in to the panel
r = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: process.env.MCP_SMOKE_EMAIL, password: process.env.MCP_SMOKE_PASSWORD }),
});
const cookies = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
expect(r.ok && cookies.includes('lp_access'), 'panel sign-in');
const me = await (await fetch(`${BASE}/api/auth/me`, { headers: { cookie: cookies } })).json();
const userId = me.user?.id ?? me.id;

// 4. Consent refused while AI access is off
const verifier = randomBytes(32).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const form = (decision) =>
  new URLSearchParams({
    client_id: reg.client_id,
    redirect_uri: redirectUri,
    state: 'xyz',
    scope: 'mcp:read mcp:write',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: prm.resource,
    decision,
  });
await fetch(`${BASE}/api/ai/users/${userId}`, { method: 'PATCH', headers: { cookie: cookies, 'content-type': 'application/json' }, body: JSON.stringify({ mcpAccessEnabled: false }) });
r = await fetch(`${BASE}/api/oauth/authorize`, { method: 'POST', redirect: 'manual', headers: { cookie: cookies, 'content-type': 'application/x-www-form-urlencoded' }, body: form('allow') });
expect(r.status === 303 && new URL(r.headers.get('location')).searchParams.get('error') === 'access_denied', 'consent refused while AI access is off');

r = await fetch(`${BASE}/api/ai/users/${userId}`, { method: 'PATCH', headers: { cookie: cookies, 'content-type': 'application/json' }, body: JSON.stringify({ mcpAccessEnabled: true }) });
expect(r.ok, 'switch AI access on');

// 5. Consent screen and allow
const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: redirectUri, state: 'xyz', scope: 'mcp:read mcp:write', code_challenge: challenge, code_challenge_method: 'S256' });
r = await fetch(`${BASE}/oauth/authorize?${q}`, { headers: { cookie: cookies } });
const html = await r.text();
expect(r.status === 200 && html.includes('E2E test client') && html.includes('Allow'), 'consent screen renders');
r = await fetch(`${BASE}/oauth/authorize?${q}`, { redirect: 'manual' });
expect(r.status === 307 && (r.headers.get('location') ?? '').includes('/login?next='), 'consent screen asks a signed-out visitor to sign in');

r = await fetch(`${BASE}/api/oauth/authorize`, { method: 'POST', redirect: 'manual', headers: { cookie: cookies, 'content-type': 'application/x-www-form-urlencoded' }, body: form('allow') });
const loc = new URL(r.headers.get('location'));
const code = loc.searchParams.get('code');
expect(r.status === 303 && code && loc.searchParams.get('state') === 'xyz', 'consent issues a code');

// 6. Token exchange
const token = (body) => fetch(`${BASE}/api/oauth/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
r = await token({ grant_type: 'authorization_code', client_id: reg.client_id, code, redirect_uri: redirectUri, code_verifier: 'wrong-verifier-wrong-verifier-wrong-verifier' });
expect(r.status === 400, 'wrong PKCE verifier refused');
r = await token({ grant_type: 'authorization_code', client_id: reg.client_id, code, redirect_uri: redirectUri, code_verifier: verifier, resource: prm.resource });
let tokens = await r.json();
expect(r.ok && tokens.access_token, `code exchanged (${r.status} ${tokens.error ?? ''})`);
r = await token({ grant_type: 'authorization_code', client_id: reg.client_id, code, redirect_uri: redirectUri, code_verifier: verifier });
expect(r.status === 400, 'replayed code refused');
// The replay revokes what the code produced.
r = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { authorization: `Bearer ${tokens.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
expect(r.status === 401, 'token from a replayed code is revoked');

// Fresh flow for the rest.
r = await fetch(`${BASE}/api/oauth/authorize`, { method: 'POST', redirect: 'manual', headers: { cookie: cookies, 'content-type': 'application/x-www-form-urlencoded' }, body: form('allow') });
const code2 = new URL(r.headers.get('location')).searchParams.get('code');
tokens = await (await token({ grant_type: 'authorization_code', client_id: reg.client_id, code: code2, redirect_uri: redirectUri, code_verifier: verifier })).json();

// Refresh rotation and reuse detection.
r = await token({ grant_type: 'refresh_token', client_id: reg.client_id, refresh_token: tokens.refresh_token });
const rotated = await r.json();
expect(r.ok && rotated.access_token, 'refresh rotates');
r = await token({ grant_type: 'refresh_token', client_id: reg.client_id, refresh_token: tokens.refresh_token });
expect(r.status === 400, 'reused refresh token refused');
r = await fetch(`${BASE}/api/mcp`, { method: 'POST', headers: { authorization: `Bearer ${rotated.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
expect(r.status === 401, 'reuse revoked the whole family');

r = await fetch(`${BASE}/api/oauth/authorize`, { method: 'POST', redirect: 'manual', headers: { cookie: cookies, 'content-type': 'application/x-www-form-urlencoded' }, body: form('allow') });
const code3 = new URL(r.headers.get('location')).searchParams.get('code');
tokens = await (await token({ grant_type: 'authorization_code', client_id: reg.client_id, code: code3, redirect_uri: redirectUri, code_verifier: verifier })).json();
const access = tokens.access_token;

// 7. MCP
let id = 0;
async function rpc(method, params) {
  const res = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  const body = await res.json();
  return body;
}
/* The published core is called by name; every capability goes through
   admin_call, which is the only way a real client can reach one. */
const CORE = ['admin_sections', 'admin_search', 'admin_describe', 'admin_call', 'whoami', 'approval_status', 'approvals_list_mine'];
const call = async (name, args = {}) => {
  const body = CORE.includes(name)
    ? await rpc('tools/call', { name, arguments: args })
    : await rpc('tools/call', { name: 'admin_call', arguments: { capability: name, arguments: args } });
  return body.result?.structuredContent ?? body;
};

const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
expect(init.result?.serverInfo?.name === 'lotuspeak-admin', 'initialize');

// The published surface is the discovery core and nothing else.
const list = await rpc('tools/list', {});
const names = list.result.tools.map((t) => t.name).sort();
const bytes = JSON.stringify(list.result.tools).length;
expect(JSON.stringify(names) === JSON.stringify([...CORE].sort()), `tools/list is the core only: ${names.join(', ')}`);
expect(bytes < 15_000, `tools/list is ${bytes} bytes`);

// Discovery.
const map = await call('admin_sections');
log('capabilities behind the core', map.result.totalCapabilities);
expect(map.success && map.result.totalCapabilities > 40, 'admin_sections maps the panel');
const inSection = await call('admin_sections', { section: 'catalogue.journeys' });
expect(inSection.result.capabilities.some((c) => c.capability === 'trips_update_faqs'), 'a section lists its capabilities');

const searches = [
  ['add an faq to a journey', 'trips_update_faqs'],
  ['rewrite day 3 of the itinerary', 'trips_update_itinerary'],
  ['change the price of a tour', 'trips_update_pricing'],
  ['unanswered enquiries', 'enquiries_list'],
  ['edit a blog post', 'journal_update'],
  ['describe a photo alt text', 'media_update'],
  ['meta descriptions missing across the site', 'seo_audit'],
  ['add a departure date', 'departures_create'],
  ['upload an image from a url', 'media_upload'],
  ['publish the journal article', 'journal_publish'],
];
for (const [query, wanted] of searches) {
  const found = await call('admin_search', { query, limit: 3 });
  const top = found.result.results.map((r) => r.capability);
  expect(top.includes(wanted), `search "${query}" → ${top.join(', ')}`);
}

const described = await call('admin_describe', { capability: 'trips_update_itinerary' });
expect(
  described.result.inputSchema?.properties?.days && described.result.inputSchema.properties.dryRun && described.result.approval,
  `admin_describe gives the schema (approval: ${described.result.approval})`,
);
const aliased = await call('admin_describe', { capability: 'blog_update' });
expect(aliased.result.capability === 'journal_update', 'an alias describes the real capability');
const invented = await call('trip_faq_add_new_one', {});
expect(invented.errorCode === 'CAPABILITY_NOT_FOUND' && invented.closest?.length > 0, `an invented name → ${invented.errorCode}, nearest ${invented.closest?.slice(0, 3)}`);

const who = await call('whoami');
expect(who.success && who.result.capabilities.every((s) => s.youMayUse === s.capabilities), `whoami (${who.result?.role})`);

const trips = await call('trips_list', { limit: 5 });
expect(trips.success && trips.result.journeys.length > 0, `trips_list through admin_call (${trips.result?.total})`);
const tripId = trips.result.journeys[0].id;
const trip = await call('trips_get', { tripId });
expect(trip.success && trip.result.itinerary.length >= 0, `trips_get "${trip.result?.title}" ${trip.result?.status}, ${trip.result?.itinerary.length} days, ${trip.result?.faqs.length} faqs`);

const bad = await call('trips_update', { tripId, role: 'owner' });
expect(bad.errorCode === 'VALIDATION_ERROR' && /role|Unrecognized/.test(JSON.stringify(bad)), 'an argument the capability does not have is refused');

// SEO: happens at once even when published.
const oldDescription = trip.result.seo.metaDescription;
const seo = await call('trips_update_seo', { tripId, seo: { metaDescription: 'E2E: a test meta description.' } });
expect(seo.success && seo.status === 'completed', `trips_update_seo ${seo.status}`);
const seoBack = await call('trips_update_seo', { tripId, seo: { metaDescription: oldDescription } });
expect(seoBack.success, 'SEO restored');

// Itinerary patch on day 2, as a dry run and then for real.
const day = trip.result.itinerary[1];
const dry = await call('trips_update_itinerary', { tripId, mode: 'patch', days: [{ index: 2, title: day.title + ' (E2E)' }], dryRun: true });
expect(dry.status === 'preview' && Object.keys(dry.result.changes).length === 1, `dryRun preview touches one day: ${Object.keys(dry.result?.changes ?? {})}, wouldNeedApproval=${dry.result?.wouldNeedApproval}`);

const stale = await call('trips_update_itinerary', { tripId, mode: 'patch', days: [{ index: 2, title: day.title + ' (E2E)' }], expectedVersion: '2000-01-01T00:00:00.000Z' });
expect(stale.errorCode === 'CONFLICT', 'stale expectedVersion refused');

const fresh = await call('trips_get', { tripId });
const edit = await call('trips_update_itinerary', { tripId, mode: 'patch', days: [{ index: 2, title: day.title + ' (E2E)' }] });
log('itinerary edit', { status: edit.status, approvalId: edit.approvalId });
let approvalId = edit.approvalId;
if (edit.status === 'approval_required') {
  expect(true, 'published journey edit waits for approval');
  const st = await call('approval_status', { approvalId });
  expect(st.status === 'approval_required', 'approval_status says pending');
  r = await fetch(`${BASE}/api/ai/approvals/${approvalId}`, { method: 'POST', headers: { cookie: cookies, 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }) });
  const decided = await r.json();
  expect(r.ok && decided.outcome.status === 'completed', `approved in the panel → ${decided.outcome?.status} ${decided.outcome?.message ?? ''}`);
  const st2 = await call('approval_status', { approvalId });
  expect(st2.status === 'completed' && st2.result.changed, 'approval_status says completed');
  r = await fetch(`${BASE}/api/ai/approvals/${approvalId}`, { method: 'POST', headers: { cookie: cookies, 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }) });
  expect(r.status === 409, 'second approval refused');
} else {
  expect(edit.status === 'completed', 'draft journey edit happens at once');
}
const after = await call('trips_get', { tripId });
expect(
  after.result.itinerary.length === fresh.result.itinerary.length &&
    after.result.itinerary[1].title === day.title + ' (E2E)' &&
    after.result.itinerary[0].title === fresh.result.itinerary[0].title &&
    after.result.itinerary.at(-1).body === fresh.result.itinerary.at(-1).body &&
    JSON.stringify(after.result.faqs) === JSON.stringify(fresh.result.faqs),
  'patch changed day 2 only; other days and FAQs untouched',
);

// Stale approval: request, change the record underneath, approve → refused.
const req2 = await call('trips_update_itinerary', { tripId, mode: 'patch', days: [{ index: 2, title: day.title }] });
if (req2.status === 'approval_required') {
  await call('trips_update_seo', { tripId, seo: { focusKeyword: 'e2e-bump' } });
  r = await fetch(`${BASE}/api/ai/approvals/${req2.approvalId}`, { method: 'POST', headers: { cookie: cookies, 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }) });
  const o = (await r.json()).outcome;
  expect(o.status === 'failed' && o.errorCode === 'ENTITY_STATE_CHANGED', `approval of a changed record refused (${o.status} ${o.errorCode})`);
  await call('trips_update_seo', { tripId, seo: { focusKeyword: fresh.result.seo.focusKeyword } });
  // Put the title back, and reject a second request with a reason.
  const req3 = await call('trips_update_itinerary', { tripId, mode: 'patch', days: [{ index: 2, title: day.title }] });
  await fetch(`${BASE}/api/ai/approvals/${req3.approvalId}`, { method: 'POST', headers: { cookie: cookies, 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }) });
  const restored = await call('trips_get', { tripId });
  expect(restored.result.itinerary[1].title === day.title, 'day 2 title restored');
  const req4 = await call('trips_publish', { tripId });
  log('publish an already-published journey', req4.errorCode ?? req4.status);
} else {
  await call('trips_update_itinerary', { tripId, mode: 'patch', days: [{ index: 2, title: day.title }] });
}

const price = await call('trips_update_pricing', { tripId, priceFromUsd: (fresh.result.pricing.priceFromUsd ?? 0) + 1 });
expect(price.status === 'approval_required', 'price change always waits');
r = await fetch(`${BASE}/api/ai/approvals/${price.approvalId}`, { method: 'POST', headers: { cookie: cookies, 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'reject', reason: 'E2E: not today' }) });
const rej = await call('approval_status', { approvalId: price.approvalId });
expect(rej.status === 'rejected' && rej.reason === 'E2E: not today', 'rejection reaches the AI with its reason');

const enquiries = await call('enquiries_list', { limit: 3 });
const leaked = JSON.stringify(enquiries).match(/"(email|phone)"/);
expect(enquiries.success && !leaked, `enquiries_list carries no email/phone (${enquiries.result?.enquiries.length})`);

const audit = await call('seo_audit');
expect(audit.success, `seo_audit: ${audit.result?.checked} checked, ${audit.result?.findings.length} findings`);

const ssrf = await call('media_upload', { sourceUrl: 'https://169.254.169.254/latest/meta-data', alt: 'x' });
expect(ssrf.errorCode === 'VALIDATION_ERROR' && /not a public address/.test(ssrf.message), `SSRF refused: ${ssrf.message}`);
const ssrf2 = await call('media_upload', { sourceUrl: 'https://127.0.0.1.nip.io/x.jpg', alt: 'x' });
log('nip.io loopback', ssrf2.message);
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const up = await call('media_upload', { data: png, filename: 'e2e-pixel.png', alt: 'E2E test pixel' });
expect(up.success && up.result.id, `media_upload from data (${up.message ?? up.result?.id})`);
const html2 = Buffer.from('<html>login</html>').toString('base64');
const notImage = await call('media_upload', { data: html2, filename: 'cover.jpg', alt: 'x' });
expect(notImage.errorCode === 'VALIDATION_ERROR', 'HTML named .jpg refused');

r = await fetch(`${BASE}/api/mcp`, { method: 'OPTIONS' });
expect(r.status === 204 && r.headers.get('access-control-expose-headers')?.includes('WWW-Authenticate'), 'CORS preflight');

// Put things back.
if (up.result?.id) await fetch(`${BASE}/api/media/${up.result.id}`, { method: 'DELETE', headers: { cookie: cookies } });
await fetch(`${BASE}/api/ai/users/${userId}`, { method: 'PATCH', headers: { cookie: cookies, 'content-type': 'application/json' }, body: JSON.stringify({ mcpAccessEnabled: false }) });
console.log(process.exitCode ? '\nSome checks failed.' : '\nEverything passed.');
