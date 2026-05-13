import { Injectable } from '@nestjs/common';
import { jsx } from '../services/screen-render-document';
import type { ScreenWidgetContentRenderer, WidgetRenderContext, WidgetRenderResult } from '../services/widget-renderer.interface';
import { GitHubStarsService } from './github-stars.service';
import { WidgetStyleService } from './widget-style.service';

@Injectable()
export class GithubWidgetService implements ScreenWidgetContentRenderer {
  readonly templateName = 'github';

  constructor(
    private readonly github: GitHubStarsService,
    private readonly style: WidgetStyleService,
  ) {}

  async render({ config }: WidgetRenderContext): Promise<WidgetRenderResult> {
    const owner = config.owner || 'facebook';
    const repo = config.repo || 'react';
    const fontSize = config.fontSize || 32;
    const result = await this.github.get(owner, repo);
    const stars = result?.stars ?? 0;
    const formatted = stars >= 1000000 ? `${(stars / 1000000).toFixed(1)}M`
      : stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : String(stars);
    const iconSize = Math.min(fontSize * 1.2, 48);

    return {
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {config.showIcon !== false ? <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" /></svg> : null}
            <span style={{ fontSize: `${fontSize}px`, fontWeight: 'bold' }}>{formatted}</span>
          </div>
          {config.showRepoName ? <div style={{ fontSize: `${Math.max(12, fontSize * 0.4)}px`, color: '#888', marginTop: '4px' }}>{owner}/{repo}</div> : null}
        </div>
      ),
      style: {
        fontFamily: this.style.mapFontFamily(config.fontFamily || 'sans-serif'),
        justifyContent: 'center',
      },
    };
  }
}
