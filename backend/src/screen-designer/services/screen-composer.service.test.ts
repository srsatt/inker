import { describe, expect, it } from 'bun:test';
import { ConfigService } from '@nestjs/config';
import { CustomWidgetsService } from '../../custom-widgets/custom-widgets.service';
import { DefaultWidgetsService } from '../widgets/default-widgets.service';
import { ImageDataUrlService } from '../widgets/image-data-url.service';
import { WidgetStyleService } from '../widgets/widget-style.service';
import { jsx } from './screen-render-document';
import { ScreenComposerService } from './screen-composer.service';
import { lintSatoriNode } from './satori-jsx-linter';

describe('ScreenComposerService', () => {
  it('keeps framework JSX custom widgets in the shared Satori document', async () => {
    const getWithDataCalls: unknown[][] = [];
    const service = new ScreenComposerService(
      { canRender: () => false } as unknown as DefaultWidgetsService,
      {
        getWithData: async (...args: unknown[]) => {
          getWithDataCalls.push(args);
          return {
            widget: { config: { templateMode: 'jsx' } },
            data: {},
            renderedContent: {
              type: 'framework-jsx',
              node: jsx('div', {
                style: {
                  display: 'flex',
                  flexDirection: 'column',
                  fontSize: '18px',
                },
              }, 'Birds today'),
            },
          };
        },
      } as unknown as CustomWidgetsService,
      new WidgetStyleService(new ConfigService()),
      { load: async () => null } as unknown as ImageDataUrlService,
    );

    const document = await service.compose({
      id: 1,
      name: 'Framework JSX',
      description: null,
      width: 800,
      height: 480,
      background: '#ffffff',
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      widgets: [{
        id: 1,
        screenDesignId: 1,
        templateId: 10,
        x: 0,
        y: 0,
        width: 360,
        height: 260,
        rotation: 0,
        config: { customWidgetId: 2 },
        zIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        template: {
          id: 10,
          name: 'custom-widget-base',
          description: null,
          category: 'custom',
          icon: null,
          defaultConfig: {},
          minWidth: 100,
          minHeight: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }],
    });

    expect(document.rootHtml).toContain('Birds today');
    expect(document.rootHtml).not.toContain('Framework JSX widgets are not');
    expect(getWithDataCalls[0]?.[1]).toBe(false);
    expect(lintSatoriNode(document.root)).toEqual([]);
  });

  it('uses cached custom widget data for explicit preview composition', async () => {
    const getWithDataCalls: unknown[][] = [];
    const service = new ScreenComposerService(
      { canRender: () => false } as unknown as DefaultWidgetsService,
      {
        getWithData: async (...args: unknown[]) => {
          getWithDataCalls.push(args);
          return {
            widget: { config: {} },
            data: {},
            renderedContent: 'Cached preview',
          };
        },
      } as unknown as CustomWidgetsService,
      new WidgetStyleService(new ConfigService()),
      { load: async () => null } as unknown as ImageDataUrlService,
    );

    await service.compose({
      id: 1,
      name: 'Preview',
      description: null,
      width: 800,
      height: 480,
      background: '#ffffff',
      isPublic: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      widgets: [{
        id: 1,
        screenDesignId: 1,
        templateId: 10,
        x: 0,
        y: 0,
        width: 360,
        height: 260,
        rotation: 0,
        config: { customWidgetId: 2 },
        zIndex: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        template: {
          id: 10,
          name: 'custom-widget-base',
          description: null,
          category: 'custom',
          icon: null,
          defaultConfig: {},
          minWidth: 100,
          minHeight: 50,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }],
    }, undefined, '', { skipCustomWidgetFetch: true });

    expect(getWithDataCalls[0]?.[1]).toBe(true);
  });
});
