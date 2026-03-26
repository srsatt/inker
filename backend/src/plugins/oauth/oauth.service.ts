import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly providers: Record<string, OAuthProviderConfig>;
  private readonly callbackUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {
    this.providers = (config.get('oauth.providers') || {}) as Record<string, OAuthProviderConfig>;
    const apiUrl = config.get<string>('api.url') || 'http://localhost:3002';
    this.callbackUrl = `${apiUrl}/plugins/oauth/callback`;
  }

  getAvailableProviders(): string[] {
    return Object.entries(this.providers)
      .filter(([, cfg]) => cfg.clientId && cfg.clientSecret)
      .map(([name]) => name);
  }

  getAuthorizationUrl(instanceId: number, provider: string): string {
    const cfg = this.getProviderConfig(provider);
    const state = this.encryption.encrypt(JSON.stringify({ instanceId, provider }));

    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: cfg.scopes || '',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `${cfg.authUrl}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<{ instanceId: number; provider: string }> {
    let parsed: { instanceId: number; provider: string };
    try {
      parsed = JSON.parse(this.encryption.decrypt(state));
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }

    const { instanceId, provider } = parsed;
    const cfg = this.getProviderConfig(provider);

    const tokenResponse = await this.exchangeCode(code, cfg);
    await this.storeTokens(instanceId, tokenResponse);

    this.logger.log(`OAuth connected for instance ${instanceId} (provider: ${provider})`);
    return parsed;
  }

  async getAccessToken(instanceId: number): Promise<string | null> {
    const instance: any = await this.prisma.pluginInstance.findUnique({
      where: { id: instanceId },
      include: { plugin: true },
    });
    if (!instance?.oauthToken) return null;

    // Check if token is expired (with 5-minute buffer)
    if (instance.oauthExpiresAt && instance.oauthExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
      if (instance.oauthRefreshToken && instance.plugin.oauthProvider) {
        return this.refreshToken(instanceId, instance.plugin.oauthProvider, instance.oauthRefreshToken);
      }
      return null;
    }

    try {
      return this.encryption.decrypt(instance.oauthToken);
    } catch {
      return null;
    }
  }

  async disconnectOAuth(instanceId: number): Promise<void> {
    await (this.prisma.pluginInstance as any).update({
      where: { id: instanceId },
      data: {
        oauthToken: null,
        oauthRefreshToken: null,
        oauthExpiresAt: null,
      },
    });
  }

  private async refreshToken(instanceId: number, provider: string, encryptedRefreshToken: string): Promise<string | null> {
    const cfg = this.getProviderConfig(provider);

    let refreshToken: string;
    try {
      refreshToken = this.encryption.decrypt(encryptedRefreshToken);
    } catch {
      this.logger.error(`Failed to decrypt refresh token for instance ${instanceId}`);
      return null;
    }

    try {
      const response = await fetch(cfg.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        this.logger.error(`Token refresh failed for instance ${instanceId}: ${response.status}`);
        return null;
      }

      const tokenData: TokenResponse = await response.json();
      await this.storeTokens(instanceId, tokenData);
      return tokenData.access_token;
    } catch (error) {
      this.logger.error(`Token refresh error for instance ${instanceId}: ${error.message}`);
      return null;
    }
  }

  private async exchangeCode(code: string, cfg: OAuthProviderConfig): Promise<TokenResponse> {
    const response = await fetch(cfg.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: this.callbackUrl,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException(`OAuth token exchange failed: ${response.status} ${body}`);
    }

    return response.json();
  }

  private async storeTokens(instanceId: number, tokens: TokenResponse): Promise<void> {
    const data: any = {
      oauthToken: this.encryption.encrypt(tokens.access_token),
    };

    if (tokens.refresh_token) {
      data.oauthRefreshToken = this.encryption.encrypt(tokens.refresh_token);
    }

    if (tokens.expires_in) {
      data.oauthExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    }

    await this.prisma.pluginInstance.update({
      where: { id: instanceId },
      data,
    });
  }

  private getProviderConfig(provider: string): OAuthProviderConfig {
    const cfg = this.providers[provider];
    if (!cfg?.clientId || !cfg?.clientSecret) {
      throw new BadRequestException(`OAuth provider "${provider}" is not configured. Set OAUTH_${provider.toUpperCase()}_CLIENT_ID and OAUTH_${provider.toUpperCase()}_CLIENT_SECRET environment variables.`);
    }
    return cfg;
  }
}
