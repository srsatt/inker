import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import sharp from '../../common/utils/sharp';
import { PrismaService } from '../../prisma/prisma.service';
import type { ScreenDesign, ScreenWidget, WidgetTemplate } from '@prisma/client';
import { CustomWidgetsService } from '../../custom-widgets/custom-widgets.service';
import { SettingsService } from '../../settings/settings.service';
import { ScreenComposerService } from './screen-composer.service';
import { PuppeteerScreenRendererService } from './screen-renderer.service';
import type { ScreenRenderDocument } from './screen-render-document';
import type { DeviceContext, RenderFormat, RenderMode } from './screen-renderer.service';
import { renderJsxToSatoriNode } from './satori-jsx-adapter';
import { formatSatoriLintIssues, lintSatoriNode } from './satori-jsx-linter';
import { encode1BitBmpFromGrayscale } from '../../common/utils/bmp.util';

type SatoriFontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type SatoriFont = { name: string; data: Buffer; weight: SatoriFontWeight; style: 'normal' };
type FontRequest = { family: string; weight: SatoriFontWeight };
type WidgetWithTemplate = ScreenWidget & { template: WidgetTemplate };
type ScreenDesignWithWidgets = ScreenDesign & { widgets: WidgetWithTemplate[] };
type SatoriRenderer = typeof import('satori').default;

let satoriRenderer: SatoriRenderer | null = null;

async function getSatori(): Promise<SatoriRenderer> {
  if (!satoriRenderer) {
    satoriRenderer = (await import('satori')).default;
  }
  return satoriRenderer;
}

@Injectable()
export class SatoriScreenRendererService extends PuppeteerScreenRendererService {
  protected override readonly logger = new Logger(SatoriScreenRendererService.name);
  protected override readonly rasterizerName = 'Satori';
  private readonly satoriFontCache = new Map<string, SatoriFont>();

  override async onModuleInit() {
    this.logger.debug('Satori fonts will be loaded lazily during render');
  }

