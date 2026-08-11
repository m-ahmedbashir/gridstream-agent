import { Module } from '@nestjs/common';
import { DbService } from './db.service';

/**
 * DbModule
 *
 * Provides DbService globally to any module that imports it.
 * Exported so other modules can inject DbService via dependency injection.
 */
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
