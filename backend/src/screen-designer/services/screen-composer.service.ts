import { Injectable, Logger } from '@nestjs/common';
import type { ScreenDesign, ScreenWidget, WidgetTemplate } from '@prisma/client';
import { CustomWidgetsService } from '../../custom-widgets/custom-widgets.service';
import { getTrmnlFrameworkCss } from '../../plugins/sync/trmnl-framework';
import { DefaultWidgetsService } from '../widgets/default-widgets.service';
import { WidgetStyleService } from '../widgets/widget-style.service';
import { ImageDataUrlService } from '../widgets/image-data-url.service';
import { jsx, renderDocumentHtml, renderJsxToHtml, type JsxChild, type JsxElement, type ScreenRenderDocument } from './screen-render-document';
import type { DeviceContext } from './screen-renderer.service';
import type { WidgetRenderResult } from './widget-renderer.interface';

type WidgetWithTemplate = ScreenWidget & { template: WidgetTemplate };
type ScreenDesignWithWidgets = ScreenDesign & { widgets: WidgetWithTemplate[] };

@Injectable()
export class ScreenComposerService {
  private readonly logger = new Logger(ScreenComposerService.name);

  constructor(
    private readonly defaultWidgets: DefaultWidgetsService,
    private readonly customWidgets: CustomWidgetsService,
    private readonly style: WidgetStyleService,
    private readonly images: ImageDataUrlService,
  ) {}

  async compose(screen: ScreenDesignWithWidgets, deviceContext?: DeviceContext, fontStyleTag = ''): Promise<ScreenRenderDocument> {
    const children = await Promise.all(screen.widgets.map(widget => this.composeWidget(widget, deviceContext)));
    const root = jsx('div', {
      style: {
        width: `${screen.width}px`,
        height: `${screen.height}px`,
        background: this.style.sanitizeColor(screen.background || '#ffffff', '#ffffff'),
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
        boxSizing: 'border-box',
      },
    }, ...children);

    return {
      width: screen.width,
      height: screen.height,
      root,
      rootHtml: renderJsxToHtml(root),
      html: renderDocumentHtml(root, fontStyleTag),
    };
  }

  private async composeWidget(widget: WidgetWithTemplate, deviceContext?: DeviceContext): Promise<JsxElement> {
    const config = (widget.config || {}) as Record<string, any>;
    const rendered = await this.renderWidgetContent(widget, config, deviceContext);
    const rotation = widget.rotation || 0;
    const opacity = (config.opacity as number) ?? 100;
    const transform = rotation !== 0 ? `transform:rotate(${rotation}deg);transform-origin:center center;` : '';
    const opacityStyle = opacity < 100 ? `opacity:${opacity / 100};` : '';

    const props: Record<string, any> = {
      className: 'widget',
      style: `position:absolute;display:flex;align-items:center;overflow:hidden;box-sizing:border-box;left:${widget.x}px;top:${widget.y}px;width:${widget.width}px;height:${widget.height}px;${opacityStyle}${this.renderStyle(rendered.style)}${transform}`,
    };
    if (rendered.contentHtml !== undefined) {
      props.dangerouslySetInnerHTML = { __html: rendered.contentHtml };
    }

    return jsx('div', props, rendered.content);
  }

  private async renderWidgetContent(
    widget: WidgetWithTemplate,
    config: Record<string, any>,
    deviceContext?: DeviceContext,
  ): Promise<WidgetRenderResult> {
    if (this.defaultWidgets.canRender(widget.template.name)) {
      return this.defaultWidgets.render({ widget, config, deviceContext });
    }
    if (widget.template.name === 'custom-widget-base') return this.renderCustomWidget(config, widget);
    if (widget.template.name === 'plugin') return this.renderPluginPlaceholder(config);
    return { contentHtml: `<div style="color:#999;font-size:12px;">Unknown: ${this.style.escapeHtml(widget.template.name)}</div>` };
  }

