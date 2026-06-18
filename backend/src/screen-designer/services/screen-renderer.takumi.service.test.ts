import { describe, expect, it } from 'bun:test';
import { jsx, renderDocumentHtml, renderJsxToHtml } from './screen-render-document';
import { TakumiScreenRendererService } from './screen-renderer.takumi.service';

describe('TakumiScreenRendererService', () => {
  function createRenderer(screenComposer: any = {}) {
    return new TakumiScreenRendererService(
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

  it('renders device BMP from raw Takumi pixels without Sharp', async () => {
    const composeCalls: unknown[][] = [];
    const root = jsx('div', {
      style: {
        width: '320px',
        height: '180px',
        background: '#ffffff',
        display: 'flex',
        fontFamily: 'Inter',
        color: '#111111',
      },
    }, 'Takumi BMP');
    const document = {
      width: 320,
      height: 180,
      root,
      rootHtml: renderJsxToHtml(root),
      html: renderDocumentHtml(root, ''),
    };
    const renderer = createRenderer({
      compose: async (...args: unknown[]) => {
        composeCalls.push(args);
        return document;
      },
    });

    const bmp = await (renderer as any).renderDesign({
      id: 999999,
      width: 320,
      height: 180,
      widgets: [],
      background: '#ffffff',
    }, undefined, 'device', 'bmp');

    expect(bmp.subarray(0, 2).toString('ascii')).toBe('BM');
    expect(bmp.length).toBe(7262);
    expect(composeCalls[0]?.[3]).toEqual({ skipCustomWidgetFetch: false });
  });
});
