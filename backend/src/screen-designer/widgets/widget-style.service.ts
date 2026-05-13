import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WidgetStyleService {
  constructor(private readonly configService: ConfigService) {}

  getDefaultTimezone(): string {
    return this.configService.get<string>('defaultTimezone', 'UTC');
  }

  mapFontFamily(fontFamily: string): string {
    switch (fontFamily) {
      case 'sans-serif':
        return "'Inter', sans-serif";
      case 'monospace':
        return "'Roboto Mono', monospace";
      case 'serif':
        return "'Merriweather', serif";
      default:
        return fontFamily.includes(',') ? fontFamily : `${fontFamily}, sans-serif`;
    }
  }

  justify(textAlign = 'left'): string {
    return textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';
  }

  sanitizeColor(color: string, fallback = '#000000'): string {
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)) return color;
    return fallback;
  }

  escapeHtml(text: string): string {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