  private async renderCustomWidget(config: Record<string, any>, widget: WidgetWithTemplate): Promise<WidgetRenderResult> {
    const customWidgetId = config.customWidgetId as number | undefined;
    if (!customWidgetId) return { contentHtml: '<div style="color:#999;">No widget ID</div>' };

    try {
      const result = await this.customWidgets.getWithData(customWidgetId, true, {
        width: widget.width,
        height: widget.height,
        ctx: this.getWidgetContext(config),
      });
      const renderedContent = result.renderedContent;
      const widgetConfig = (result.widget?.config as Record<string, any>) || {};
      const baseStyle = this.customBaseStyle(config);

      if (typeof renderedContent === 'string') {
        if (widgetConfig.fieldType === 'image') {
          const image = await this.images.load(renderedContent, true);
          return { contentHtml: `<div style="${baseStyle}"><img src="${image || ''}" style="max-width:100%;max-height:100%;object-fit:contain;"/></div>` };
        }
        return { contentHtml: `<div style="${baseStyle}"><div style="width:100%;text-align:${config.textAlign || 'center'};">${this.style.escapeHtml(renderedContent)}</div></div>` };
      }

      if (Array.isArray(renderedContent)) {
        const items = renderedContent.map(item => `<li style="margin-bottom:4px;">${this.style.escapeHtml(String(item))}</li>`).join('');
        return { contentHtml: `<div style="${baseStyle}"><ul style="list-style:none;margin:0;padding:0;width:100%;">${items}</ul></div>` };
      }

      if (renderedContent?.type === 'framework') {
        return { contentHtml: `<style>${getTrmnlFrameworkCss()}</style><div style="width:${widget.width}px;height:${widget.height}px;max-width:100%;max-height:100%;overflow:hidden;">${String(renderedContent.html || '')}</div>` };
      }

      if (renderedContent?.type === 'framework-jsx') {
        return {
          content: jsx('div', {
            style: {
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              overflow: 'hidden',
              display: 'flex',
            },
          }, renderedContent.node as JsxChild),
        };
      }

      if (renderedContent?.type === 'framework-error') {
        return { contentHtml: `<div style="${baseStyle};color:#999;font-size:12px;">${this.style.escapeHtml(String(renderedContent.error || 'Framework error'))}</div>` };
      }

      if ((renderedContent?.title || renderedContent?.label) && 'value' in renderedContent) {
        const label = String(renderedContent.title || renderedContent.label);
        return { contentHtml: `<div style="${baseStyle}"><div style="font-size:${(config.fontSize || 24) * 0.6}px;opacity:.6;">${this.style.escapeHtml(label)}</div><div style="font-weight:bold;">${this.style.escapeHtml(String(renderedContent.value))}</div></div>` };
      }

      return { contentHtml: `<div style="${baseStyle}"><pre style="font-size:12px;margin:0;white-space:pre-wrap;">${this.style.escapeHtml(JSON.stringify(renderedContent, null, 2))}</pre></div>` };
    } catch (error) {
      this.logger.warn(`Failed to render custom widget ${customWidgetId}: ${error instanceof Error ? error.message : String(error)}`);
      return { contentHtml: '<div style="color:#999;font-size:12px;">Error</div>' };
    }
  }

  private renderPluginPlaceholder(config: Record<string, any>): WidgetRenderResult {
    return { contentHtml: `<div style="font-size:12px;padding:8px;">Plugin ${this.style.escapeHtml(String(config.pluginId || ''))}</div>` };
  }

  private customBaseStyle(config: Record<string, any>): string {
    const align = config.textAlign === 'left' ? 'flex-start' : config.textAlign === 'right' ? 'flex-end' : 'center';
    const vertical = config.verticalAlign === 'top' ? 'flex-start' : config.verticalAlign === 'bottom' ? 'flex-end' : 'center';
    return `display:flex;flex-direction:column;align-items:${align};justify-content:${vertical};width:100%;height:100%;padding:8px;font-size:${config.fontSize || 24}px;font-family:${this.style.mapFontFamily(config.fontFamily || 'sans-serif')};font-weight:${config.fontWeight || 'normal'};text-align:${config.textAlign || 'center'};color:${this.style.sanitizeColor(config.color || '#000000')};line-height:1.2;overflow:hidden;`;
  }

  private renderStyle(style?: string | Record<string, any>): string {
    if (!style) return '';
    if (typeof style === 'string') return style;
    return Object.entries(style).map(([key, value]) => `${key}:${String(value)};`).join('');
  }

  private getWidgetContext(config: Record<string, any>): Record<string, unknown> {
    const ctx = config.ctx;
    return ctx && typeof ctx === 'object' && !Array.isArray(ctx) ? ctx : {};
  }
}
