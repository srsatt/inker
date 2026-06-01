import { Injectable, Logger } from '@nestjs/common';
import * as vm from 'vm';
import { validateUrlSafety } from '../../common/utils/url-safety';
import { SETTING_KEYS, SettingsService } from '../../settings/settings.service';
import { Fragment, jsx, type JsxChild } from '../../screen-designer/services/screen-render-document';

export interface FrameworkJsxResult {
  success: boolean;
  node?: JsxChild;
  error?: string;
}

export interface FrameworkRenderContext {
  width?: number;
  height?: number;
  ctx?: Record<string, unknown>;
}

@Injectable()
export class FrameworkJsxExecutorService {
  private readonly logger = new Logger(FrameworkJsxExecutorService.name);
  private readonly TIMEOUT_MS = 1500;
  private readonly MAX_TEMPLATE_LENGTH = 20_000;
  private readonly BLOCKED_PATTERNS = [
    /\bconstructor\b/,
    /\b__proto__\b/,
    /\bprototype\b/,
    /\bFunction\b/,
    /\beval\b/,
    /\bimport\b/,
    /\bglobalThis\b/,
    /\bprocess\b/,
    /\brequire\b/,
    /\bProxy\b/,
    /\bReflect\b/,
    /\bSymbol\b/,
    /\bfetch\b/,
  ];

  constructor(private readonly settingsService?: SettingsService) {}

  async execute(template: string, data: unknown, renderContext: FrameworkRenderContext = {}): Promise<FrameworkJsxResult> {
    try {
      this.validate(template);
      const js = this.transpile(`async function __render() { ${template} }\n__render();`);
      const script = new vm.Script(this.bindJsxRuntime(js));
      const context = this.createContext(data, renderContext);
      const value = script.runInContext(context, { timeout: this.TIMEOUT_MS });
      const node = await this.withTimeout(Promise.resolve(value));
      return { success: true, node: node as JsxChild };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Framework JSX execution failed: ${message}`);
      return { success: false, error: message };
    }
  }

  private validate(template: string): void {
    if (template.length > this.MAX_TEMPLATE_LENGTH) {
      throw new Error(`Framework template too large: ${template.length} characters`);
    }
    for (const pattern of this.BLOCKED_PATTERNS) {
      if (pattern.test(template)) {
        throw new Error(`Framework template contains forbidden keyword: ${pattern.source.replace(/\\b/g, '')}`);
      }
    }
  }

  private transpile(code: string): string {
    const BunGlobal = (globalThis as any).Bun;
    if (!BunGlobal?.Transpiler) {
      throw new Error('JSX framework templates require Bun.Transpiler');
    }
    return new BunGlobal.Transpiler({ loader: 'tsx' }).transformSync(code);
  }

  private bindJsxRuntime(js: string): string {
    const jsxNames = [...new Set(js.match(/\bjsxDEV_[A-Za-z0-9_$]+\b/g) || [])];
    const fragmentNames = [...new Set(js.match(/\bFragment_[A-Za-z0-9_$]+\b/g) || [])];
    return [
      ...jsxNames.map(name => `const ${name} = jsxDEV;`),
      ...fragmentNames.map(name => `const ${name} = Fragment;`),
      js,
    ].join('\n');
  }

  private createContext(data: unknown, renderContext: FrameworkRenderContext): vm.Context {
    const context: vm.Context = Object.create(null);
    vm.createContext(context);
    context.Function = undefined;
    context.eval = undefined;
    context.__dataJson = JSON.stringify(data ?? null);
    context.__widgetJson = JSON.stringify(renderContext);
    context.__ctxJson = JSON.stringify(renderContext.ctx ?? {});
    context.jsxDEV = (type: string, props: Record<string, any> | null) => jsx(type, props);
    context.Fragment = Fragment;
    context.fetchJson = (url: string, init?: RequestInit) => this.fetchJson(url, init);
    context.fetchText = (url: string, init?: RequestInit) => this.fetchText(url, init);
    new vm.Script('var $ = JSON.parse(__dataJson); var widget = Object.freeze(JSON.parse(__widgetJson)); var ctx = Object.freeze(JSON.parse(__ctxJson)); __dataJson = undefined; __widgetJson = undefined; __ctxJson = undefined;').runInContext(context, {
      timeout: this.TIMEOUT_MS,
    });
    return context;
  }

  private async fetchJson(url: string, init?: RequestInit): Promise<unknown> {
    const response = await this.fetch(url, init);
    return response.json();
  }

  private async fetchText(url: string, init?: RequestInit): Promise<string> {
    const response = await this.fetch(url, init);
    return response.text();
  }

  private async fetch(url: string, init?: RequestInit): Promise<Response> {
    await validateUrlSafety(url, {
      allowLocalNetwork: await this.allowLocalNetwork(),
    });
    const response = await globalThis.fetch(url, {
      method: init?.method || 'GET',
      headers: init?.headers,
      body: init?.body,
      signal: AbortSignal.timeout(this.TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    return response;
  }

  private async allowLocalNetwork(): Promise<boolean> {
    const value = await this.settingsService?.get(SETTING_KEYS.ALLOW_LOCAL_NETWORK);
    return value === 'true';
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const watchdog = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Framework template timed out')), this.TIMEOUT_MS);
    });
    try {
      return await Promise.race([promise, watchdog]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}
