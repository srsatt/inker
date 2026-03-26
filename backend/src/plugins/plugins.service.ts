import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PluginRendererService, PluginLayout } from './plugin-renderer.service';
import { EncryptionService } from '../common/services/encryption.service';
import { OAuthService } from './oauth/oauth.service';
import {
  CreatePluginDto,
  UpdatePluginDto,
  CreatePluginInstanceDto,
  UpdatePluginInstanceDto,
} from './dto/create-plugin.dto';

const SETTINGS_MASK = '••••••••';
const MAX_FETCHES_PER_MINUTE = 30;

@Injectable()
export class PluginsService {
  private readonly logger = new Logger(PluginsService.name);
  private fetchCounter = 0;
  private fetchCounterResetAt = Date.now() + 60000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluginRenderer: PluginRendererService,
    private readonly encryption: EncryptionService,
    private readonly oauthService: OAuthService,
  ) {}

  // ========================
  // Plugin CRUD
  // ========================

  async findAllPlugins() {
    return this.prisma.plugin.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { instances: true } } },
    });
  }

  async findPluginById(id: number) {
    const plugin = await this.prisma.plugin.findUnique({
      where: { id },
      include: { instances: true },
    });
    if (!plugin) throw new NotFoundException(`Plugin ${id} not found`);
    return plugin;
  }

  async findPluginBySlug(slug: string) {
    return this.prisma.plugin.findUnique({ where: { slug } });
  }

  async createPlugin(dto: CreatePluginDto) {
    return this.prisma.plugin.create({ data: dto });
  }

  async updatePlugin(id: number, dto: UpdatePluginDto) {
    return this.prisma.plugin.update({ where: { id }, data: dto });
  }

  async deletePlugin(id: number) {
    return this.prisma.plugin.delete({ where: { id } });
  }

  // ========================
  // Install / Uninstall
  // ========================

  async installPlugin(id: number) {
    return this.prisma.plugin.update({
      where: { id },
      data: { isInstalled: true },
    });
  }

  async uninstallPlugin(id: number) {
    return this.prisma.plugin.update({
      where: { id },
      data: { isInstalled: false },
    });
  }

  // ========================
  // Plugin Instances
  // ========================

  async findAllInstances() {
    return this.prisma.pluginInstance.findMany({
      include: { plugin: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInstanceById(id: number) {
    const instance = await this.prisma.pluginInstance.findUnique({
      where: { id },
      include: { plugin: true },
    });
    if (!instance) throw new NotFoundException(`Plugin instance ${id} not found`);
    return instance;
  }

  async createInstance(dto: CreatePluginInstanceDto) {
    const plugin = await this.findPluginById(dto.pluginId);
    const { plain, encrypted } = this.separateEncryptedFields(
      dto.settings || {},
      (plugin.settingsSchema as any[]) || [],
    );

    return this.prisma.pluginInstance.create({
      data: {
        pluginId: dto.pluginId,
        name: dto.name,
        settings: plain,
        settingsEncrypted: encrypted,
      },
      include: { plugin: true },
    });
  }

  async updateInstance(id: number, dto: UpdatePluginInstanceDto) {
    const instance = await this.prisma.pluginInstance.findUnique({
      where: { id },
      include: { plugin: true },
    });
    if (!instance) throw new NotFoundException(`Plugin instance ${id} not found`);

    if (dto.settings) {
      const existingEncrypted = (instance.settingsEncrypted || {}) as Record<string, string>;
      const schema = (instance.plugin.settingsSchema as any[]) || [];
      const encryptedKeys = new Set(schema.filter(f => f.encrypted).map(f => f.key));

      for (const key of encryptedKeys) {
        if (dto.settings[key] === SETTINGS_MASK && existingEncrypted[key]) {
          delete dto.settings[key];
        }
      }

      const { plain, encrypted } = this.separateEncryptedFields(dto.settings, schema);

      return this.prisma.pluginInstance.update({
        where: { id },
        data: {
          name: dto.name,
          settings: plain,
          settingsEncrypted: { ...existingEncrypted, ...encrypted },
          lastData: Prisma.DbNull,
          lastFetchedAt: null,
          lastError: null,
        },
        include: { plugin: true },
      });
    }

    return this.prisma.pluginInstance.update({
      where: { id },
      data: { name: dto.name },
      include: { plugin: true },
    });
  }

  async findInstanceByIdMasked(id: number) {
    const instance = await this.findInstanceById(id);
    return this.maskEncryptedSettings(instance);
  }

  getDecryptedSettings(instance: any): Record<string, any> {
    const plain = (instance.settings || {}) as Record<string, any>;
    const encrypted = (instance.settingsEncrypted || {}) as Record<string, string>;
    if (Object.keys(encrypted).length === 0) return plain;
    return { ...plain, ...this.encryption.decryptObject(encrypted) };
  }

  private separateEncryptedFields(
    settings: Record<string, any>,
    schema: any[],
  ): { plain: Record<string, any>; encrypted: Record<string, string> } {
    const encryptedKeys = new Set(schema.filter(f => f.encrypted).map(f => f.key));
    const plain: Record<string, any> = {};
    const toEncrypt: Record<string, any> = {};

    for (const [key, value] of Object.entries(settings)) {
      if (encryptedKeys.has(key) && value !== undefined && value !== null && value !== '') {
        toEncrypt[key] = value;
      } else {
        plain[key] = value;
      }
    }

    const encrypted = Object.keys(toEncrypt).length > 0
      ? this.encryption.encryptObject(toEncrypt)
      : {};

    return { plain, encrypted };
  }

  private maskEncryptedSettings(instance: any): any {
    const encrypted = (instance.settingsEncrypted || {}) as Record<string, string>;
    if (Object.keys(encrypted).length === 0) return instance;

    const maskedSettings = { ...(instance.settings as Record<string, any>) };
    for (const key of Object.keys(encrypted)) {
      maskedSettings[key] = SETTINGS_MASK;
    }

    return { ...instance, settings: maskedSettings, settingsEncrypted: undefined };
  }

  async deleteInstance(id: number) {
    return this.prisma.pluginInstance.delete({ where: { id } });
  }

  private validateSettings(settings: Record<string, any>, schema: any[]): void {
    for (const field of schema) {
      const value = settings[field.key];
      if (field.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Setting "${field.label || field.key}" is required`);
      }
      if (value === undefined || value === null || value === '') continue;
      if (field.type === 'number' && typeof value !== 'number' && isNaN(Number(value))) {
        throw new Error(`Setting "${field.label || field.key}" must be a number`);
      }
      if (field.type === 'select' && field.options?.length > 0) {
        const validOptions = field.options.map((o: any) => typeof o === 'object' ? o.value : o);
        if (!validOptions.includes(value)) {
          throw new Error(`Setting "${field.label || field.key}" must be one of: ${validOptions.join(', ')}`);
        }
      }
    }
  }

  // ========================
  // Data Fetching
  // ========================

  async fetchData(instanceId: number): Promise<Record<string, any>> {
    const instance = await this.findInstanceById(instanceId);
    const plugin = instance.plugin;
    const settings = this.getDecryptedSettings(instance);

    // Check cache
    if (instance.lastFetchedAt && instance.lastData) {
      const age = (Date.now() - instance.lastFetchedAt.getTime()) / 1000;
      if (age < plugin.refreshInterval) {
        return instance.lastData as Record<string, any>;
      }
    }

    // Rate limiting
    if (Date.now() > this.fetchCounterResetAt) {
      this.fetchCounter = 0;
      this.fetchCounterResetAt = Date.now() + 60000;
    }
    if (this.fetchCounter >= MAX_FETCHES_PER_MINUTE) {
      this.logger.warn(`Rate limit reached (${MAX_FETCHES_PER_MINUTE}/min), returning cached data`);
      return (instance.lastData as Record<string, any>) || {};
    }
    this.fetchCounter++;

    // Pre-flight: check required/encrypted settings before making external requests
    const schema = (plugin.settingsSchema as any[]) || [];
    const missingFields = schema
      .filter(f => (f.encrypted || f.required) && !settings[f.key])
      .map(f => f.label || f.key);
    if (missingFields.length > 0) {
      const errorMsg = `[settings] Missing required: ${missingFields.join(', ')}`;
      this.logger.warn(`Plugin ${plugin.slug}: ${errorMsg}`);
      await this.prisma.pluginInstance.update({
        where: { id: instanceId },
        data: { lastError: errorMsg },
      });
      return (instance.lastData as Record<string, any>) || {};
    }

    try {
      // Inject OAuth access token if available
      if ((plugin as any).oauthProvider) {
        const accessToken = await this.oauthService.getAccessToken(instanceId);
        if (accessToken) {
          settings.oauth_access_token = accessToken;
        }
      }

      const data = await this.executePlugin(plugin, settings);

      await this.prisma.pluginInstance.update({
        where: { id: instanceId },
        data: { lastData: data, lastFetchedAt: new Date(), lastError: null },
      });

      return data;
    } catch (error) {
      const msg = error.message || String(error);
      const prefix = msg.includes('HTTP ') || msg.includes('timeout') ? '[network]' : '[plugin]';
      const errorMsg = msg.startsWith('[') ? msg : `${prefix} ${msg}`;
      this.logger.error(`Plugin ${plugin.slug} fetch failed: ${errorMsg}`);
      await this.prisma.pluginInstance.update({
        where: { id: instanceId },
        data: { lastError: errorMsg },
      });
      return (instance.lastData as Record<string, any>) || {};
    }
  }

  async fetchDataForPlugin(pluginId: number, settings: Record<string, any> = {}): Promise<Record<string, any>> {
    const plugin = await this.findPluginById(pluginId);
    try {
      return await this.executePlugin(plugin, settings);
    } catch (error) {
      this.logger.error(`Plugin ${plugin.slug} execute failed: ${error.message}`);
      return {};
    }
  }

  /**
   * Execute a plugin's data pipeline.
   * Priority: 1) JS adapter, 2) URL fetch
   */
  private async executePlugin(plugin: any, settings: Record<string, any>): Promise<Record<string, any>> {
    // JS adapter (for user-created plugins with dataTransform)
    if (plugin.dataTransform) {
      return this.runAsyncTransform(plugin.dataTransform, settings, plugin.slug);
    }

    // URL fetch (for URL-based custom plugins)
    if (plugin.dataUrl) {
      const url = this.interpolate(plugin.dataUrl, settings);
      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (plugin.dataHeaders) {
        for (const [key, value] of Object.entries(plugin.dataHeaders as Record<string, string>)) {
          headers[key] = this.interpolate(value, settings);
        }
      }
      const response = await fetch(url, {
        method: plugin.dataMethod || 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      let data = await response.json();
      if (plugin.dataPath) data = this.extractByPath(data, plugin.dataPath);
      return data;
    }

    return {};
  }

  private async runAsyncTransform(
    script: string,
    settings: Record<string, any>,
    slug: string,
  ): Promise<Record<string, any>> {
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction('settings', 'fetch', script);
      const result = await Promise.race([
        fn(settings, globalThis.fetch),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Plugin timeout (10s)')), 10000)),
      ]);
      return (result && typeof result === 'object') ? result : {};
    } catch (error) {
      this.logger.error(`Plugin ${slug} JS adapter failed: ${error.message}`);
      throw error;
    }
  }

  // ========================
  // Rendering
  // ========================

  /**
   * Preview a plugin with mock data or placeholder card.
   */
  async previewPlugin(
    plugin: any,
    layout: PluginLayout = 'full',
  ): Promise<Buffer> {
    const { width, height } = this.getDimensionsForLayout(layout);

    // For custom plugins with Liquid markup, render with mock data
    const markup = this.pluginRenderer.selectMarkup(plugin, layout);
    if (markup) {
      try {
        const mockData = this.generateMockData(markup);
        return await this.pluginRenderer.renderToPng(markup, mockData, {}, width, height, 'preview');
      } catch (e) {
        this.logger.warn(`Plugin ${plugin.slug} Liquid preview failed: ${e.message}`);
      }
    }

    // Fallback: placeholder card
    return this.renderPluginPlaceholder(plugin, width, height);
  }

  /**
   * Preview raw Liquid markup with provided or auto-generated mock data (for plugin creator).
   */
  async previewMarkup(markup: string, data: Record<string, any> = {}): Promise<Buffer> {
    const mockData = Object.keys(data).length > 0 ? data : this.generateMockData(markup);
    return this.pluginRenderer.renderToPng(markup, mockData, {}, 800, 480, 'preview');
  }

  /**
   * Render a plugin instance to PNG for device display.
   */
  async renderInstance(
    instanceId: number,
    layout: PluginLayout = 'full',
    mode: 'device' | 'preview' | 'einkPreview' = 'device',
  ): Promise<Buffer> {
    const instance = await this.findInstanceById(instanceId);
    const plugin = instance.plugin;
    const settings = this.getDecryptedSettings(instance);
    const { width, height } = this.getDimensionsForLayout(layout);

    // Fetch fresh data
    const locals = await this.fetchData(instanceId);

    // Liquid rendering (for custom plugins with markup in DB)
    const markup = this.pluginRenderer.selectMarkup(plugin, layout);
    if (!markup) {
      throw new NotFoundException(`Plugin ${plugin.slug} has no template for layout ${layout}`);
    }

    return this.pluginRenderer.renderToPng(markup, locals, settings, width, height, mode);
  }

  private async renderPluginPlaceholder(plugin: any, width: number, height: number): Promise<Buffer> {
    const category = (plugin.category || 'custom').charAt(0).toUpperCase() + (plugin.category || 'custom').slice(1);
    const source = (plugin.source || 'inker').toUpperCase();
    const description = plugin.description || 'No description available';
    const needsConfig = plugin.settingsSchema && (plugin.settingsSchema as any[]).some((f: any) => f.encrypted);

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${width}px; height: ${height}px; font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; background: #fff; color: #000; }
  .card { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: space-between; }
  .main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; text-align: center; }
  .name { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
  .desc { font-size: 14px; color: #666; max-width: 500px; line-height: 1.4; margin-bottom: 16px; }
  .badges { display: flex; gap: 8px; justify-content: center; }
  .badge { padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; border: 1px solid #ddd; }
  .badge--cat { background: #f5f5f5; }
  .badge--src { background: #e8f4fd; color: #1976d2; }
  .config { font-size: 12px; color: #999; margin-top: 12px; }
  .footer { padding: 12px 24px; border-top: 2px solid #000; display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; }
  .footer .instance { margin-left: auto; font-weight: 400; color: #999; }
</style></head><body>
<div class="card">
  <div class="main">
    <div class="name">${plugin.name}</div>
    <div class="desc">${description.slice(0, 120)}</div>
    <div class="badges">
      <span class="badge badge--cat">${category}</span>
      <span class="badge badge--src">${source}</span>
    </div>
    ${needsConfig ? '<div class="config">Requires API key to show live data</div>' : ''}
  </div>
  <div class="footer">
    <span>${plugin.name}</span>
    <span class="instance">Preview</span>
  </div>
</div>
</body></html>`;

    return this.pluginRenderer.screenRenderer.renderHtmlToPng(html, width, height);
  }

  private generateMockData(template: string): Record<string, any> {
    const data: Record<string, any> = {};
    const forMatches = template.matchAll(/\{%\s*for\s+(\w+)\s+in\s+(\w+)/g);
    for (const match of forMatches) {
      const itemVar = match[1];
      const collectionVar = match[2];
      if (!data[collectionVar]) {
        data[collectionVar] = Array.from({ length: 3 }, (_, i) => ({
          title: `Sample ${itemVar} ${i + 1}`,
          name: `Sample ${i + 1}`,
          value: (i + 1) * 100,
          score: (i + 1) * 10,
          label: `Label ${i + 1}`,
          description: `Description for item ${i + 1}`,
        }));
      }
    }
    const varMatches = template.matchAll(/\{\{\s*(\w+)\s*[|}]/g);
    for (const match of varMatches) {
      const varName = match[1];
      if (!data[varName] && !['for', 'if', 'unless', 'else', 'endif', 'endfor', 'forloop', 'settings'].includes(varName)) {
        data[varName] = `${varName.replace(/_/g, ' ')}`;
      }
    }
    data.instance_name = 'Preview';
    return data;
  }

  // ========================
  // Webhooks
  // ========================

  async handleWebhook(slug: string, data: Record<string, any>): Promise<{ updated: number }> {
    const plugin = await this.findPluginBySlug(slug);
    if (!plugin) throw new NotFoundException(`Plugin "${slug}" not found`);

    const instances = await this.prisma.pluginInstance.findMany({
      where: { pluginId: plugin.id },
    });

    let updated = 0;
    for (const instance of instances) {
      await this.prisma.pluginInstance.update({
        where: { id: instance.id },
        data: { lastData: data, lastFetchedAt: new Date(), lastError: null },
      });
      updated++;
    }

    this.logger.log(`Webhook for ${slug}: updated ${updated} instances`);
    return { updated };
  }

  // ========================
  // Helpers
  // ========================

  private interpolate(template: string, settings: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return settings[key] !== undefined ? String(settings[key]) : '';
    });
  }

  private extractByPath(data: any, dataPath: string): any {
    const parts = dataPath.split('.');
    let result = data;
    for (const part of parts) {
      if (result == null) return null;
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        result = result[arrayMatch[1]]?.[parseInt(arrayMatch[2])];
      } else {
        result = result[part];
      }
    }
    return result;
  }

  private getDimensionsForLayout(layout: PluginLayout): { width: number; height: number } {
    switch (layout) {
      case 'full': return { width: 800, height: 480 };
      case 'half_horizontal': return { width: 800, height: 240 };
      case 'half_vertical': return { width: 400, height: 480 };
      case 'quadrant': return { width: 400, height: 240 };
      default: return { width: 800, height: 480 };
    }
  }

  // ========================
  // Diagnostics
  // ========================

  async diagnosePlugins(): Promise<any[]> {
    const plugins = await this.prisma.plugin.findMany({
      orderBy: { name: 'asc' },
    });

    return plugins.map(plugin => {
      const schema = (plugin.settingsSchema as any[]) || [];
      const hasEncrypted = schema.some(f => f.encrypted);
      const hasRequired = schema.some(f => f.required);
      const configRequirement = (plugin as any).oauthProvider
        ? 'oauth'
        : (hasEncrypted || hasRequired) ? 'api_key' : 'none';
      const hasMarkup = !!(plugin.markupFull || (plugin as any).dataUrl);

      return {
        slug: plugin.slug,
        name: plugin.name,
        id: plugin.id,
        status: hasMarkup ? (configRequirement !== 'none' ? 'needs_config' : 'ready') : 'no_template',
        configRequirement,
        settingsCount: schema.length,
      };
    });
  }

  // ========================
  // Widget Templates Integration
  // ========================

  async getAsWidgetTemplates(): Promise<any[]> {
    const plugins = await this.prisma.plugin.findMany({
      where: { isInstalled: true },
    });

    return plugins.map((plugin, index) => ({
      id: 20000 + plugin.id,
      name: plugin.name,
      description: plugin.description || '',
      category: 'Plugins',
      icon: plugin.icon || 'puzzle',
      config: {
        type: 'plugin',
        pluginId: plugin.id,
        pluginSlug: plugin.slug,
      },
    }));
  }

  // ========================
  // Cleanup
  // ========================

  async cleanupStalePlugins(): Promise<void> {
    // Clean up stale TRMNL-synced plugins and mirror (Ruby pipeline removed)
    const deleted = await this.prisma.plugin.deleteMany({
      where: { OR: [{ source: 'trmnl' }, { slug: 'trmnl_mirror' }] },
    });
    if (deleted.count > 0) {
      this.logger.log(`Cleaned up ${deleted.count} stale plugins`);
    }
  }
}
