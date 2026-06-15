import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { configuration } from '../config/configuration';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { CustomWidgetsService } from '../custom-widgets/custom-widgets.service';
import { ScriptExecutorService } from '../custom-widgets/services/script-executor.service';
import { FrameworkJsxExecutorService } from '../custom-widgets/services/framework-jsx-executor.service';
import { DisplayService } from '../api/display/display.service';
import { DefaultScreenService } from '../api/display/default-screen.service';
import { LogService } from '../api/log/log.service';
import { SetupService } from '../api/setup/setup.service';
import { SetupScreenService } from '../api/setup/setup-screen.service';
import { ScreenComposerService } from '../screen-designer/services/screen-composer.service';
import { PuppeteerScreenRendererService, ScreenRendererService } from '../screen-designer/services/screen-renderer.service';
import { SatoriScreenRendererService } from '../screen-designer/services/screen-renderer.satori.service';
import { TakumiScreenRendererService } from '../screen-designer/services/screen-renderer.takumi.service';
import { DefaultWidgetsService } from '../screen-designer/widgets/default-widgets.service';
import { WidgetStyleService } from '../screen-designer/widgets/widget-style.service';
import { ImageDataUrlService } from '../screen-designer/widgets/image-data-url.service';
import { GitHubStarsService } from '../screen-designer/widgets/github-stars.service';
import { WeatherDataService } from '../screen-designer/widgets/weather-data.service';
import { BatteryWidgetService, DeviceInfoWidgetService, WifiWidgetService } from '../screen-designer/widgets/system-widgets.service';
import { ClockWidgetService } from '../screen-designer/widgets/clock-widget.service';
import { CountdownWidgetService } from '../screen-designer/widgets/countdown-widget.service';
import { DateWidgetService } from '../screen-designer/widgets/date-widget.service';
import { DaysUntilWidgetService } from '../screen-designer/widgets/days-until-widget.service';
import { DividerWidgetService, RectangleWidgetService } from '../screen-designer/widgets/layout-widgets.service';
import { GithubWidgetService } from '../screen-designer/widgets/github-widget.service';
import { ImageWidgetService } from '../screen-designer/widgets/image-widget.service';
import { QrCodeWidgetService } from '../screen-designer/widgets/qrcode-widget.service';
import { TextWidgetService } from '../screen-designer/widgets/text-widget.service';
import { WeatherWidgetService } from '../screen-designer/widgets/weather-widget.service';
import { DeviceApiController } from './device-api.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'assets'),
      serveRoot: '/assets',
      serveStaticOptions: { index: false, fallthrough: true },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false, fallthrough: true },
    }),
    PrismaModule,
  ],
  controllers: [DeviceApiController],
  providers: [
    SettingsService,
    DataSourcesService,
    ScriptExecutorService,
    FrameworkJsxExecutorService,
    CustomWidgetsService,
    DisplayService,
    DefaultScreenService,
    LogService,
    SetupService,
    SetupScreenService,
    ScreenComposerService,
    DefaultWidgetsService,
    WidgetStyleService,
    ImageDataUrlService,
    GitHubStarsService,
    WeatherDataService,
    BatteryWidgetService,
    ClockWidgetService,
    CountdownWidgetService,
    DateWidgetService,
    DaysUntilWidgetService,
    DeviceInfoWidgetService,
    DividerWidgetService,
    GithubWidgetService,
    ImageWidgetService,
    QrCodeWidgetService,
    RectangleWidgetService,
    TextWidgetService,
    WeatherWidgetService,
    WifiWidgetService,
    {
      provide: ScreenRendererService,
      inject: [ConfigService, PrismaService, CustomWidgetsService, SettingsService, ScreenComposerService],
      useFactory: (
        configService: ConfigService,
        prisma: PrismaService,
        customWidgetsService: CustomWidgetsService,
        settingsService: SettingsService,
        screenComposer: ScreenComposerService,
      ) => {
        const engine = configService.get<string>('renderer.engine');
        if (engine === 'takumi') {
          return new TakumiScreenRendererService(prisma, customWidgetsService, configService, settingsService, screenComposer);
        }
        if (engine === 'satori') {
          return new SatoriScreenRendererService(prisma, customWidgetsService, configService, settingsService, screenComposer);
        }
        return new PuppeteerScreenRendererService(prisma, customWidgetsService, configService, settingsService, screenComposer);
      },
    },
  ],
})
export class DeviceRuntimeModule {}
