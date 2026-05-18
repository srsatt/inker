import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WeatherDataService } from './weather-data.service';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class WeatherWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'weather';

  constructor(
    private readonly weather: WeatherDataService,
    private readonly style: WidgetStyleService,
  ) {}

  async render({ config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const location = config.location || 'Unknown';
    const fontSize = config.fontSize || 32;
    const small = Math.max(10, fontSize * 0.4);
    const data = await this.weather.get(config.latitude || 52.2297, config.longitude || 21.0122, config.forecastDay || 0, config.forecastTime || 'current');
    if (!data) {
      return {
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', color: '#666' }}>
            <div>{location}</div>
            <div>Weather unavailable</div>
          </div>
        ),
        style: this.styles(),
      };
    }

    const condition = this.weather.condition(data.weatherCode);
    const temp = config.units === 'imperial' ? Math.round((data.temperature * 9 / 5) + 32) : data.temperature;
    const unit = config.units === 'imperial' ? '°F' : '°C';

    return {
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          {config.showDayName && config.forecastDay > 0 ? <div style={{ fontSize: `${small}px`, color: '#666' }}>{data.dayName}</div> : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {config.showIcon !== false ? this.icon(condition.icon, Math.min(fontSize * 1.5, 48)) : null}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {config.showTemperature !== false ? <div style={{ fontSize: `${fontSize}px`, fontWeight: 'bold' }}>{`${temp}${unit}`}</div> : null}
              {config.showCondition !== false ? <div style={{ fontSize: `${small}px`, color: '#666' }}>{condition.text}</div> : null}
            </div>
          </div>
          {config.showHumidity ? <div style={{ fontSize: `${small}px`, color: '#888' }}>{`Humidity: ${data.humidity}%`}</div> : null}
          {config.showWind ? <div style={{ fontSize: `${small}px`, color: '#888' }}>{`Wind: ${data.windSpeed}`}</div> : null}
          {config.showLocation !== false ? <div style={{ fontSize: `${small * 0.9}px`, color: '#999', marginTop: '4px' }}>{location}</div> : null}
        </div>
      ),
      style: this.styles(),
    };
  }

  private styles(): Record<string, string> {
    return { justifyContent: 'center', padding: '8px' };
  }

  private icon(name: string, size: number) {
    const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
    if (name === 'sun') {
      return <svg {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></svg>;
    }
    if (name === 'rain') {
      return <svg {...props}><path d="M20 16.2A4.5 4.5 0 0017 8h-1.3A6 6 0 104 14.9" /><path d="M8 19l-1 2M13 19l-1 2M18 19l-1 2" /></svg>;
    }
    return <svg {...props}><path d="M20 16.2A4.5 4.5 0 0017 8h-1.3A6 6 0 104 14.9" /><path d="M8 17h9" /></svg>;
  }
}
