#!/usr/bin/env node
/**
 * Diffs two directories of prerendered HTML.
 *
 *     npm run build
 *     mkdir -p /tmp/before && (cd .next/server/app && find . -name '*.html' | tar cf - -T -) | tar xf - -C /tmp/before
 *     …make the change…
 *     npm run build
 *     node scripts/compare-html.mjs /tmp/before .next/server/app
 *
 * ## Why this exists
 *
 * "It builds" is not the check that matters when content moves from
 * TypeScript modules into a database. A build succeeds with an empty journeys
 * index, with a missing paragraph, with `undefined` where a price was. The
 * check that matters is whether the pages a visitor sees are the same ones,
 * and the only honest way to answer that is to compare the bytes.
 *
 * Anything this reports is either a bug or a decision. The decisions are
 * written down in `docs/CUTOVER.md`; there is no third category.
 *
 * ## What it ignores, and why each one is safe
 *
 * Next writes a build id into every page and hashes it into every chunk URL.
 * Those change on every build regardless of content, so comparing them would
 * report 21 differing pages every time and the tool would be useless. They are
 * normalised out — and nothing else is. In particular **image URLs are not
 * normalised**, because the photographs moving from `/public` into the media
 * library is exactly the change this run is meant to surface.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const [beforeDir, afterDir] = process.argv.slice(2);

if (!beforeDir || !afterDir) {
  console.error('usage: compare-html.mjs <before-dir> <after-dir>');
  process.exit(2);
}

/**
 * `--ignore-media` normalises every image URL to a placeholder.
 *
 * Two runs answer two different questions. Without it: what changed at all,
 * which on the move into the database is mostly "every photograph now comes
 * from the media library" and is the point. With it: what changed *other than
 * that* — which should be nothing, and anything it reports is a bug or a
 * decision.
 */
const ignoreMedia = process.argv.includes('--ignore-media');

/** Build-to-build noise: the build id, and the chunk hashes derived from it. */
function normalise(html) {
  const out = html
    /* Next stamps the build id twice: as an HTML comment right after the
       doctype, and inside the flight payload. Both change on every build. */
    .replace(/<!--[A-Za-z0-9_-]{16,32}-->/g, '<!--—-->')
    .replace(/"buildId":"[^"]+"/g, '"buildId":"—"')
    /* And its escaped twin inside the flight payload: \"b\":\"<id>\". */
    .replace(/\\"b\\":\\"[A-Za-z0-9_-]+\\"/g, '\\"b\\":\\"—\\"')
    .replace(/\/_next\/static\/[^/"]+\/_(ssgManifest|buildManifest)\.js/g, '/_next/static/—/$1.js')
    .replace(/-[0-9a-f]{16}\.js/g, '-—.js')
    .replace(/\?dpl=[^"&]+/g, '')
    /* `next build` stamps a render timestamp into the flight payload of any
       page that read a Date. Two builds a second apart would differ on it. */
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g, '<timestamp>');

  if (!ignoreMedia) return out;

  return (
    out
      /* A media-library URL. Both the raw form and the percent-encoded one
         `next/image` puts in its `?url=`, where even the colon is escaped. */
      .replace(
        /https?(:|%3A)(\/\/|%2F%2F)[^"'\s)]*?(\/|%2F)media(\/|%2F)[0-9a-f]{24}[^"'\s,)]*/g,
        '<image>',
      )
      /* The paths those replaced, so a page that still serves from public/
         compares equal to the one that now serves from the library. */
      .replace(/(%2F|\/)assets(%2F|\/)(imagery|illustrations|textures)[^"'\s)]*/g, '<image>')
      /* Once the URL is a placeholder the srcset is a list of identical
         entries differing only by their width descriptor. */
      .replace(/(<image>(&amp;)?[^"]*?\s\d+w,?\s*)+/g, '<srcset>')
      .replace(/<image>(&amp;|[^"])*?(\d+x)/g, '<srcset>')
  );
}

async function htmlFiles(root) {
  const out = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.html')) out.push(path.relative(root, full));
    }
  }
  await walk(root);
  return out.sort();
}

/**
 * The first place the two differ, with a window either side.
 *
 * Character-level, not line-level: a prerendered Next page is one enormous
 * line, so "line 1 differs" is true of every changed file and useless on all
 * of them. A hundred characters of context around the first divergence is
 * usually enough to recognise the change without opening either file.
 */
function firstDifference(before, after) {
  const limit = Math.min(before.length, after.length);
  let at = 0;
  while (at < limit && before[at] === after[at]) at += 1;
  if (at === limit && before.length === after.length) return null;

  const from = Math.max(0, at - 60);
  const to = at + 140;
  return {
    at,
    before: `…${before.slice(from, to)}…`,
    after: `…${after.slice(from, to)}…`,
  };
}

const beforeFiles = await htmlFiles(beforeDir);
const afterFiles = await htmlFiles(afterDir);

const removed = beforeFiles.filter((file) => !afterFiles.includes(file));
const added = afterFiles.filter((file) => !beforeFiles.includes(file));
const shared = beforeFiles.filter((file) => afterFiles.includes(file));

let identical = 0;
const changed = [];

for (const file of shared) {
  const [a, b] = await Promise.all([
    readFile(path.join(beforeDir, file), 'utf8'),
    readFile(path.join(afterDir, file), 'utf8'),
  ]);
  const normalisedA = normalise(a);
  const normalisedB = normalise(b);

  if (normalisedA === normalisedB) {
    identical += 1;
    continue;
  }

  const sizeA = Buffer.byteLength(a);
  const sizeB = Buffer.byteLength(b);
  changed.push({ file, sizeA, sizeB, diff: firstDifference(normalisedA, normalisedB) });
}

console.log('');
console.log(`  ${identical} of ${shared.length} pages byte-identical`);
if (removed.length) console.log(`  ${removed.length} page(s) gone: ${removed.join(', ')}`);
if (added.length) console.log(`  ${added.length} page(s) new: ${added.join(', ')}`);
console.log('');

for (const entry of changed) {
  console.log(`  ${entry.file}  ${entry.sizeA} → ${entry.sizeB} bytes`);
  if (entry.diff) {
    console.log(`    first difference at character ${entry.diff.at}`);
    console.log(`      before  ${entry.diff.before}`);
    console.log(`      after   ${entry.diff.after}`);
  }
  console.log('');
}

/* A non-zero exit when anything moved, so CI notices. It is not a failure —
   a deliberate change should make this fail and then be explained. */
process.exit(changed.length + removed.length + added.length > 0 ? 1 : 0);
