/**
 * What a stored video URL means.
 *
 * Every film on this site is one `videoUrl` column somewhere — an itinerary
 * day, a journal entry, a block in a page, a journey. The office pastes
 * whatever it has, which is almost always a YouTube link and occasionally a
 * file in the media library. Nothing downstream should be guessing which it got
 * by looking for the word "youtube" in a string, and two such guesses that
 * disagree is how a link previews in the admin panel and renders as a broken
 * `<video>` on the site.
 *
 * So the guess is made once, here, and both applications import it:
 *
 * - the admin panel, to tell an editor what it recognised while they type and
 *   to refuse a link that names no video;
 * - the website, to decide between an iframe façade and a `<video>` element.
 *
 * The other packages in `packages/` are types only; this one carries runtime,
 * which is the whole point of it — a shared *type* for a video source would
 * leave the two apps free to disagree about what a URL parses to.
 *
 * ## Why a façade
 *
 * A YouTube iframe is roughly half a megabyte of JavaScript before anybody has
 * pressed play, and a journey page can carry a film on every itinerary day.
 * The site never embeds one until it is asked to: it renders the cover image,
 * a play button and a real link to YouTube, and swaps the iframe in on the
 * click. `embedUrl` is therefore only ever called with `autoplay: true` — by
 * the time it is called, the visitor has already asked for the video.
 *
 * That matters more here than on a faster connection. This site is read in
 * Bhutan and by people planning a journey to it, and half a megabyte per film
 * on a page with eleven itinerary days is the difference between a page that
 * arrives and one that does not.
 */

/* ------------------------------------------------------------------ parsing */

/** A YouTube video. `start` is the `t=` offset, in seconds, where one is given. */
export interface YouTubeSource {
  kind: 'youtube';
  id: string;
  start?: number;
}

/**
 * A Vimeo video. `hash` is the unlisted-video key that Vimeo appends to a
 * private link and that the embed will not play without.
 */
export interface VimeoSource {
  kind: 'vimeo';
  id: string;
  hash?: string;
}

/** A file this site serves itself — the media library, or any direct URL. */
export interface FileSource {
  kind: 'file';
  src: string;
}

export type VideoSource = YouTubeSource | VimeoSource | FileSource;

/** The provider names the database stores on a video column. */
export type VideoProviderName = 'YOUTUBE' | 'VIMEO' | 'DIRECT';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
]);

const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

/** A YouTube id is eleven characters of base64url, and has been for years. */
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * The `t` parameter, in the three spellings YouTube's own share links use:
 * `t=90`, `t=90s`, `t=1m30s`.
 */
function parseStart(value: string | null): number | undefined {
  if (!value) return undefined;

  const plain = /^\d+s?$/.exec(value.trim());
  if (plain) return Number.parseInt(value, 10) || undefined;

  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i.exec(value.trim());
  if (!parts || !parts[0]) return undefined;

  const seconds =
    Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0);
  return seconds > 0 ? seconds : undefined;
}

/**
 * The id in a YouTube URL, whichever of the six shapes it arrived in.
 *
 * `watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`, `/live/` and the ancient
 * `/v/`. An id that is not eleven base64url characters is not an id: a channel
 * page, a playlist with no video in it and a search result all parse to a URL
 * with a path, and all three are things an editor pastes by accident.
 */
export function youtubeId(url: string | null | undefined): string | null {
  const source = parseVideoSource(url);
  return source?.kind === 'youtube' ? source.id : null;
}

/**
 * What a stored URL is, or null when it is nothing at all.
 *
 * A URL on a host this module does not know is a `file` — the media library,
 * the operator's own CDN, an `.mp4` somebody linked. That is deliberate: this
 * decides how to *play* a link, not whether the link is allowed, and the
 * website's media service is what gates hosts.
 */
export function parseVideoSource(url: string | null | undefined): VideoSource | null {
  const raw = url?.trim();
  if (!raw) return null;

  let parsed: URL;
  try {
    // A relative path — `/media/film.mp4` — is a file this site serves.
    if (raw.startsWith('/')) return { kind: 'file', src: raw };
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const start = parseStart(parsed.searchParams.get('t') ?? parsed.searchParams.get('start'));
    const segments = parsed.pathname.split('/').filter(Boolean);

    const candidate =
      host === 'youtu.be' || host === 'www.youtu.be'
        ? segments[0]
        : segments[0] === 'embed' || segments[0] === 'shorts' || segments[0] === 'live' || segments[0] === 'v'
          ? segments[1]
          : (parsed.searchParams.get('v') ?? undefined);

    if (!candidate || !YOUTUBE_ID.test(candidate)) return null;
    return start ? { kind: 'youtube', id: candidate, start } : { kind: 'youtube', id: candidate };
  }

  if (VIMEO_HOSTS.has(host)) {
    const segments = parsed.pathname.split('/').filter(Boolean);
    const numeric = segments.filter((segment) => /^\d+$/.test(segment));
    const id = numeric[0];
    if (!id) return null;

    // vimeo.com/123456789/abcdef0123 and player.vimeo.com/video/123?h=abcdef0123
    // are the same unlisted video; both carry the key the embed needs.
    const hash = numeric[1] ?? parsed.searchParams.get('h') ?? undefined;
    return hash ? { kind: 'vimeo', id, hash } : { kind: 'vimeo', id };
  }

  return { kind: 'file', src: parsed.toString() };
}

/** True where playing this needs a third-party iframe rather than a `<video>`. */
export function isEmbedSource(
  source: VideoSource | null,
): source is YouTubeSource | VimeoSource {
  return source?.kind === 'youtube' || source?.kind === 'vimeo';
}

