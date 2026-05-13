import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { WidgetStyleService } from './widget-style.service';
import { ImageDataUrlService } from './image-data-url.service';

@Injectable()
export class ImageWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'image';

  constructor(
    private readonly style: WidgetStyleService,
    private readonly images: ImageDataUrlService,
  ) {}

  async render({ config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const url = config.url || config.imageUrl || '';
    if (!url) {
      return this.placeholder('No image URL');
    }

    const imageUrl = await this.images.load(url, false);
    if (!imageUrl) {
      return this.placeholder('Image unavailable');
    }

    return {
      content: (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white' }}>
          <img src={imageUrl} alt="Image" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: config.fit || 'contain', filter: 'grayscale(100%) contrast(1.2)' }} />
        </div>
      ),
    };
  }

  private placeholder(text: string): WidgetRenderResult {
    return {
      content: <div style={{ color: '#999', fontSize: '12px' }}>{text}</div>,
    };
  }
}
