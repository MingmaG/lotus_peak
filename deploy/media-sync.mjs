#!/usr/bin/env node
/**
 * Moving the media library between S3-compatible stores.
 *
 * The database and the bucket are two halves of one thing. A `media` row says
 * a photograph exists and names its renditions; the bytes live under
 * `media/<id>/<width>.<format>` in the bucket. Restore the dump without the
 * objects and every page renders perfectly with a broken image in every frame
 * — nothing errors, because nothing on the server ever fetches them.
 *
 * Three modes:
 *
 *   export   every object out of a bucket into a folder, keys preserved
 *   upload   a folder into a bucket, keys preserved
 *   verify   what is in the bucket against what is in the folder, and whether
 *            an anonymous browser can actually read one
 *
 * The folder in between is deliberate. It is what makes "I will upload it
 * through the console myself" a first-class path rather than a fallback, and
 * it is a copy of the library that exists while the new bucket is still empty.
 *
 *   node deploy/media-sync.mjs export
 *   node deploy/media-sync.mjs upload --endpoint https://s3.example.com \
 *        --bucket lotuspeak-media --access-key KEY --secret-key SECRET
 *   node deploy/media-sync.mjs verify --endpoint https://s3.example.com \
 *        --bucket lotuspeak-media --access-key KEY --secret-key SECRET \
 *        --public-url https://s3.example.com/lotuspeak-media
 *
 * RustFS, MinIO, R2 and AWS all answer the same four calls used here. Keep
 * `--force-path-style` on for RustFS and MinIO, which address a bucket by path
 * rather than by subdomain.
 */

import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'deploy/media-export');

/**
 * The same header the admin panel writes on every upload.
 *
 * A rendition key is never reused — replacing the photograph behind a media
 * row writes new keys and the row points at them — so a year is safe, and
 * without it a gallery of twenty-eight photographs is twenty-eight
 * revalidation round trips for bytes that cannot have changed.
 */
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const CONTENT_TYPES = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function contentTypeFor(key) {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
}

/* -------------------------------------------------------------------------- */
/*  Arguments                                                                  */
/* -------------------------------------------------------------------------- */

function parseArgs(argv) {
  /* `--help` first is a request for help, not a mode named "--help". */
  const mode = argv[0]?.startsWith('-') ? undefined : argv[0];
  const flags = {};
  for (let i = mode ? 1 : 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) die(`Unexpected argument: ${arg}`);
    const name = arg.slice(2);
    /* `--dry-run` and `--force` take no value; everything else takes the next
       token. Checking for a following `--` rather than a list of booleans
       keeps a mistyped flag from silently eating the one after it. */
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[name] = true;
    } else {
      flags[name] = next;
      i += 1;
    }
  }
  return { mode, flags };
}

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

/**
 * Where to read from, and where to write to.
 *
 * `export` falls back to the `S3_*` variables, because the source is the store
 * this checkout already talks to. `upload` and `verify` do not: inheriting
 * `S3_ENDPOINT` from a developer's `.env` would point the upload at the
 * development MinIO and report complete success having moved the production
 * library precisely nowhere. The target is named explicitly or not at all.
 */
function sourceConfig(flags) {
  return {
    endpoint: flags.endpoint ?? process.env.S3_ENDPOINT ?? 'http://localhost:6013',
    region: flags.region ?? process.env.S3_REGION ?? 'us-east-1',
    bucket: flags.bucket ?? process.env.S3_BUCKET ?? 'lotuspeak-media',
    accessKeyId: flags['access-key'] ?? process.env.S3_ACCESS_KEY_ID ?? 'minioadmin',
    secretAccessKey: flags['secret-key'] ?? process.env.S3_SECRET_ACCESS_KEY ?? 'minioadmin',
    forcePathStyle: flags['force-path-style'] !== 'false',
  };
}

function targetConfig(flags) {
  const endpoint = flags.endpoint ?? process.env.TARGET_S3_ENDPOINT;
  const bucket = flags.bucket ?? process.env.TARGET_S3_BUCKET;
  const accessKeyId = flags['access-key'] ?? process.env.TARGET_S3_ACCESS_KEY_ID;
  const secretAccessKey = flags['secret-key'] ?? process.env.TARGET_S3_SECRET_ACCESS_KEY;

  const missing = [
    !endpoint && '--endpoint',
    !bucket && '--bucket',
    !accessKeyId && '--access-key',
    !secretAccessKey && '--secret-key',
  ].filter(Boolean);
  if (missing.length > 0) {
    die(
      `The target store has to be named in full: ${missing.join(', ')} missing.\n` +
        '  Nothing is defaulted here on purpose — a default would be the\n' +
        '  development MinIO, and the upload would "succeed" into it.',
    );
  }

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: flags.region ?? process.env.TARGET_S3_REGION ?? 'us-east-1',
    forcePathStyle: flags['force-path-style'] !== 'false',
  };
}