/** The provider as the database spells it. */
export function providerOf(url: string | null | undefined): VideoProviderName {
  const source = parseVideoSource(url);
  if (source?.kind === 'youtube') return 'YOUTUBE';
  if (source?.kind === 'vimeo') return 'VIMEO';
  return 'DIRECT';
}

/** What to call it in front of an editor. */
export function providerLabel(source: VideoSource | null): string {
  if (source?.kind === 'youtube') return 'YouTube';
  if (source?.kind === 'vimeo') return 'Vimeo';
  if (source?.kind === 'file') return 'Direct file';
  return 'Unrecognised';
}

/**
 * Whether a URL names something this site can actually play.
 *
 * The one case it refuses is a link on a host we *do* know that carries no
 * video id — `youtube.com/@lotuspeak`, a playlist, a search result. Those are
 * the mistakes worth catching, because they are the ones that look right in the
 * field and render nothing on the page.
 */
export function isPlayableVideoUrl(url: string | null | undefined): boolean {
  return parseVideoSource(url) !== null;
}

/* ------------------------------------------------------------------- embeds */

export interface EmbedOptions {
  /**
   * Start playing on load. True for every embed this site builds — the iframe
   * is only ever created after a click on the façade.
   */
  autoplay?: boolean;
  /** Seconds to start at. Defaults to the offset in the URL, where it had one. */
  start?: number;
  /** `youtube-nocookie.com`, which is the default. */
  nocookie?: boolean;
  /** Mute on load. Needed if an embed is ever autoplayed without a click. */
  muted?: boolean;
}

/**
 * The iframe URL for a source that needs one, or null for a file.
 *
 * `rel=0` keeps the end screen on this channel rather than offering a
 * competitor's journey, `modestbranding=1` drops the watermark, and `playsinline=1`
 * stops iOS taking the video fullscreen the moment it starts — all three are
 * about the film staying part of the page it is on.
 */
export function embedUrl(
  source: VideoSource | null,
  options: EmbedOptions = {},
): string | null {
  if (!isEmbedSource(source)) return null;

  const { autoplay = true, nocookie = true, muted = false } = options;

  if (source.kind === 'youtube') {
    const host = nocookie ? 'www.youtube-nocookie.com' : 'www.youtube.com';
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
    });
    if (autoplay) params.set('autoplay', '1');
    if (muted) params.set('mute', '1');
    const start = options.start ?? source.start;
    if (start) params.set('start', String(start));
    return `https://${host}/embed/${source.id}?${params.toString()}`;
  }

  const params = new URLSearchParams({ dnt: '1', playsinline: '1' });
  if (autoplay) params.set('autoplay', '1');
  if (muted) params.set('muted', '1');
  if (source.hash) params.set('h', source.hash);
  // Vimeo takes its start offset in the fragment, not the query string.
  const at = options.start ? `#t=${options.start}s` : '';
  return `https://player.vimeo.com/video/${source.id}?${params.toString()}${at}`;
}

/**
 * Where the film lives, for the anchor under the façade.
 *
 * The façade is a real link to a real page, so it works with no JavaScript,
 * says something useful to a crawler, and behaves when somebody
 * middle-clicks it. The click handler is what stops it navigating.
 */
export function watchUrl(source: VideoSource | null): string | null {
  if (source?.kind === 'youtube') {
    const at = source.start ? `&t=${source.start}` : '';
    return `https://www.youtube.com/watch?v=${source.id}${at}`;
  }
  if (source?.kind === 'vimeo') {
    return `https://vimeo.com/${source.id}${source.hash ? `/${source.hash}` : ''}`;
  }
  return null;
}

/**
 * YouTube's own still, for a film nobody has given a poster.
 *
 * `hqdefault` rather than `maxresdefault`: the high-resolution still is only
 * generated for some uploads and 404s for the rest, and a broken thumbnail on a
 * façade is worse than a slightly soft one. It is 480×360 — 4:3 with bars — so
 * every renderer here covers it into a 16:9 box, which is what crops them off.
 *
 * Vimeo has no equivalent: its thumbnails are only addressable through an API
 * call, and this module does not make requests. A Vimeo film shows the poster
 * the office attached, which is why the admin panel asks for one.
 */
export function thumbnailUrl(
  source: VideoSource | null,
  quality: 'default' | 'medium' | 'high' | 'max' = 'high',
): string | null {
  if (source?.kind !== 'youtube') return null;

  const file = {
    default: 'default.jpg',
    medium: 'mqdefault.jpg',
    high: 'hqdefault.jpg',
    max: 'maxresdefault.jpg',
  }[quality];

  return `https://i.ytimg.com/vi/${source.id}/${file}`;
}

/**
 * What an embedded player is allowed to do.
 *
 * Deliberately short. No `camera`, no `microphone`, no `geolocation`: a film
 * needs none of them, and an allow list is the one place this site says so.
 */
export const EMBED_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

/**
 * The origins a façade warms up when a visitor looks like they are about to
 * press play, in the order the browser will need them.
 *
 * Preconnecting on hover rather than on load is the whole trick: a page with
 * six films pays nothing for the five nobody watches, and the one that is
 * watched has its TLS handshakes done before the click lands.
 */
export const YOUTUBE_PRECONNECT = [
  'https://www.youtube-nocookie.com',
  'https://www.google.com',
  'https://googleads.g.doubleclick.net',
  'https://static.doubleclick.net',
] as const;

export const VIMEO_PRECONNECT = ['https://player.vimeo.com', 'https://i.vimeocdn.com'] as const;

/** The origins worth warming for this source, thumbnail host included. */
export function preconnectOrigins(source: VideoSource | null): readonly string[] {
  if (source?.kind === 'youtube') return ['https://i.ytimg.com', ...YOUTUBE_PRECONNECT];
  if (source?.kind === 'vimeo') return VIMEO_PRECONNECT;
  return [];
}
