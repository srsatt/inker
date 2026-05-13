import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as sharpModule from 'sharp';
import { SettingsService, SETTING_KEYS } from '../../settings/settings.service';
import { validateUrlSafety } from '../../common/utils/url-safety';

const sharp = (sharpModule as any).default || sharpModule;

@Injectable()
export class ImageDataUrlService {
  private readonly logger = new Logger(ImageDataUrlService.name);

  constructor(private readonly settingsService: SettingsService) {}

  async load(url: string, processForEink = false): Promise<string | null> {
    if (!url) return null;
    if (url.startsWith('data:')) return url;

    try {
      const { buffer, contentType } = await this.readImage(url);
      if (!processForEink) return `data:${contentType};base64,${buffer.toString('base64')}`;

      const processed = await sharp(buffer)
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .grayscale()
        .normalize()
        .png()
        .toBuffer();

      return `data:image/png;base64,${processed.toString('base64')}`;
    } catch (error) {
      this.logger.warn(`Failed to load image ${url}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async readImage(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    if (url.startsWith('/uploads/')) {
      const buffer = await fs.readFile(this.resolveUploadPath(url));
      const ext = path.extname(url).slice(1) || 'png';
      return { buffer, contentType: `image/${ext}` };
    }

    const allowLocalNetwork = await this.settingsService.get(SETTING_KEYS.ALLOW_LOCAL_NETWORK);
    await validateUrlSafety(url, { allowLocalNetwork: allowLocalNetwork === 'true' });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get('content-type') || 'image/png',
    };
  }

  private resolveUploadPath(url: string): string {
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const resolved = path.resolve(process.cwd(), url.slice(1));
    if (!resolved.startsWith(uploadsRoot + path.sep) && resolved !== uploadsRoot) {
      throw new Error('Path traversal detected');
    }
    return resolved;
  }
}