  protected override async renderDesign(
    screenDesign: ScreenDesignWithWidgets,
    deviceContext?: DeviceContext,
    mode: RenderMode = 'device',
    format: RenderFormat = 'png',
  ): Promise<Buffer> {
    const { width, height } = screenDesign;
    const renderDocument = await this.screenComposer.compose(screenDesign, deviceContext, '', {
      skipCustomWidgetFetch: mode === 'preview',
    });

    const drawingPath = path.join(process.cwd(), 'uploads', 'drawings', `drawing_${screenDesign.id}.png`);
    if (fs.existsSync(drawingPath)) {
      return super.renderDesign(screenDesign, deviceContext, mode, format);
    }

    if (mode === 'preview') {
      return this.rasterizeDocument(renderDocument);
    }

    const svg = await this.renderSvg(renderDocument);
    const shouldNegate = mode === 'device';

    if (format === 'bmp') {
      const { ditheringMode, threshold } = await this.settingsService.getEinkRenderingConfig();
      const { data, info } = await sharp(Buffer.from(svg))
        .grayscale()
        .normalise()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const processed = this.applyMonochromeProcessing(
        data,
        info.width,
        info.height,
        threshold,
        ditheringMode,
      );
      const bmp = encode1BitBmpFromGrayscale(processed, info.width, info.height, threshold);
      this.logger.debug(`E-ink processing complete: ${bmp.length} bytes, direct Satori 1-bit BMP`);
      return bmp;
    }

    return this.applyEinkProcessing(sharp(Buffer.from(svg)), width, height, shouldNegate, format);
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

  protected override async rasterizeDocument(document: ScreenRenderDocument): Promise<Buffer> {
    const svg = await this.renderSvg(document);
    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private async renderSvg(document: ScreenRenderDocument): Promise<string> {
    const fonts = this.getSatoriFonts(document);
    const lintIssues = lintSatoriNode(document.root);
    if (lintIssues.length > 0) {
      throw new Error(`Satori JSX lint failed:\n${formatSatoriLintIssues(lintIssues)}`);
    }

    const root = renderJsxToSatoriNode(document.root);
    const satori = await getSatori();
    const svg = await satori(root as any, {
      width: document.width,
      height: document.height,
      fonts,
    });

    return svg;
  }

  private getSatoriFonts(document: ScreenRenderDocument): SatoriFont[] {
    const requests = this.getFontRequests(document);
    const fonts = requests.flatMap(request => this.loadSatoriFont(request));

    if (fonts.length > 0) {
      return fonts;
    }

    const fallbackFonts = this.loadSystemFallbackFonts();
    if (fallbackFonts.length === 0) {
      throw new Error('Satori renderer needs TTF, OTF, or WOFF fonts; bundled assets are WOFF2 only');
    }

    return fallbackFonts;
  }

  private getFontRequests(document: ScreenRenderDocument): FontRequest[] {
    const families = this.collectFontFamilies(document);
    const weights = this.collectFontWeights(document);
    const requests = new Map<string, FontRequest>();

    for (const family of families) {
      for (const weight of weights) {
        const request = { family, weight };
        requests.set(`${request.family}:${request.weight}`, request);
      }
    }

    return [...requests.values()];
  }

  private collectFontFamilies(document: ScreenRenderDocument): Set<string> {
    const families = new Set<string>(['Inter']);
    this.walkStyles(document.root, style => {
      const fontFamily = style.fontFamily ?? style['font-family'];
      if (typeof fontFamily === 'string') {
        for (const family of this.normalizeFontFamilies(fontFamily)) {
          families.add(family);
        }
      }
    });

    const fontFamilyDeclarations = document.rootHtml.match(/font-family\s*:\s*([^;"']+)/gi) || [];
    for (const declaration of fontFamilyDeclarations) {
      const [, value] = declaration.split(':');
      for (const family of this.normalizeFontFamilies(value || '')) {
        families.add(family);
      }
    }

    return families;
  }

  private collectFontWeights(document: ScreenRenderDocument): Set<SatoriFontWeight> {
    const weights = new Set<SatoriFontWeight>([400]);
    this.walkStyles(document.root, style => {
      const fontWeight = style.fontWeight ?? style['font-weight'];
      const weight = this.normalizeFontWeight(fontWeight);
      if (weight) weights.add(weight);
    });

    if (/font-weight\s*:\s*(bold|[7-9]00)/i.test(document.rootHtml)) {
      weights.add(700);
    }

    return weights;
  }

  private walkStyles(node: any, visit: (style: Record<string, any>) => void) {
    if (!node || typeof node !== 'object') return;
    const style = node.props?.style;
    if (style && typeof style === 'object') {
      visit(style);
    } else if (typeof style === 'string') {
      visit(this.cssStyleToObject(style));
    }
    for (const child of node.children || []) {
      this.walkStyles(child, visit);
    }
  }

  private cssStyleToObject(style: string): Record<string, string> {
    return style
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .reduce<Record<string, string>>((result, declaration) => {
        const separator = declaration.indexOf(':');
        if (separator === -1) return result;
        result[declaration.slice(0, separator).trim()] = declaration.slice(separator + 1).trim();
        return result;
      }, {});
  }

  private normalizeFontFamilies(value: string): string[] {
    return value
      .split(',')
      .map(family => family.trim().replace(/^['"]|['"]$/g, ''))
      .map(family => {
        if (family === 'sans-serif' || family === 'serif') return 'Inter';
        if (family === 'monospace') return 'TRMNL16';
        return family;
      })
      .filter(family => ['Inter', 'TRMNL12', 'TRMNL16', 'TRMNL21'].includes(family));
  }

  private normalizeFontWeight(value: unknown): SatoriFontWeight | null {
    if (value === 'bold') return 700;
    if (value === 'normal') return 400;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const rounded = Math.min(900, Math.max(100, Math.round(numeric / 100) * 100));
    return rounded as SatoriFontWeight;
  }

  private loadSatoriFont(request: FontRequest): SatoriFont[] {
    const effectiveFamily = request.family === 'Inter' ? 'TRMNL16' : request.family;
    const key = `${request.family}:${request.weight}`;
    const cached = this.satoriFontCache.get(key);
    if (cached) return [cached];

    const fontPath = this.findBundledFontPath(effectiveFamily, request.weight);
    if (!fontPath) return [];

    const font: SatoriFont = {
      name: request.family,
      data: fs.readFileSync(fontPath),
      weight: request.weight,
      style: 'normal',
    };
    this.satoriFontCache.set(key, font);
    return [font];
  }

  private findBundledFontPath(family: string, weight: SatoriFontWeight): string | null {
    const fontsDir = path.join(process.cwd(), 'assets', 'fonts');
    const suffix = weight >= 600 ? 'Bold' : 'Regular';
    const candidates = [
      `${family}-${suffix}.ttf`,
      `${family}-${suffix}.woff`,
      `${family}.ttf`,
    ];

    for (const candidate of candidates) {
      const fontPath = path.join(fontsDir, candidate);
      if (fs.existsSync(fontPath)) return fontPath;
    }

    return null;
  }

  private loadSystemFallbackFonts(): SatoriFont[] {
    const specs = [
      { name: 'Inter', weight: 400, paths: [
        '/System/Library/Fonts/Supplemental/Arial.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      ] },
      { name: 'Inter', weight: 700, paths: [
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      ] },
      { name: 'Roboto Mono', weight: 400, paths: [
        '/System/Library/Fonts/Supplemental/Courier New.ttf',
        '/System/Library/Fonts/Monaco.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
      ] },
    ];

    const fonts = specs.flatMap(spec => {
      const fontPath = spec.paths.find(candidate => fs.existsSync(candidate));
      if (!fontPath) return [];
      return [{
        name: spec.name,
        data: fs.readFileSync(fontPath),
        weight: spec.weight as SatoriFontWeight,
        style: 'normal' as const,
      }];
    });

    if (fonts.length > 0) {
      this.logger.warn('Satori renderer is using system font fallbacks because bundled fonts are WOFF2');
    }

    return fonts;
  }
}
