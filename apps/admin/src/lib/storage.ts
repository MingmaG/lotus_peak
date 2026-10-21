import 'server-only';

import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { env } from '@/lib/env';

/**
 * Where the bytes of the media library live.
 *
 * Two drivers behind one interface, chosen by `STORAGE_DRIVER`. Development
 * runs `s3` against MinIO rather than `local` on purpose: the driver exercised
 * on a laptop is then the same code path that runs in production, so an S3
 * misconfiguration surfaces here instead of on the day of the deploy.
 *
 * Only bytes. Every caller records what the bytes *are* in the `Media` row and
 * addresses them by `storageKey`, which is what lets a photograph be replaced
 * without rewriting the rows that reference it.
 */
export interface Storage {
  /** Which driver this is. Reported by /api/health. */
  readonly name: string;
  put(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;
  /** The bytes, or `null` when the key holds nothing. Never throws for a miss. */
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /**
   * Absolute for `s3`; rooted at `/api/storage` for `local`. Callers that need
   * an absolute URL resolve a relative one against `ADMIN_PUBLIC_URL` — see
   * `absoluteFor` in the media service.
   */
  publicUrl(key: string): string;
}

/**
 * A key is a path fragment from the database, so it is treated as untrusted.
 *
 * `media/../../.env` resolved against the storage root reads a file that is
 * not media. The check is on the resolved path rather than the input because
 * the interesting traversals are the ones spelled unusually.
 */
function safeKey(key: string): string {
  const normalised = key.replace(/^\/+/, '');
  if (normalised === '' || path.isAbsolute(normalised) || normalised.includes('\0')) {
    throw new Error(`Refusing a storage key that is not a relative path: ${key}`);
  }
  return normalised;
}

/** 404 from S3 and ENOENT from the filesystem both mean "not there", not "broken". */
function isMissing(error: unknown): boolean {
  const err = error as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    err?.code === 'ENOENT' ||
    err?.name === 'NoSuchKey' ||
    err?.name === 'NotFound' ||
    err?.$metadata?.httpStatusCode === 404
  );
}

function createLocalStorage(): Storage {
  /* Relative to apps/admin, which is the working directory of every script
     and of `next` itself. */
  const root = path.resolve(process.cwd(), env.storage.localDir);
  const fileFor = (key: string) => {
    const resolved = path.resolve(root, safeKey(key));
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`Refusing a storage key that escapes the storage root: ${key}`);
    }
    return resolved;
  };

  return {
    name: 'local',

    async put(key, body) {
      const file = fileFor(key);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, body);
    },

    async get(key) {
      try {
        return await readFile(fileFor(key));
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },

    async delete(key) {
      /* `force` so deleting what is already gone is a success. Callers delete
         renditions before rewriting them and must not fail on a partial set. */
      await rm(fileFor(key), { force: true });
    },

    async exists(key) {
      try {
        await access(fileFor(key));
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
    },

    publicUrl(key) {
      return `/api/storage/${safeKey(key)}`;
    },
  };
}

function createS3Storage(): Storage {
  const client = new S3Client({
    region: env.storage.region,
    /* MinIO needs the endpoint; AWS infers it. Empty means "work it out". */
    endpoint: env.storage.endpoint || undefined,
    forcePathStyle: env.storage.forcePathStyle,
    /* Unset credentials fall through to the SDK's own chain, which is how an
       instance role or a mounted profile is meant to be picked up. */
    credentials: env.storage.accessKeyId
      ? {
          accessKeyId: env.storage.accessKeyId,
          secretAccessKey: env.storage.secretAccessKey,
        }
      : undefined,
  });
  const bucket = env.storage.bucket;

  return {
    name: 's3',

    async put(key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: safeKey(key),
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    async get(key) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: safeKey(key) }),
        );
        if (!result.Body) return null;
        /* Buffered rather than streamed: every caller hands the result to
           sharp, which wants the whole image anyway. */
        return Buffer.from(await result.Body.transformToByteArray());
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },

    async delete(key) {
      /* S3 deletes are idempotent: a missing key is a 204, not a 404. */
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
    },

    async exists(key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: safeKey(key) }));
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        /* Anything else — no such bucket, refused connection, bad key — is a
           broken install and must reach /api/health rather than read as an
           absent object. */
        throw error;
      }
    },

    publicUrl(key) {
      return `${env.storage.publicUrl}/${safeKey(key)}`;
    },
  };
}

export const storage: Storage =
  env.storage.driver === 'local' ? createLocalStorage() : createS3Storage();
