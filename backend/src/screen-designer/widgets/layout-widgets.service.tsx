import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class DividerWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'divider';
  constructor(private readonly style: WidgetStyleService) {}
  async render({ widget, config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const thickness = config.thickness || 2;
    const horizontal = (config.orientation || 'horizontal') === 'horizontal';
    const border = config.style && config.style !== 'solid'
      ? { borderStyle: config.style, borderColor: this.style.sanitizeColor(config.color || '#000000'), borderWidth: `${thickness}px`, backgroundColor: 'transparent' }
      : { backgroundColor: this.style.sanitizeColor(config.color || '#000000') };
    return {
      content: <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}><div style={{ ...border, width: horizontal ? '100%' : `${thickness}px`, height: horizontal ? `${thickness}px` : '100%' }} /></div>,
      style: { width: `${widget.width}px`, height: `${widget.height}px` },
    };
  }
}

@Injectable()
export class RectangleWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'rectangle';
  constructor(private readonly style: WidgetStyleService) {}
  async render({ config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const borderColor = this.style.sanitizeColor(config.borderColor || '#000000');
    return {
      content: <div style={{ width: '100%', height: '100%', backgroundColor: this.style.sanitizeColor(config.backgroundColor || config.fillColor || '#000000'), border: config.borderWidth > 0 ? `${config.borderWidth}px solid ${borderColor}` : 'none', borderRadius: `${config.borderRadius || 0}px` }} />,
    };
  }
}
