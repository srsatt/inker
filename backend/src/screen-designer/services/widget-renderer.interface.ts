import type { ScreenWidget, WidgetTemplate } from '@prisma/client';
import type { JsxChild } from './screen-render-document';
import type { DeviceContext } from './screen-renderer.service';

export type WidgetWithTemplate = ScreenWidget & { template: WidgetTemplate };

export interface WidgetRenderContext {
  widget: WidgetWithTemplate;
  config: Record<string, any>;
  deviceContext?: DeviceContext;
}

export interface WidgetRenderResult {
  content?: JsxChild;
  contentHtml?: string;
  style?: string | Record<string, any>;
}

export interface ScreenWidgetContentRenderer {
  readonly templateName: string;
  render(context: WidgetRenderContext): Promise<WidgetRenderResult>;
}
