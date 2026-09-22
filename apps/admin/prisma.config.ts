import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 drops `package.json#prisma`, and the seed command has to live
 * somewhere. `dotenv/config` at the top is load-bearing: the CLI no longer
 * reads `.env` itself once this file exists, so without it every command
 * fails with "Environment variable not found: DATABASE_URL".
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
