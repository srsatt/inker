import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class TextWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'text';

  constructor(private readonly style: WidgetStyleService) {}

  async render({ config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const textAlign = config.textAlign || 'left';
    return {
      content: <div style={{ width: '100%', textAlign }}>{config.text || 'Text'}</div>,
      style: {
        fontSize: `${config.fontSize || 24}px`,
        fontFamily: this.style.mapFontFamily(config.fontFamily || 'sans-serif'),
        fontWeight: config.fontWeight || 'normal',
        color: this.style.sanitizeColor(config.color || '#000000'),
        padding: '10px',
        lineHeight: '1.2',
      },
    };
  }
}
