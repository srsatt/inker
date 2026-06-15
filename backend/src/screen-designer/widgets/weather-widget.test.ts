import { Test, TestingModule } from '@nestjs/testing';
import { WeatherWidgetService } from './weather-widget.service';
import { WeatherDataService } from './weather-data.service';
import { WidgetStyleService } from './widget-style.service';
import { lintSatoriNode } from '../services/satori-jsx-linter';
import { renderJsxToHtml } from '../services/screen-render-document';

describe('WeatherWidgetService', () => {
  let service: WeatherWidgetService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeatherWidgetService,
        {
          provide: WeatherDataService,
          useValue: {
            get: jest.fn().mockResolvedValue({
              temperature: 20,
              weatherCode: 0,
              humidity: 65,
              windSpeed: '10 km/h',
              dayName: 'Monday',
            }),
            condition: jest.fn().mockReturnValue({
              icon: 'sun',
              text: 'Sunny',
            }),
          },
        },
        {
          provide: WidgetStyleService,
          useValue: {
            styles: jest.fn().mockReturnValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<WeatherWidgetService>(WeatherWidgetService);
  });

  it('should render weather widget without errors', async () => {
    const result = await service.render({
      config: {
        location: 'Test Location',
        latitude: 52.2297,
        longitude: 21.0122,
        forecastDay: 0,
        forecastTime: 'current',
        units: 'metric',
        fontSize: 32,
        showDayName: false,
        showIcon: true,
        showTemperature: true,
        showCondition: true,
        showHumidity: true,
        showWind: true,
        showLocation: true,
      },
    });

    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.style).toBeDefined();
    expect(lintSatoriNode(result.content)).toEqual([]);
  });

  it('renders all weather text in e-ink black', async () => {
    const result = await service.render({
      config: {
        location: 'Test Location',
        fontSize: 32,
        showDayName: true,
        forecastDay: 1,
        showCondition: true,
        showHumidity: true,
        showWind: true,
        showLocation: true,
      },
    });

    const html = renderJsxToHtml(result.content);
    expect(html).not.toContain('#666');
    expect(html).not.toContain('#888');
    expect(html).not.toContain('#999');
    expect(html).toContain('#000000');
  });
});
