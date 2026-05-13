import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class GitHubStarsService {
  private readonly logger = new Logger(GitHubStarsService.name);
  private readonly cache = new Map<string, { data: GitHubStars; timestamp: number }>();

  constructor(
    private readonly configService: ConfigService,
    private readonly settingsService: SettingsService,
  ) {}

  async get(owner: string, repo: string): Promise<GitHubStars | null> {
    const cacheKey = `${owner}/${repo}`.toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) return cached.data;

    try {
      let githubToken = await this.settingsService.getGitHubToken();
      if (!githubToken) githubToken = this.configService.get<string>('github.token') ?? null;

      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Inker-E-Ink-Display',
      };
      if (githubToken) headers.Authorization = `Bearer ${githubToken}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        { signal: controller.signal, headers },
      );
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);

      const data = await response.json();
      const result = {
        stars: data.stargazers_count || 0,
        name: data.full_name || `${owner}/${repo}`,
      };
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      this.logger.warn(`Failed to fetch GitHub stars: ${error instanceof Error ? error.message : String(error)}`);
      return cached?.data ?? null;
    }
  }
}

export interface GitHubStars {
  stars: number;
  name: string;
}
