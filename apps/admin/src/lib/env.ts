import 'server-only';

/**
 * The only place in this application that reads `process.env`.
 *
 * Everywhere else imports `env`. That is not tidiness: an environment variable
 * read at the point of use is a variable that is missing in production and
 * present in development, and the symptom is a feature that quietly does
 * nothing rather than a process that refuses to start. Reading them all here,
 * once, at module load, turns every one of those into a startup failure with
 * the name of the variable in it.
 *
 * Zod is deliberately not used. This module is imported by `middleware.ts`,
 * which runs on the edge runtime, and pulling a validator in there costs more
 * than the twenty lines below.
 */

class EnvError extends Error {
  constructor(name: string, hint: string) {
    super(`${name} is not set. ${hint}\nSee apps/admin/.env.example.`);
    this.name = 'EnvError';
  }
}

function required(name: string, hint: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') throw new EnvError(name, hint);
  return value.trim();
}

function optional(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

function number(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function boolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/**
 * A development secret that is obviously a development secret.
 *
 * The alternative — defaulting to a real-looking random string — means a
 * production deploy that forgot to set `AUTH_SECRET` boots happily with a
 * secret that changes on every restart, signing everybody out at random
 * instead of failing once, loudly, at the point the mistake was made.
 */
function secret(name: string): string {
  const value = process.env[name];
  if (value && value.trim() !== '' && !value.startsWith('change-me')) {
    return value.trim();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new EnvError(name, 'Run `bash scripts/generate-secrets.sh` from the repo root.');
  }
  return `insecure-development-${name.toLowerCase()}`;
}

export type StorageDriver = 'local' | 's3';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: process.env.NODE_ENV === 'production',

  databaseUrl: required(
    'DATABASE_URL',
    'Start the stack with `npm run db:up` from the repo root.',
  ),

  auth: {
    secret: secret('AUTH_SECRET'),
    refreshSecret: secret('AUTH_REFRESH_SECRET'),
    accessTtlMinutes: number('AUTH_ACCESS_TTL_MINUTES', 15),
    refreshTtlDays: number('AUTH_REFRESH_TTL_DAYS', 30),
  },

  site: {
    /** No trailing slash, ever. Every URL here is built by concatenation. */
    url: optional('SITE_URL', 'http://localhost:6010').replace(/\/$/, ''),
    revalidateSecret: optional('SITE_REVALIDATE_SECRET'),
    previewSecret: secret('PREVIEW_SECRET'),
  },

  storage: {
    driver: (optional('STORAGE_DRIVER', 's3') as StorageDriver) satisfies StorageDriver,
    endpoint: optional('S3_ENDPOINT', 'http://localhost:6013'),
    region: optional('S3_REGION', 'us-east-1'),
    bucket: optional('S3_BUCKET', 'lotuspeak-media'),
    accessKeyId: optional('S3_ACCESS_KEY_ID'),
    secretAccessKey: optional('S3_SECRET_ACCESS_KEY'),
    /**
     * MinIO addresses buckets by path; AWS by subdomain. Getting this wrong
     * produces a 301 to a hostname that does not resolve, which reads as a
     * network error rather than a configuration one.
     */
    forcePathStyle: boolean('S3_FORCE_PATH_STYLE', true),
    publicUrl: optional(
      'MEDIA_PUBLIC_URL',
      'http://localhost:6013/lotuspeak-media',
    ).replace(/\/$/, ''),
    localDir: optional('STORAGE_LOCAL_DIR', 'storage'),
    /**
     * This app's own public origin, for the local driver only.
     *
     * The local driver serves media through `/api/storage/...` on this app, so
     * the website has to be told what to resolve those paths against. With S3
     * the URLs are already absolute and this is never consulted — which is why
     * it went unset and undocumented for a while, and why a `local` deployment
     * would have published `http://localhost:6011/...` as the src of every
     * photograph on the site.
     */
    adminPublicUrl: optional('ADMIN_PUBLIC_URL', 'http://localhost:6011').replace(/\/$/, ''),
  },

  mail: {
    /**
     * Unset means record and log rather than send.
     *
     * The correct development default: a seeded database full of test
     * addresses should not be able to email anybody, and an adapter that
     * throws when unconfigured would make every seeded enquiry a failure.
     */
    resendApiKey: optional('RESEND_API_KEY'),
    from: optional('MAIL_FROM', 'Lotus Peak <info@lotuspeak.org>'),
    replyTo: optional('MAIL_REPLY_TO', 'info@lotuspeak.org'),
    officeTo: optional('MAIL_OFFICE_TO', 'info@lotuspeak.org')
      .split(',')
      .map((address) => address.trim())
      .filter(Boolean),
  },
} as const;

/** True when publishing will actually reach the website. */
export function revalidationConfigured(): boolean {
  return env.site.revalidateSecret.length > 0;
}

/** True when an enquiry will actually be delivered rather than logged. */
export function mailConfigured(): boolean {
  return env.mail.resendApiKey.length > 0;
}
