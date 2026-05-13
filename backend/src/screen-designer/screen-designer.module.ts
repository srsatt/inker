import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomWidgetsModule } from '../custom-widgets/custom-widgets.module';
import { SettingsModule } from '../settings/settings.module';
import { PluginsModule } from '../plugins/plugins.module';
import { ScreenDesignerController, WidgetTemplatesController } from './screen-designer.controller';
import { ScreenDesignerService } from './screen-designer.service';
import { WidgetTemplatesService } from './services/widget-templates.service';
import { PuppeteerScreenRendererService, ScreenRendererService } from './services/screen-renderer.service';
import { SatoriScreenRendererService } from './services/screen-renderer.satori.service';
import { ScreenComposerService } from './services/screen-composer.service';
import { ScreenRenderEngine } from './services/screen-render-engine.interface';
import { DefaultWidgetsService } from './widgets/default-widgets.service';
import { WidgetStyleService } from './widgets/widget-style.service';
import { ImageDataUrlService } from './widgets/image-data-url.service';
import { GitHubStarsService } from './widgets/github-stars.service';
import { WeatherDataService } from './widgets/weather-data.service';
import { BatteryWidgetService, DeviceInfoWidgetService, WifiWidgetService } from './widgets/system-widgets.service';
import { ClockWidgetService } from './widgets/clock-widget.service';
import { CountdownWidgetService } from './widgets/countdown-widget.service';
import { DateWidgetService } from './widgets/date-widget.service';
import { DaysUntilWidgetService } from './widgets/days-until-widget.service';
import { DividerWidgetService, RectangleWidgetService } from './widgets/layout-widgets.service';
import { GithubWidgetService } from './widgets/github-widget.service';
import { ImageWidgetService } from './widgets/image-widget.service';
import { QrCodeWidgetService } from './widgets/qrcode-widget.service';
import { TextWidgetService } from './widgets/text-widget.service';
import { WeatherWidgetService } from './widgets/weather-widget.service';

@Module({
  imports: [PrismaModule, CustomWidgetsModule, SettingsModule, forwardRef(() => PluginsModule)],
  controllers: [ScreenDesignerController, WidgetTemplatesController],
  providers: [
    ScreenDesignerService,
    WidgetTemplatesService,
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
    PuppeteerScreenRendererService,
    SatoriScreenRendererService,
    {
      provide: ScreenRendererService,
      inject: [ConfigService, PuppeteerScreenRendererService, SatoriScreenRendererService],
      useFactory: (
        configService: ConfigService,
        puppeteerRenderer: PuppeteerScreenRendererService,
        satoriRenderer: SatoriScreenRendererService,
      ) => {
        return configService.get<string>('renderer.engine') === 'satori'
          ? satoriRenderer
          : puppeteerRenderer;
      },
    },
    {
      provide: ScreenRenderEngine,
      inject: [ConfigService, PuppeteerScreenRendererService, SatoriScreenRendererService],
      useFactory: (
        configService: ConfigService,
        puppeteerRenderer: PuppeteerScreenRendererService,
        satoriRenderer: SatoriScreenRendererService,
      ) => {
        return configService.get<string>('renderer.engine') === 'satori'
          ? satoriRenderer
          : puppeteerRenderer;
      },
    },
  ],
  exports: [
    ScreenDesignerService,
    WidgetTemplatesService,
    ScreenComposerService,
    DefaultWidgetsService,
    ScreenRenderEngine,
    ScreenRendererService,
  ],
})
export class ScreenDesignerModule {}
