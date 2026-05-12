import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TerminusModule } from '@nestjs/terminus';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { ScreensModule } from './screens/screens.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { ExtensionsModule } from './extensions/extensions.module';
import { DataSourcesModule } from './data-sources/data-sources.module';
import { CustomWidgetsModule } from './custom-widgets/custom-widgets.module';
import { FirmwareModule } from './firmware/firmware.module';
import { HealthModule } from './health/health.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ApiModule } from './api/api.module';
import { JobsModule } from './jobs/jobs.module';
import { CommonModule } from './common/common.module';
import { ScreenDesignerModule } from './screen-designer/screen-designer.module';
import { EventsModule } from './events/events.module';
import { SettingsModule } from './settings/settings.module';
import { PluginsModule } from './plugins/plugins.module';
import { configuration } from './config/configuration';
import { validationSchema } from './config/validation.schema';

const frontendDistPath = [
  join(process.cwd(), '..', 'frontend', 'dist'),
  join(process.cwd(), 'frontend', 'dist'),
  join(process.cwd(), 'public'),
].find((path) => existsSync(path));

const staticImports = [
  ServeStaticModule.forRoot({
    rootPath: join(process.cwd(), 'uploads'),
    serveRoot: '/uploads',
    serveStaticOptions: {
      index: false,
    },
  }),
  ...(frontendDistPath
    ? [
        ServeStaticModule.forRoot({
          rootPath: frontendDistPath,
          exclude: [
            '/api',
            '/api/(.*)',
            '/health',
            '/ready',
            '/uploads/(.*)',
            '/assets/(.*)',
          ],
        }),
      ]
    : []),
];

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [{
        ttl: config.get<number>('throttle.ttl', 60) * 1000,
        limit: config.get<number>('throttle.limit', 100),
      }],
    }),

    // Health checks
    TerminusModule,

    // Serve uploads, and serve frontend build when present.
    ...staticImports,

    // Core modules
    PrismaModule,
    CommonModule,
    HealthModule,

    // Feature modules
    AuthModule,
    ApiModule,
    DevicesModule,
    ScreensModule,
    PlaylistsModule,
    ExtensionsModule,
    DataSourcesModule,
    CustomWidgetsModule,
    FirmwareModule,
    DashboardModule,
    JobsModule,
    ScreenDesignerModule,
    EventsModule,
    SettingsModule,
    PluginsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
