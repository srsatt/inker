import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class DateWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'date';

  constructor(private readonly style: WidgetStyleService) {}

  async render({ config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const timezone = config.timezone || '';
    const effectiveTimezone = timezone === 'local' || timezone === '' ? this.style.getDefaultTimezone() : timezone;
    const options: Intl.DateTimeFormatOptions = { timeZone: effectiveTimezone };
    if (config.showWeekday ?? config.showDayOfWeek ?? false) options.weekday = 'long';
    if (config.showDay ?? true) options.day = 'numeric';
    if (config.showMonth ?? true) options.month = 'long';
    if (config.showYear ?? true) options.year = 'numeric';

    const fontSize = config.fontSize || 24;
    const value = new Date().toLocaleDateString(config.locale || 'en-US', options);
    return {
      content: <span>{value}</span>,
      style: {
        fontSize: `${fontSize}px`,
        fontFamily: this.style.mapFontFamily(config.fontFamily || 'sans-serif'),
        lineHeight: `${fontSize * 1.2}px`,
        whiteSpace: 'nowrap',
        padding: '0 8px',
        justifyContent: this.style.justify(config.textAlign || 'center'),
      },
    };
  }
}
