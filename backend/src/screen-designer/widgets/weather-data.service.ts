import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WeatherDataService {
  private readonly logger = new Logger(WeatherDataService.name);
  private readonly cache = new Map<string, { data: WeatherData; timestamp: number }>();

  async get(latitude: number, longitude: number, forecastDay: number, forecastTime: string): Promise<WeatherData | null> {
    const cacheKey = `${latitude},${longitude},${forecastDay},${forecastTime}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) return cached.data;

    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(latitude));
      url.searchParams.set('longitude', String(longitude));
      url.searchParams.set('current', 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m');
      url.searchParams.set('hourly', 'temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m');
      url.searchParams.set('forecast_days', String(Math.max(forecastDay + 1, 1)));
      url.searchParams.set('timezone', 'auto');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Weather API error: ${response.status}`);

      const result = this.pick(await response.json(), forecastDay, forecastTime);
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      this.logger.warn(`Failed to fetch weather: ${error instanceof Error ? error.message : String(error)}`);
      return cached?.data ?? null;
    }
  }

  condition(code: number): { text: string; icon: string } {
    const conditions: Record<number, { text: string; icon: string }> = {
      0: { text: 'Clear', icon: 'sun' },
      1: { text: 'Mostly Clear', icon: 'sun' },
      2: { text: 'Partly Cloudy', icon: 'cloud-sun' },
      3: { text: 'Cloudy', icon: 'cloud' },
      45: { text: 'Foggy', icon: 'fog' },
      51: { text: 'Light Drizzle', icon: 'drizzle' },
      61: { text: 'Light Rain', icon: 'rain' },
      63: { text: 'Rain', icon: 'rain' },
      65: { text: 'Heavy Rain', icon: 'rain' },
      71: { text: 'Light Snow', icon: 'snow' },
      73: { text: 'Snow', icon: 'snow' },
      75: { text: 'Heavy Snow', icon: 'snow' },
      95: { text: 'Thunderstorm', icon: 'thunder' },
    };
    return conditions[code] || { text: 'Unknown', icon: 'cloud' };
  }

  private pick(data: any, forecastDay: number, forecastTime: string): WeatherData {
    const now = new Date();
    const target = new Date(now);
    target.setDate(target.getDate() + forecastDay);
    const dayName = forecastDay === 0 ? 'Today' : forecastDay === 1 ? 'Tomorrow'
      : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][target.getDay()];
    const hour = ({ current: now.getHours(), morning: 8, noon: 12, afternoon: 15, evening: 19, night: 22 } as Record<string, number>)[forecastTime] ?? 12;
    const targetTime = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00`;
    const index = forecastDay === 0 && forecastTime === 'current' ? -1 : (data.hourly?.time || []).indexOf(targetTime);
    const source = index >= 0 ? { t: data.hourly.temperature_2m[index], c: data.hourly.weather_code[index], h: data.hourly.relative_humidity_2m[index], w: data.hourly.wind_speed_10m[index] }
      : { t: data.current.temperature_2m, c: data.current.weather_code, h: data.current.relative_humidity_2m, w: data.current.wind_speed_10m };
    return { temperature: Math.round(source.t), weatherCode: source.c, humidity: source.h, windSpeed: Math.round(source.w), dayName };
  }
}

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  humidity: number;
  windSpeed: number;
  dayName: string;
}
