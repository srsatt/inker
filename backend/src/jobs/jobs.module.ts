import { Module } from '@nestjs/common';
import { LogCleanupService } from './services/log-cleanup.service';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * Jobs Module
 * Manages lightweight in-process background jobs.
 */
@Module({
  imports: [
    PrismaModule,
  ],
  providers: [
    LogCleanupService,
  ],
  exports: [
    LogCleanupService,
  ],
})
export class JobsModule {}
