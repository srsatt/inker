import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as sharpModule from 'sharp';
import satori from 'satori';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomWidgetsService } from '../../custom-widgets/custom-widgets.service';
import { SettingsService } from '../../settings/settings.service';
import { ScreenComposerService } from './screen-composer.service';
import {
  PuppeteerScreenRendererService,
  type RendererFont,
} from './screen-renderer.service';
import type { ScreenRenderDocument } from './screen-render-document';
import { renderJsxToSatoriNode } from './satori-jsx-adapter';
import { formatSatoriLintIssues, lintSatoriNode } from './satori-jsx-linter';

const sharp = (sharpModule as any).default || sharpModule;
type SatoriFontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type SatoriFont = { name: string; data: Buffer; weight: SatoriFontWeight; style: 'normal' };

@Injectable()
export class SatoriScreenRendererService extends PuppeteerScreenRendererService {
  protected override readonly logger = new Logger(SatoriScreenRendererService.name);
  protected override readonly rasterizerName = 'Satori';
  private satoriFonts?: SatoriFont[];

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
    const fonts = this.getSatoriFonts();
    const lintIssues = lintSatoriNode(document.root);
    if (lintIssues.length > 0) {
      throw new Error(`Satori JSX lint failed:\n${formatSatoriLintIssues(lintIssues)}`);
    }

    const root = renderJsxToSatoriNode(document.root);
    const svg = await satori(root as any, {
      width: document.width,
      height: document.height,
      fonts,
    });

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private getSatoriFonts(): SatoriFont[] {
    if (this.satoriFonts) return this.satoriFonts;

    const bundledFonts = this.getRendererFonts()
      .filter((font: RendererFont) => font.data.toString('ascii', 0, 4) !== 'wOF2')
      .map((font: RendererFont) => ({
        name: font.family,
        data: font.data,
        weight: font.weight as SatoriFontWeight,
        style: 'normal' as const,
      }));

    if (bundledFonts.length > 0) {
      this.satoriFonts = bundledFonts;
      return this.satoriFonts;
    }

    const fallbackFonts = this.loadSystemFallbackFonts();
    if (fallbackFonts.length === 0) {
      throw new Error('Satori renderer needs TTF, OTF, or WOFF fonts; bundled assets are WOFF2 only');
    }

    this.satoriFonts = fallbackFonts;
    return this.satoriFonts;
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
