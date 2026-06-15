import { describe, expect, it } from 'bun:test';
import sharp from '../../common/utils/sharp';
import { jsx, renderDocumentHtml, renderJsxToHtml } from './screen-render-document';
import { SatoriScreenRendererService } from './screen-renderer.satori.service';

describe('SatoriScreenRendererService', () => {
  function createRenderer(screenComposer: any = {}) {
    return new SatoriScreenRendererService(
      {} as any,
      {} as any,
      { get: () => undefined } as any,
      {
        getEinkRenderingConfig: async () => ({
          ditheringMode: 'threshold',
          threshold: 128,
        }),
      } as any,
      screenComposer,
    );
  }

  it('rasterizes a framework-style JSX document to PNG', async () => {
    const renderer = createRenderer();

    const root = jsx('div', {
      style: {
        width: '320px',
        height: '180px',
        background: '#ffffff',
        display: 'flex',
        padding: '12px',
        fontFamily: 'Inter',
      },
    }, jsx('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        fontSize: '24px',
        fontWeight: 700,
        color: '#111111',
      },
    }, 'Framework JSX'));

    const png = await renderer.renderJsx({
      width: 320,
      height: 180,
      root,
      rootHtml: renderJsxToHtml(root),
      html: renderDocumentHtml(root, ''),
    });

    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe('png');
    expect(metadata.width).toBe(320);
    expect(metadata.height).toBe(180);
  });

  it('loads Satori fonts lazily from the document', async () => {
    const renderer = createRenderer();
    await renderer.onModuleInit();

    expect((renderer as any).satoriFontCache.size).toBe(0);

    const root = jsx('div', {
      style: {
        width: '320px',
        height: '180px',
        display: 'flex',
        fontFamily: 'Inter',
        fontWeight: 700,
      },
    }, 'Lazy fonts');

    await renderer.renderJsx({
      width: 320,
      height: 180,
      root,
      rootHtml: renderJsxToHtml(root),
      html: renderDocumentHtml(root, ''),
    });

    expect((renderer as any).satoriFontCache.size).toBeGreaterThan(0);
    expect((renderer as any).satoriFontCache.size).toBeLessThanOrEqual(2);
  });

  it('renders device BMP without requiring an intermediate PNG request path', async () => {
    const root = jsx('div', {
      style: {
        width: '320px',
        height: '180px',
        background: '#ffffff',
        display: 'flex',
        fontFamily: 'Inter',
        color: '#111111',
      },
    }, 'Device BMP');
    const document = {
      width: 320,
      height: 180,
      root,
      rootHtml: renderJsxToHtml(root),
      html: renderDocumentHtml(root, ''),
    };
    const renderer = createRenderer({
      compose: async () => document,
    });

    const bmp = await (renderer as any).renderDesign({
      id: 1,
      width: 320,
      height: 180,
      widgets: [],
      background: '#ffffff',
    }, undefined, 'device', 'bmp');

    expect(bmp.subarray(0, 2).toString('ascii')).toBe('BM');
    expect(bmp.length).toBeGreaterThan(1000);
  });
});
