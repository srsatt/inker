import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import type { ScreenDesign, ScreenWidget, WidgetTemplate } from '@prisma/client';
import { CustomWidgetsService } from '../../custom-widgets/custom-widgets.service';
import { SettingsService } from '../../settings/settings.service';
import { rgbaToGrayscale, encode1BitBmpFromGrayscale } from '../../common/utils/bmp.util';
import { ScreenComposerService } from './screen-composer.service';
import { PuppeteerScreenRendererService } from './screen-renderer.service';
import type { DeviceContext, RenderFormat, RenderMode } from './screen-renderer.service';
import type { FontLoader } from 'takumi-js';

type TakumiRenderer = import('takumi-js/node').Renderer;
type TakumiFont = FontLoader;
type WidgetWithTemplate = ScreenWidget & { template: WidgetTemplate };
type ScreenDesignWithWidgets = ScreenDesign & { widgets: WidgetWithTemplate[] };

@Injectable()
export class TakumiScreenRendererService extends PuppeteerScreenRendererService {
  protected override readonly logger = new Logger(TakumiScreenRendererService.name);
  protected override readonly rasterizerName = 'Takumi';
  private readonly takumiFontCache = new Map<string, TakumiFont>();
  private takumiRenderer: Promise<TakumiRenderer> | null = null;

  override async onModuleInit() {
    this.logger.debug('Takumi renderer will load native core and fonts lazily during render');
  }

  constructor(
    prisma: PrismaService,
    customWidgetsService: CustomWidgetsService,
    configService: ConfigService,
    settingsService: SettingsService,
    screenComposer: ScreenComposerService,
  ) {
    super(prisma, customWidgetsService, configService, settingsService, screenComposer);
  }

  protected override async renderDesign(
    screenDesign: ScreenDesignWithWidgets,
    deviceContext?: DeviceContext,
    mode: RenderMode = 'device',
    format: RenderFormat = 'png',
  ): Promise<Buffer> {
    const drawingPath = path.join(process.cwd(), 'uploads', 'drawings', `drawing_${screenDesign.id}.png`);
    if (fs.existsSync(drawingPath)) {
      return super.renderDesign(screenDesign, deviceContext, mode, format);
    }

    const startedAt = performance.now();
    const renderDocument = await this.screenComposer.compose(screenDesign, deviceContext);
    const composedAt = performance.now();
    const renderer = await this.getTakumiRenderer();
    const rendererReadyAt = performance.now();
    const { fromHtml } = await import('takumi-js/helpers/html');
    const { node, stylesheets } = fromHtml(renderDocument.rootHtml);
    const parsedAt = performance.now();

    if (mode === 'preview' || format === 'png') {
      const png = Buffer.from(await renderer.render(node, {
        width: renderDocument.width,
        height: renderDocument.height,
        format: 'png',
        stylesheets,
      }));
      this.logger.debug(`[TAKUMI-PERF] design=${screenDesign.id} mode=${mode} format=png compose=${Math.round(composedAt - startedAt)}ms renderer=${Math.round(rendererReadyAt - composedAt)}ms parse=${Math.round(parsedAt - rendererReadyAt)}ms render=${Math.round(performance.now() - parsedAt)}ms`);
      return png;
    }

    const raw = await renderer.render(node, {
      width: renderDocument.width,
      height: renderDocument.height,
      format: 'raw',
      stylesheets,
    });
    const renderedAt = performance.now();
    const gray = rgbaToGrayscale(raw, renderDocument.width, renderDocument.height);
    const { ditheringMode, threshold } = await this.settingsService.getEinkRenderingConfig();
    const processed = this.applyMonochromeProcessing(
      gray,
      renderDocument.width,
      renderDocument.height,
      threshold,
      ditheringMode,
    );
    const processedAt = performance.now();

    const bmp = encode1BitBmpFromGrayscale(processed, renderDocument.width, renderDocument.height, threshold);
    this.logger.debug(`[TAKUMI-PERF] design=${screenDesign.id} mode=${mode} format=bmp compose=${Math.round(composedAt - startedAt)}ms renderer=${Math.round(rendererReadyAt - composedAt)}ms parse=${Math.round(parsedAt - rendererReadyAt)}ms render=${Math.round(renderedAt - parsedAt)}ms process=${Math.round(processedAt - renderedAt)}ms encode=${Math.round(performance.now() - processedAt)}ms bytes=${bmp.length}`);
    return bmp;
  }

  private async getTakumiRenderer(): Promise<TakumiRenderer> {
    this.takumiRenderer ??= this.createTakumiRenderer();
    return this.takumiRenderer;
  }

  private async createTakumiRenderer(): Promise<TakumiRenderer> {
    const { Renderer } = await import('takumi-js/node');
    const renderer = new Renderer({ loadDefaultFonts: false });
    await renderer.loadFonts(this.getTakumiFonts());
    return renderer;
  }

  private getTakumiFonts(): TakumiFont[] {
    const fonts: TakumiFont[] = [];
    for (const request of [
      { family: 'Inter', weight: 400 },
      { family: 'Inter', weight: 700 },
      { family: 'TRMNL12', weight: 400 },
      { family: 'TRMNL16', weight: 400 },
      { family: 'TRMNL21', weight: 400 },
    ]) {
      const font = this.loadTakumiFont(request.family, request.weight);
      if (font) fonts.push(font);
    }
    return fonts;
  }

  private loadTakumiFont(family: string, weight: number): TakumiFont | null {
    const key = `${family}:${weight}`;
    const cached = this.takumiFontCache.get(key);
    if (cached) return cached;

    const effectiveFamily = family === 'Inter' ? 'TRMNL16' : family;
    const suffix = weight >= 600 ? 'Bold' : 'Regular';
    const fontsDir = path.join(process.cwd(), 'assets', 'fonts');
    const candidates = [
      `${effectiveFamily}-${suffix}.ttf`,
      `${effectiveFamily}-${suffix}.woff`,
      `${effectiveFamily}.ttf`,
    ];

    for (const candidate of candidates) {
      const fontPath = path.join(fontsDir, candidate);
      if (!fs.existsSync(fontPath)) continue;
      const font: TakumiFont = {
        name: family,
        data: fs.readFileSync(fontPath),
        weight,
        style: 'normal',
      };
      this.takumiFontCache.set(key, font);
      return font;
    }

    return null;
  }
}
