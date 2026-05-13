import { Injectable } from '@nestjs/common';
import type { WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { BatteryWidgetService, DeviceInfoWidgetService, WifiWidgetService } from './system-widgets.service';
import { ClockWidgetService } from './clock-widget.service';
import { CountdownWidgetService } from './countdown-widget.service';
import { DateWidgetService } from './date-widget.service';
import { DaysUntilWidgetService } from './days-until-widget.service';
import { DividerWidgetService, RectangleWidgetService } from './layout-widgets.service';
import { GithubWidgetService } from './github-widget.service';
import { ImageWidgetService } from './image-widget.service';
import { QrCodeWidgetService } from './qrcode-widget.service';
import { TextWidgetService } from './text-widget.service';
import { WeatherWidgetService } from './weather-widget.service';

@Injectable()
export class DefaultWidgetsService {
  constructor(
    private readonly battery: BatteryWidgetService,
    private readonly clock: ClockWidgetService,
    private readonly countdown: CountdownWidgetService,
    private readonly date: DateWidgetService,
    private readonly daysUntil: DaysUntilWidgetService,
    private readonly deviceInfo: DeviceInfoWidgetService,
    private readonly divider: DividerWidgetService,
    private readonly github: GithubWidgetService,
    private readonly image: ImageWidgetService,
    private readonly qrcode: QrCodeWidgetService,
    private readonly rectangle: RectangleWidgetService,
    private readonly text: TextWidgetService,
    private readonly weather: WeatherWidgetService,
    private readonly wifi: WifiWidgetService,
  ) {}

  canRender(templateName: string): boolean {
    return [
      'battery', 'clock', 'countdown', 'date', 'daysuntil', 'deviceinfo', 'divider',
      'github', 'image', 'qrcode', 'rectangle', 'text', 'weather', 'wifi',
    ].includes(templateName);
  }

  renderBattery(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.battery.render(context); }
  renderClock(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.clock.render(context); }
  renderCountdown(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.countdown.render(context); }
  renderDate(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.date.render(context); }
  renderDaysUntil(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.daysUntil.render(context); }
  renderDeviceInfo(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.deviceInfo.render(context); }
  renderDivider(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.divider.render(context); }
  renderGithub(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.github.render(context); }
  renderImage(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.image.render(context); }
  renderQrCode(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.qrcode.render(context); }
  renderRectangle(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.rectangle.render(context); }
  renderText(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.text.render(context); }
  renderWeather(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.weather.render(context); }
  renderWifi(context: WidgetRenderContext): Promise<WidgetRenderResult> { return this.wifi.render(context); }

  render(context: WidgetRenderContext): Promise<WidgetRenderResult> {
    switch (context.widget.template.name) {
      case 'battery': return this.renderBattery(context);
      case 'clock': return this.renderClock(context);
      case 'countdown': return this.renderCountdown(context);
      case 'date': return this.renderDate(context);
      case 'daysuntil': return this.renderDaysUntil(context);
      case 'deviceinfo': return this.renderDeviceInfo(context);
      case 'divider': return this.renderDivider(context);
      case 'github': return this.renderGithub(context);
      case 'image': return this.renderImage(context);
      case 'qrcode': return this.renderQrCode(context);
      case 'rectangle': return this.renderRectangle(context);
      case 'text': return this.renderText(context);
      case 'weather': return this.renderWeather(context);
      case 'wifi': return this.renderWifi(context);
      default: return Promise.resolve({ contentHtml: '<div style="color:#999;font-size:12px;">Unknown widget</div>' });
    }
  }
}
