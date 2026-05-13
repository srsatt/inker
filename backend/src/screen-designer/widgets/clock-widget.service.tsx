import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class ClockWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'clock';

  constructor(private readonly style: WidgetStyleService) {}

  async render({ config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const timezone = config.timezone || 'local';
    const effectiveTimezone = timezone === 'local' || timezone === '' ? this.style.getDefaultTimezone() : timezone;
    const value = new Date().toLocaleTimeString('en-US', {
      timeZone: effectiveTimezone,
      hour: '2-digit',
      minute: '2-digit',
      second: config.showSeconds ? '2-digit' : undefined,
      hour12: config.format === '12h',
    });

    return {
      content: <span>{value}</span>,
      style: {
        fontSize: `${config.fontSize || 48}px`,
        fontFamily: this.style.mapFontFamily(config.fontFamily || 'monospace'),
        justifyContent: this.style.justify(config.textAlign || 'left'),
        whiteSpace: 'nowrap',
        padding: '0 8px',
      },
    };
  }
}