function clientFor(config) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

/* -------------------------------------------------------------------------- */
/*  Listing and walking                                                        */
/* -------------------------------------------------------------------------- */

/** Every key under a prefix, following the continuation token to the end. */
async function listKeys(client, bucket, prefix) {
  const keys = [];
  let token;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
    );
    for (const object of page.Contents ?? []) {
      /* A key ending in `/` is a console-created folder marker, not an object
         anything references. Copying it across achieves nothing and makes the
         counts in `verify` disagree for ever. */
      if (object.Key && !object.Key.endsWith('/')) keys.push(object.Key);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys.sort();
}

/** Every file under a directory, as keys relative to it, `/`-separated. */
async function walk(dir, base = dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return out;
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base)));
    } else if (entry.isFile() && !entry.name.startsWith('.')) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out.sort();
}

/** A pool rather than `Promise.all`: a thousand objects at once is a timeout. */
async function inParallel(items, limit, worker) {
  let index = 0;
  let done = 0;
  const failures = [];
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      try {
        await worker(item);
      } catch (error) {
        failures.push({ item, error });
      }
      done += 1;
      if (done % 25 === 0 || done === items.length) {
        process.stdout.write(`\r  ${done}/${items.length}`);
      }
    }
  });
  await Promise.all(runners);
  if (items.length > 0) process.stdout.write('\n');
  return failures;
}

function reportFailures(failures, verb) {
  if (failures.length === 0) return false;
  console.error(`\n  ${failures.length} object(s) failed to ${verb}:\n`);
  for (const { item, error } of failures.slice(0, 10)) {
    console.error(`    ${item}  —  ${error.message}`);
  }
  if (failures.length > 10) console.error(`    … and ${failures.length - 10} more`);
  return true;
}

/* -------------------------------------------------------------------------- */
/*  export                                                                     */
/* -------------------------------------------------------------------------- */

async function exportMode(flags) {
  const config = sourceConfig(flags);
  const prefix = flags.prefix ?? 'media/';
  const out = path.resolve(flags.out ?? DEFAULT_OUT);
  const force = flags.force === true;

  console.log(`\n  from  ${config.endpoint}/${config.bucket}  (prefix "${prefix}")`);
  console.log(`  into  ${out}\n`);

  const client = clientFor(config);
  const keys = await listKeys(client, config.bucket, prefix);
  if (keys.length === 0) {
    die(`Nothing under "${prefix}" in ${config.bucket}. Wrong bucket, or wrong endpoint?`);
  }
  console.log(`  ${keys.length} object(s)\n`);

  let skipped = 0;
  const failures = await inParallel(keys, Number(flags.concurrency ?? 8), async (key) => {
    const destination = path.join(out, key);
    if (!force) {
      /* Resumable: an export interrupted at object 800 of 900 should not pull
         the first 800 again over a link slow enough to have interrupted it. */
      const existing = await stat(destination).catch(() => null);
      if (existing?.isFile()) {
        skipped += 1;
        return;
      }
    }
    const object = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    const bytes = Buffer.from(await object.Body.transformToByteArray());
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
  });

  if (reportFailures(failures, 'download')) process.exit(1);
  console.log(
    `\n  Exported ${keys.length - skipped} object(s)` +
      (skipped > 0 ? `, ${skipped} already on disk (--force to refetch)` : '') +
      `.\n\n  Upload the contents of ${out} to the bucket, keeping the paths:\n` +
      `  the website asks for <bucket>/media/<id>/<width>.webp exactly.\n`,
  );
}

/* -------------------------------------------------------------------------- */
/*  upload                                                                     */
/* -------------------------------------------------------------------------- */

