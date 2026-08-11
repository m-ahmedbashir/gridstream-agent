import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

/**
 * DbService
 *
 * Provides a single Drizzle instance (backed by a pg Pool) to the entire
 * NestJS application. Handles connection lifecycle: opens the pool on
 * module startup, closes it on shutdown.
 */
@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;
  db!: NodePgDatabase<typeof schema>;

  onModuleInit() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
