import { Module } from '@nestjs/common';
import { CustomWidgetsController } from './custom-widgets.controller';
import { CustomWidgetsService } from './custom-widgets.service';
import { ScriptExecutorService } from './services/script-executor.service';
import { FrameworkJsxExecutorService } from './services/framework-jsx-executor.service';
import { PrismaModule } from '../prisma/prisma.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, DataSourcesModule, SettingsModule],
  controllers: [CustomWidgetsController],
  providers: [CustomWidgetsService, ScriptExecutorService, FrameworkJsxExecutorService],
  exports: [CustomWidgetsService],
})
export class CustomWidgetsModule {}
