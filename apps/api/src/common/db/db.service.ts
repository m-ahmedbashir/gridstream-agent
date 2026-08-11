import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * DbService
 *
 * Provides a single Drizzle instance (backed by a pg Pool) to the entire
 * NestJS application. The pool/instance are built in the constructor, not
 * `onModuleInit` — both are synchronous and need no injected dependencies,
 * and `onModuleInit` only fires once `app.init()`/`app.listen()` runs.
 * `main.ts` calls `app.get(DbService).db` for a startup health check
 * *before* `app.listen()`, which would see `db` as still-undefined if this
 * were deferred to `onModuleInit` — confirmed by reproducing it directly
 * (`app.get(DbService).db` was `undefined` right after `NestFactory.create()`
 * resolved). Only shutdown (closing the pool) is a real lifecycle hook.
 */
@Injectable()
export class DbService implements OnModuleDestroy {
  private readonly pool: Pool;
  readonly db: NodePgDatabase<typeof schema>;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
