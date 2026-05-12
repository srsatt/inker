import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LogCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LogCleanupService.name);
  private cleanupInterval?: ReturnType<typeof setInterval>;
  private initialCleanupTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.startCleanupJob();
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.initialCleanupTimer) {
      clearTimeout(this.initialCleanupTimer);
    }
  }

  private startCleanupJob() {
    const enabled = this.configService.get<boolean>('jobs.logCleanup.enabled', true);

    if (!enabled) {
      this.logger.log('Device log cleanup job is disabled');
      return;
    }

    const interval = this.configService.get<number>(
      'jobs.logCleanup.interval',
      24 * 60 * 60 * 1000,
    );

    this.logger.log(`Starting device log cleanup job every ${interval / 1000}s`);

    this.cleanupInterval = setInterval(() => {
      void this.cleanupLogs();
    }, interval);
    this.cleanupInterval.unref?.();

    // Run once on startup after a short delay
    this.initialCleanupTimer = setTimeout(() => {
      void this.cleanupLogs();
    }, 30000);
    this.initialCleanupTimer.unref?.();

    this.logger.log('Device log cleanup job scheduled');
  }

  async cleanupLogs() {
    const retentionDays = this.configService.get<number>(
      'jobs.logCleanup.retentionDays',
      30,
    );
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    this.logger.log(`Cleaning up device logs older than ${cutoff.toISOString()}`);

    const result = await this.prisma.deviceLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
      },
    });

    this.logger.log(`Deleted ${result.count} old device log entries`);

    return { deleted: result.count };
  }
}
