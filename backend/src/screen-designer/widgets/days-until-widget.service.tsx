import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class DaysUntilWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'daysuntil';

  constructor(private readonly style: WidgetStyleService) {}

  async render({ config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const targetDate = new Date(config.targetDate || '2025-12-25');
    targetDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const text = `${config.labelPrefix ?? 'Days till Christmas: '}${diffDays < 0 ? Math.abs(diffDays) : diffDays}${config.labelSuffix || ''}`;

    return {
      content: <span>{text}</span>,
      style: {
        fontSize: `${config.fontSize || 32}px`,
        fontFamily: this.style.mapFontFamily(config.fontFamily || 'sans-serif'),
        color: this.style.sanitizeColor(config.color || '#000000'),
        whiteSpace: 'nowrap',
        padding: '0 8px',
      },
    };
  }
}
