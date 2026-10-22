import 'server-only';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { McpToolError } from './errors';

/**
 * A file an AI client wants put in the media library: bytes it sent, or an
 * address it wants fetched.
 *
 * The fetch is the part that needs guarding, because the address is one a
 * model chose, and a model can be told what to fetch by any page it has read.
 * "Upload the image at http://169.254.169.254/latest/meta-data" is a request
 * for this server's cloud credentials dressed as a photograph. So:
 *
 * - https only;
 * - the hostname is resolved, and refused if *any* answer is a private,
 *   loopback, link-local or otherwise internal address — which is what stops
 *   `169.254.169.254.nip.io` getting through as a public name;
 * - redirects are followed by hand, at most five, and every hop is checked
 *   again, so a public URL that 302s to the metadata service is refused at
 *   the second hop rather than walked past at the first;
 * - the body is capped as it is read, never trusting `content-length`;
 * - the type is decided from the bytes, not the name or the header, so a
 *   sign-in page saved as `cover.jpg` is refused instead of becoming an
 *   "image" on the company's domain that will not render.
 *
 * One gap is known and accepted: the address is resolved, checked, and then
 * resolved again by `fetch`, so a DNS server that answers differently the
 * second time could still steer it. Closing that means pinning the socket to
 * the checked address, which is a dependency for a risk that needs a hostile
 * DNS server *and* a signed-in administrator's AI to be steered at it.
 */

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 20_000;

export interface IncomingFile {
  bytes: Buffer;
  contentType: string;
  filename: string;
}

export async function resolveIncomingFile(input: {
  data?: string;
  sourceUrl?: string;
  filename?: string;
}): Promise<IncomingFile> {
  if (Boolean(input.data) === Boolean(input.sourceUrl)) {
    throw new McpToolError('VALIDATION_ERROR', 'Send exactly one of `data` (base64) or `sourceUrl`.');
  }

  let bytes: Buffer;
  let fallbackName = 'upload';

  if (input.data) {
    const base64 = input.data.replace(/^data:[^;,]+;base64,/, '').replace(/\s+/g, '');
    bytes = Buffer.from(base64, 'base64');
    if (bytes.length === 0) throw new McpToolError('VALIDATION_ERROR', '`data` is not base64.');
    if (bytes.length > MAX_BYTES) tooBig(bytes.length);
  } else {
    const url = await fetchGuarded(input.sourceUrl!);
    bytes = url.bytes;
    fallbackName = decodeURIComponent(url.finalUrl.pathname.split('/').pop() || 'upload');
  }

  const contentType = sniff(bytes);
  if (!contentType) {
    throw new McpToolError(
      'VALIDATION_ERROR',
      'That is not a JPEG, PNG, WebP, AVIF, GIF or PDF — judged by its contents, not its name. ' +
        'If it came from a web address, the address may lead to a page rather than the file.',
    );
  }

  const base = (input.filename || fallbackName).replace(/[^\w.\- ]+/g, '').slice(0, 120) || 'upload';
  const filename = base.includes('.') ? base : `${base}.${EXTENSION[contentType]}`;

  return { bytes, contentType, filename };
}

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

/** The magic numbers of the six things the library takes. */
function sniff(bytes: Buffer): string | null {
  const ascii = (start: number, end: number) => bytes.subarray(start, end).toString('latin1');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (ascii(0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (ascii(0, 4) === 'GIF8') return 'image/gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(4, 8) === 'ftyp' && ['avif', 'avis'].includes(ascii(8, 12))) return 'image/avif';
  if (ascii(0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

function tooBig(size: number): never {
  throw new McpToolError(
    'VALIDATION_ERROR',
    `That file is ${(size / 1024 / 1024).toFixed(1)} MB; the library takes 25 MB at most.`,
  );
}

async function fetchGuarded(address: string): Promise<{ bytes: Buffer; finalUrl: URL }> {
  let url = parse(address);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublic(url);

    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'image/*,application/pdf;q=0.9,*/*;q=0.1' },
      });
    } catch {
      throw new McpToolError('VALIDATION_ERROR', `${url.host} could not be reached, or took too long.`);
    }

    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get('location');
      if (!next) throw new McpToolError('VALIDATION_ERROR', `${url.host} redirected to nowhere.`);
      url = parse(new URL(next, url).toString());
      continue;
    }

    if (!response.ok || !response.body) {
      throw new McpToolError('VALIDATION_ERROR', `${url.host} answered ${response.status}.`);
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        tooBig(total);
      }
      chunks.push(value);
    }
    return { bytes: Buffer.concat(chunks), finalUrl: url };
  }

  throw new McpToolError('VALIDATION_ERROR', `More than ${MAX_REDIRECTS} redirects; not followed.`);
}

function parse(address: string): URL {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new McpToolError('VALIDATION_ERROR', '`sourceUrl` is not a web address.');
  }
  if (url.protocol !== 'https:') {
    throw new McpToolError('VALIDATION_ERROR', 'Only https:// addresses are fetched.');
  }
  if (url.username || url.password) {
    throw new McpToolError('VALIDATION_ERROR', 'An address with credentials in it is not fetched.');
  }
  return url;
}

async function assertPublic(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true, verbatim: true })
        .then((answers) => answers.map((answer) => answer.address))
        .catch(() => {
          throw new McpToolError('VALIDATION_ERROR', `${host} does not resolve.`);
        });

  if (addresses.length === 0 || addresses.some(isInternal)) {
    throw new McpToolError(
      'VALIDATION_ERROR',
      `${host} is not a public address, so it is not fetched. Send the file’s bytes in \`data\` instead.`,
    );
  }
}

/** Anything a request from this server should never reach on a model's say-so. */
export function isInternal(address: string): boolean {
  const lower = address.toLowerCase();

  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isInternal(mapped[1]!);

  if (isIP(lower) === 4) {
    const [a, b] = lower.split('.').map(Number) as [number, number];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  if (isIP(lower) === 6) {
    return (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      /^fe[89ab]/.test(lower) ||
      lower.startsWith('ff')
    );
  }

  return true;
}
