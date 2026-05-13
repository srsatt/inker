import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class CountdownWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'countdown';

  constructor(private readonly style: WidgetStyleService) {}

  async render({ config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const targetDate = new Date(config.targetDate || '2025-12-31T23:59:59');
    const diffMs = targetDate.getTime() - Date.now();
    const fontSize = config.fontSize || 32;
    let content = <span>{config.label || "Time's up!"}</span>;

    if (diffMs > 0) {
      const days = Math.floor(diffMs / 86400000);
      const hours = Math.floor((diffMs % 86400000) / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      const parts = [
        config.showDays !== false && days > 0 ? `${days}d` : '',
        config.showHours !== false ? `${String(hours).padStart(2, '0')}h` : '',
        config.showMinutes !== false ? `${String(minutes).padStart(2, '0')}m` : '',
        config.showSeconds !== false ? `${String(seconds).padStart(2, '0')}s` : '',
      ].filter(Boolean);
      content = (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {config.label ? <div style={{ fontSize: `${fontSize * 0.5}px`, marginBottom: '4px' }}>{config.label}</div> : null}
          <div style={{ fontWeight: 'bold' }}>{parts.join(' ')}</div>
        </div>
      );
    }

    return {
      content,
      style: {
        fontSize: `${fontSize}px`,
        fontFamily: this.style.mapFontFamily(config.fontFamily || 'monospace'),
        flexDirection: 'column',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        padding: '0 8px',
      },
    };
  }
}