async function uploadMode(flags) {
  const config = targetConfig(flags);
  const from = path.resolve(flags.from ?? DEFAULT_OUT);
  const dryRun = flags['dry-run'] === true;

  const keys = await walk(from);
  if (keys.length === 0) die(`No files under ${from}. Run the export first.`);

  console.log(`\n  from  ${from}`);
  console.log(`  into  ${config.endpoint}/${config.bucket}`);
  console.log(`\n  ${keys.length} file(s)${dryRun ? '  (dry run)' : ''}\n`);

  if (dryRun) {
    for (const key of keys.slice(0, 20)) console.log(`    ${key}  ${contentTypeFor(key)}`);
    if (keys.length > 20) console.log(`    … and ${keys.length - 20} more`);
    console.log('\n  Nothing was written.\n');
    return;
  }

  const client = clientFor(config);
  const failures = await inParallel(keys, Number(flags.concurrency ?? 8), async (key) => {
    const body = await readFile(path.join(from, key));
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: body,
        ContentType: contentTypeFor(key),
        CacheControl: CACHE_CONTROL,
      }),
    );
  });

  if (reportFailures(failures, 'upload')) process.exit(1);
  console.log(`\n  Uploaded ${keys.length} object(s). Now run verify.\n`);
}

/* -------------------------------------------------------------------------- */
/*  verify                                                                     */
/* -------------------------------------------------------------------------- */

async function verifyMode(flags) {
  const config = targetConfig(flags);
  const from = path.resolve(flags.from ?? DEFAULT_OUT);
  const prefix = flags.prefix ?? 'media/';
  const publicUrl = (flags['public-url'] ?? process.env.MEDIA_PUBLIC_URL ?? '').replace(/\/$/, '');

  const client = clientFor(config);
  const remote = new Set(await listKeys(client, config.bucket, prefix));
  const local = await walk(from);

  console.log(`\n  bucket  ${config.endpoint}/${config.bucket}`);
  console.log(`  folder  ${from}\n`);
  console.log(`  ${remote.size} object(s) in the bucket under "${prefix}"`);
  console.log(`  ${local.length} file(s) in the folder\n`);

  const missing = local.filter((key) => !remote.has(key));
  if (missing.length > 0) {
    console.error(`  ${missing.length} file(s) are not in the bucket:\n`);
    for (const key of missing.slice(0, 10)) console.error(`    ${key}`);
    if (missing.length > 10) console.error(`    … and ${missing.length - 10} more`);
    console.error('');
  } else if (local.length > 0) {
    console.log('  Every exported file is in the bucket.\n');
  }

  /**
   * The check that matters, and the one credentials hide.
   *
   * Everything above runs as an authenticated client. A visitor's browser is
   * not one: it fetches the image URL with no key at all. A bucket that is
   * private answers 403 to it while every call this script makes succeeds —
   * which reads, on the site, as every photograph broken and nothing in any
   * log saying why.
   */
  if (!publicUrl) {
    console.log(
      '  Skipping the anonymous read check: pass --public-url (the value\n' +
        '  MEDIA_PUBLIC_URL will have) to confirm a browser can fetch these.\n',
    );
    return;
  }

  const sample = local[0] ?? [...remote][0];
  if (!sample) return;

  const url = `${publicUrl}/${sample}`;
  const response = await fetch(url).catch((error) => ({ ok: false, status: error.message }));
  if (response.ok) {
    console.log(`  Anonymous read: ${response.status} for ${url}\n`);
  } else {
    console.error(
      `  Anonymous read FAILED: ${response.status} for\n    ${url}\n\n` +
        '  The bucket needs public read on objects, or every photograph on the\n' +
        '  site is a broken image with nothing in any log to say so.\n' +
        '  With the MinIO client:  mc anonymous set download <alias>/<bucket>\n',
    );
    process.exitCode = 1;
  }
}

/* -------------------------------------------------------------------------- */

const USAGE = `
  node deploy/media-sync.mjs <export|upload|verify> [options]

  export    pull every object out of a bucket into a folder
            --endpoint --bucket --access-key --secret-key --region
            --prefix media/   --out deploy/media-export   --force
            (defaults to this checkout's S3_* variables)

  upload    push a folder into a bucket, keys preserved
            --endpoint --bucket --access-key --secret-key --region   (required)
            --from deploy/media-export   --dry-run   --concurrency 8

  verify    compare the bucket against the folder, and check that an
            anonymous browser can read an object
            --endpoint --bucket --access-key --secret-key   (required)
            --from deploy/media-export   --public-url https://s3.example.com/bucket

  Add --force-path-style false only for a store that addresses buckets by
  subdomain. RustFS and MinIO do not; leave it alone for them.
`;

const { mode, flags } = parseArgs(process.argv.slice(2));

if (flags.help || !mode) {
  console.log(USAGE);
  process.exit(mode ? 0 : 1);
}

const modes = { export: exportMode, upload: uploadMode, verify: verifyMode };
const run = modes[mode];
if (!run) {
  console.error(`\n  "${mode}" is not a mode.${USAGE}`);
  process.exit(1);
}

run(flags).catch((error) => {
  console.error(`\n  ${error.message}\n`);
  process.exit(1);
});
