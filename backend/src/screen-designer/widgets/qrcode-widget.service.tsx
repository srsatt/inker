import { Injectable } from '@nestjs/common';
import QRCode from 'qrcode';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class QrCodeWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'qrcode';

  constructor(private readonly style: WidgetStyleService) {}

  async render({ widget, config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const content = config.content || 'https://example.com';
    const qrSize = config.size || Math.min(Math.min(widget.width, widget.height) - 20, 100);

    try {
      const qrDataUrl = await QRCode.toDataURL(content, {
        width: qrSize,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      });

      return {
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <img src={qrDataUrl} alt="QR" style={{ width: `${qrSize}px`, height: `${qrSize}px` }} />
            <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{content.length > 30 ? `${content.substring(0, 30)}...` : content}</div>
          </div>
        ),
        style: { justifyContent: 'center' },
      };
    } catch {
      return { content: <div style={{ fontSize: '10px', color: '#888' }}>QR Code</div> };
    }
  }
}
