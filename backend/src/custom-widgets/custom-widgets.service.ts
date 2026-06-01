import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DataSourcesService } from '../data-sources/data-sources.service';
import { ScriptExecutorService } from './services/script-executor.service';
import { FrameworkJsxExecutorService } from './services/framework-jsx-executor.service';
import { CreateCustomWidgetDto } from './dto/create-custom-widget.dto';
import { UpdateCustomWidgetDto } from './dto/update-custom-widget.dto';
import { wrapListResponse, wrapPaginatedResponse } from '../common/utils/response.util';
import { CUSTOM_WIDGET_TEMPLATE_OFFSET } from '../common/constants/widget.constants';
import { formatSatoriLintIssues, lintSatoriNode } from '../screen-designer/services/satori-jsx-linter';

interface CustomWidgetRenderContext {
  width?: number;
  height?: number;
  ctx?: Record<string, unknown>;
}

/** Safe dataSource select — never exposes headers to the frontend */
const SAFE_DATASOURCE_SELECT = {
  id: true,
  name: true,
  type: true,
  isActive: true,
  contextSchema: true,
  lastFetchedAt: true,
  lastError: true,
} as const;

@Injectable()
export class CustomWidgetsService {
  private readonly logger = new Logger(CustomWidgetsService.name);

  constructor(
    private prisma: PrismaService,
    private dataSourcesService: DataSourcesService,
    private scriptExecutor: ScriptExecutorService,
    private frameworkJsxExecutor?: FrameworkJsxExecutorService,
  ) {}

  /**
   * Create a new custom widget
   */
  async create(createCustomWidgetDto: CreateCustomWidgetDto) {
    // Verify data source exists
    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: createCustomWidgetDto.dataSourceId },
    });

    if (!dataSource) {
      throw new BadRequestException('Data source not found');
    }

    this.validateWidgetContextExtendsDataSource(
      createCustomWidgetDto.contextSchema,
      dataSource.contextSchema as Record<string, unknown> | null,
    );
    await this.validateFrameworkDraft(createCustomWidgetDto, dataSource.lastData ?? []);

    const customWidget = await this.prisma.customWidget.create({
      data: {
        name: createCustomWidgetDto.name,
        description: createCustomWidgetDto.description,
        dataSourceId: createCustomWidgetDto.dataSourceId,
        displayType: createCustomWidgetDto.displayType,
        template: createCustomWidgetDto.template,
        config: (createCustomWidgetDto.config || {}) as object,
        contextSchema: createCustomWidgetDto.contextSchema as object | undefined,
        minWidth: createCustomWidgetDto.minWidth || 100,
        minHeight: createCustomWidgetDto.minHeight || 50,
      },
      include: {
        dataSource: { select: SAFE_DATASOURCE_SELECT },
      },
    });

    this.logger.log(`Custom widget created: ${customWidget.name}`);

    return customWidget;
  }

  /**
   * Find all custom widgets with pagination
   */
  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [customWidgets, total] = await Promise.all([
      this.prisma.customWidget.findMany({
        include: {
          dataSource: { select: SAFE_DATASOURCE_SELECT },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.customWidget.count(),
    ]);

    return wrapPaginatedResponse(customWidgets, total, page, limit);
  }

  /**
   * Find one custom widget by ID
   */
  async findOne(id: number) {
    const customWidget = await this.prisma.customWidget.findUnique({
      where: { id },
      include: {
        dataSource: { select: SAFE_DATASOURCE_SELECT },
      },
    });

    if (!customWidget) {
      throw new NotFoundException('Custom widget not found');
    }

    return customWidget;
  }

  /**
   * Update custom widget
   */
  async update(id: number, updateCustomWidgetDto: UpdateCustomWidgetDto) {
    const customWidget = await this.prisma.customWidget.findUnique({
      where: { id },
      include: {
        dataSource: true,
      },
    });

    if (!customWidget) {
      throw new NotFoundException('Custom widget not found');
    }

    // Verify new data source exists if changing
    if (updateCustomWidgetDto.dataSourceId) {
      const dataSource = await this.prisma.dataSource.findUnique({
        where: { id: updateCustomWidgetDto.dataSourceId },
      });

      if (!dataSource) {
        throw new BadRequestException('Data source not found');
      }
    }

    const dataSource = updateCustomWidgetDto.dataSourceId
      ? await this.prisma.dataSource.findUnique({ where: { id: updateCustomWidgetDto.dataSourceId } })
      : customWidget.dataSource;
    this.validateWidgetContextExtendsDataSource(
      updateCustomWidgetDto.contextSchema ?? (customWidget.contextSchema as Record<string, unknown> | null),
      dataSource?.contextSchema as Record<string, unknown> | null,
    );
    await this.validateFrameworkDraft({
      name: customWidget.name,
      description: customWidget.description || undefined,
      dataSourceId: customWidget.dataSourceId,
      displayType: customWidget.displayType,
      template: customWidget.template || undefined,
      config: customWidget.config as Record<string, unknown>,
      contextSchema: customWidget.contextSchema as Record<string, unknown> | undefined,
      minWidth: customWidget.minWidth,
      minHeight: customWidget.minHeight,
      ...updateCustomWidgetDto,
    }, dataSource?.lastData ?? []);

    const updatedWidget = await this.prisma.customWidget.update({
      where: { id },
      data: {
        name: updateCustomWidgetDto.name,
        description: updateCustomWidgetDto.description,
        dataSourceId: updateCustomWidgetDto.dataSourceId,
        displayType: updateCustomWidgetDto.displayType,
        template: updateCustomWidgetDto.template,
        config: updateCustomWidgetDto.config as object | undefined,
        contextSchema: updateCustomWidgetDto.contextSchema as object | undefined,
        minWidth: updateCustomWidgetDto.minWidth,
        minHeight: updateCustomWidgetDto.minHeight,
      },
      include: {
        dataSource: { select: SAFE_DATASOURCE_SELECT },
      },
    });

    this.logger.log(`Custom widget updated: ${updatedWidget.name}`);

    return updatedWidget;
  }

  /**
   * Delete custom widget
   */
  async remove(id: number) {
    const customWidget = await this.prisma.customWidget.findUnique({
      where: { id },
    });

    if (!customWidget) {
      throw new NotFoundException('Custom widget not found');
    }

    await this.prisma.customWidget.delete({
      where: { id },
    });

    this.logger.log(`Custom widget deleted: ${customWidget.name}`);

    return { message: 'Custom widget deleted successfully' };
  }

  /**
   * Get widget with rendered data
   * Fetches latest data from source and applies template
   */
  async getWithData(id: number, skipFetch = false, renderContext: CustomWidgetRenderContext = {}) {
    const customWidget = await this.prisma.customWidget.findUnique({
      where: { id },
      include: {
        dataSource: { select: SAFE_DATASOURCE_SELECT },
      },
    });

    if (!customWidget) {
      throw new NotFoundException('Custom widget not found');
    }

    const normalizedRenderContext = this.normalizeRenderContext(renderContext);
    if (Object.keys(normalizedRenderContext.ctx || {}).length === 0) {
      normalizedRenderContext.ctx = this.buildContextDefaults(customWidget.contextSchema as Record<string, unknown> | null);
    }

    // Get cached or fresh data from data source
    const data = await this.dataSourcesService.getCachedData(
      customWidget.dataSourceId,
      skipFetch,
      normalizedRenderContext.ctx,
    );

    // Render the data based on display type
    const renderedContent = await this.renderContent(
      customWidget.displayType,
      customWidget.template,
      customWidget.config as Record<string, unknown>,
      data,
      normalizedRenderContext,
    );

    return {
      widget: customWidget,
      data,
      renderedContent,
    };
  }

  async previewDraft(
    draft: CreateCustomWidgetDto | UpdateCustomWidgetDto,
    renderContext: CustomWidgetRenderContext = {},
  ) {
    if (!draft.dataSourceId) {
      throw new BadRequestException('Data source is required');
    }

    const dataSource = await this.prisma.dataSource.findUnique({
      where: { id: draft.dataSourceId },
      select: SAFE_DATASOURCE_SELECT,
    });

    if (!dataSource) {
      throw new BadRequestException('Data source not found');
    }

    const normalizedRenderContext = this.normalizeRenderContext(renderContext);
    if (draft.previewContext && typeof draft.previewContext === 'object' && !Array.isArray(draft.previewContext)) {
      normalizedRenderContext.ctx = draft.previewContext;
    } else if (Object.keys(normalizedRenderContext.ctx || {}).length === 0) {
      normalizedRenderContext.ctx = this.buildContextDefaults(draft.contextSchema);
    }
    this.validateWidgetContextExtendsDataSource(
      draft.contextSchema,
      dataSource.contextSchema as Record<string, unknown> | null,
    );
    const data = await this.dataSourcesService.getCachedData(draft.dataSourceId, true, normalizedRenderContext.ctx);
    await this.validateFrameworkDraft(draft, data, normalizedRenderContext.ctx);

    const renderedContent = await this.renderContent(
      draft.displayType || 'value',
      draft.template || null,
      (draft.config as Record<string, unknown>) || {},
      data,
      normalizedRenderContext,
    );

    return {
      widget: {
        id: 0,
        name: draft.name || 'Preview',
        description: draft.description || '',
        dataSourceId: draft.dataSourceId,
        displayType: draft.displayType || 'value',
        template: draft.template || '',
        config: draft.config || {},
        contextSchema: draft.contextSchema || null,
        minWidth: draft.minWidth || 100,
        minHeight: draft.minHeight || 50,
        createdAt: new Date(),
        updatedAt: new Date(),
        dataSource,
      },
      data,
      renderedContent,
    };
  }

  /**
   * Render content based on display type
   */
  private renderContent(
    displayType: string,
    template: string | null,
    config: Record<string, unknown>,
    data: unknown,
    renderContext: CustomWidgetRenderContext = {},
  ): string | string[] | Record<string, unknown> | Promise<string | string[] | Record<string, unknown>> {
    switch (displayType) {
      case 'value':
        return this.renderValue(config, data);

      case 'list':
        return this.renderList(config, data);

      case 'script':
        return this.renderScript(config, template, data, renderContext.ctx);

      case 'grid':
        return this.renderGrid(config, data, renderContext.ctx);

      case 'framework':
        return this.renderFramework(template, config, data, renderContext);

      default:
        return String(data);
    }
  }

  private renderFramework(
    template: string | null,
    config: Record<string, unknown>,
    data: unknown,
    renderContext: CustomWidgetRenderContext,
  ): Record<string, unknown> | Promise<Record<string, unknown>> {
    const markup = template?.trim();
    if (!markup) {
      return {
        type: 'framework',
        html: '<div class="layout"><span class="label">No framework template</span></div>',
      };
    }

    if (this.shouldRenderFrameworkAsJsx(markup, config)) {
      return this.renderFrameworkJsx(markup, data, renderContext);
    }

    const html = markup.replace(/\{([^{}\n]+)\}/g, (_match, expression: string) => {
      const result = this.scriptExecutor.evaluateExpression(expression.trim(), data, renderContext.ctx);
      if (!result.success) return '';
      const value = result.value;
      if (value === null || value === undefined) return '';
      return this.escapeHtml(String(value));
    });

    return { type: 'framework', html };
  }

  private shouldRenderFrameworkAsJsx(markup: string, config: Record<string, unknown>): boolean {
    if (config.templateMode === 'jsx' || config.frameworkTemplateMode === 'jsx') return true;
    return /\breturn\s*</.test(markup)
      || /\breturn\s*\(/.test(markup)
      || /^\s*(const|let|var|async|return)\b/.test(markup);
  }

  private async renderFrameworkJsx(
    markup: string,
    data: unknown,
    renderContext: CustomWidgetRenderContext,
  ): Promise<Record<string, unknown>> {
    if (!this.frameworkJsxExecutor) return { type: 'framework', html: '' };
    const result = await this.frameworkJsxExecutor.execute(markup, data, renderContext);
    if (!result.success) {
      return { type: 'framework-error', error: result.error || 'Framework template failed' };
    }
    return { type: 'framework-jsx', node: result.node };
  }

  private async validateFrameworkDraft(
    draft: CreateCustomWidgetDto | UpdateCustomWidgetDto,
    sampleData: unknown,
    ctx?: Record<string, unknown>,
  ) {
    const displayType = draft.displayType;
    const template = draft.template?.trim();
    const config = (draft.config || {}) as Record<string, unknown>;
    if (displayType !== 'framework' || !template || !this.shouldRenderFrameworkAsJsx(template, config)) {
      return;
    }

    const rendered = await this.renderFrameworkJsx(template, sampleData, {
      width: draft.minWidth || 540,
      height: draft.minHeight || 330,
      ctx: ctx || this.buildContextDefaults(draft.contextSchema),
    });
    if (rendered.type === 'framework-error') {
      throw new BadRequestException(`Framework JSX validation failed: ${String(rendered.error || 'Unknown error')}`);
    }

    const lintIssues = lintSatoriNode(rendered.node as any);
    if (lintIssues.length > 0) {
      throw new BadRequestException(`Satori JSX lint failed:\n${formatSatoriLintIssues(lintIssues)}`);
    }
  }

  /**
   * Render single value display
   * Config: { field: "price", prefix: "$", suffix: "", label: "Price" }
   */
  private renderValue(
    config: Record<string, unknown>,
    data: unknown,
  ): string | Record<string, unknown> {
    const field = config.field as string;
    const prefix = (config.prefix as string) || '';
    const suffix = (config.suffix as string) || '';
    const label = (config.label as string) || '';

    const rawValue = this.extractField(data, field);

    // Format the value
    let formattedValue: string;
    if (rawValue !== null && typeof rawValue === 'object') {
      formattedValue = `${prefix}${JSON.stringify(rawValue)}${suffix}`;
    } else {
      formattedValue = `${prefix}${rawValue ?? ''}${suffix}`;
    }

    // If label is set, return object with label and value
    if (label) {
      return {
        label,
        value: formattedValue,
      };
    }

    return formattedValue;
  }

  /**
   * Render list display
   * Config: { arrayPath: "rates", itemField: "mid", maxItems: 5, listStyle: "bullet" }
   */
  private renderList(
    config: Record<string, unknown>,
    data: unknown,
  ): string[] {
    const arrayPath = config.arrayPath as string;
    const itemField = config.itemField as string;
    const maxItems = (config.maxItems as number) || 5;
    const listStyle = (config.listStyle as string) || 'bullet';

    // Get array from data using path
    let arrayData: unknown[] = [];

    if (arrayPath) {
      // Use specified array path
      const extracted = this.extractField(data, arrayPath);
      if (Array.isArray(extracted)) {
        arrayData = extracted;
      }
    } else if (Array.isArray(data)) {
      // Root is an array
      arrayData = data;
    } else if (
      typeof data === 'object' &&
      data !== null &&
      'items' in data &&
      Array.isArray((data as Record<string, unknown>).items)
    ) {
      // RSS feed structure fallback
      arrayData = (data as Record<string, unknown>).items as unknown[];
    }

    // Extract items and apply formatting
    return arrayData.slice(0, maxItems).map((item, index) => {
      // Get the value to display
      let value: string;
      if (itemField && typeof item === 'object' && item !== null) {
        const fieldValue = (item as Record<string, unknown>)[itemField];
        value = fieldValue !== undefined ? String(fieldValue) : JSON.stringify(item);
      } else if (typeof item === 'object' && item !== null) {
        value = JSON.stringify(item);
      } else {
        value = String(item);
      }

      // Apply list style prefix
      switch (listStyle) {
        case 'number':
          return `${index + 1}. ${value}`;
        case 'dash':
          return `- ${value}`;
        case 'none':
          return value;
        default: // bullet
          return `• ${value}`;
      }
    });
  }

  /**
   * Render script display type
   * Executes user JavaScript code to transform data
   * Config: { scriptCode: "...", scriptOutputMode: "value" | "template", prefix?, suffix? }
   */
  private renderScript(
    config: Record<string, unknown>,
    template: string | null,
    data: unknown,
    ctx: Record<string, unknown> = {},
  ): string {
    const code = config.scriptCode as string;
    const outputMode = (config.scriptOutputMode as string) || 'value';

    if (!code) {
      return 'No script defined';
    }

    if (outputMode === 'value') {
      const result = this.scriptExecutor.execute(code, data, 'value', ctx);
      if (!result.success) {
        this.logger.warn(`Script error: ${result.error}`);
        return `Error: ${result.error}`;
      }
      const prefix = (config.prefix as string) || '';
      const suffix = (config.suffix as string) || '';
      return `${prefix}${result.value ?? ''}${suffix}`;
    } else {
      // Template mode: execute script to get variables, then apply template
      const result = this.scriptExecutor.execute(code, data, 'template', ctx);
      if (!result.success) {
        this.logger.warn(`Script error: ${result.error}`);
        return `Error: ${result.error}`;
      }
      // Replace {{varName}} with variable values
      const templateStr = template || '';
      return templateStr.replace(/\{\{([^}]+)\}\}/g, (_, varName) => {
        const value = result.variables?.[varName.trim()];
        return value !== undefined ? String(value) : `{{${varName}}}`;
      });
    }
  }

  /**
   * Render grid display type
   * Displays multiple values in a configurable grid layout
   * Config: { gridCols: 2, gridRows: 2, gridGap: 8, gridCells: { "0-0": { field, label, prefix, suffix, fieldType, useScript, script } } }
   */
  private renderGrid(
    config: Record<string, unknown>,
    data: unknown,
    ctx: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const gridCols = (config.gridCols as number) || 2;
    const gridRows = (config.gridRows as number) || 2;
    const gridGap = (config.gridGap as number) || 8;
    const gridCells = (config.gridCells as Record<string, Record<string, unknown>>) || {};

    // Build array of cell data
    const cells: Array<{
      row: number;
      col: number;
      field: string;
      fieldType: string;
      label?: string;
      prefix?: string;
      suffix?: string;
      value: unknown;
      formattedValue: string;
      useScript?: boolean;
      align?: string;
      verticalAlign?: string;
    }> = [];

    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        const cellKey = `${row}-${col}`;
        const cellConfig = gridCells[cellKey];

        if (cellConfig && (cellConfig.field || cellConfig.useScript)) {
          const field = (cellConfig.field as string) || '';
          const useScript = cellConfig.useScript as boolean;
          const script = cellConfig.script as string;

          let rawValue: unknown;
          let formattedValue: string;

          if (useScript && script) {
            // Execute script for this cell
            const result = this.scriptExecutor.execute(script, data, 'value', ctx);
            if (result.success) {
              rawValue = result.value;
              formattedValue = String(result.value ?? '');
            } else {
              this.logger.warn(`Grid cell script error: ${result.error}`);
              rawValue = null;
              formattedValue = `Error: ${result.error}`;
            }
          } else {
            // Standard field extraction with prefix/suffix
            rawValue = this.extractField(data, field);
            const prefix = (cellConfig.prefix as string) || '';
            const suffix = (cellConfig.suffix as string) || '';

            if (rawValue !== null && typeof rawValue === 'object') {
              formattedValue = `${prefix}${JSON.stringify(rawValue)}${suffix}`;
            } else {
              formattedValue = `${prefix}${rawValue ?? ''}${suffix}`;
            }
          }

          cells.push({
            row,
            col,
            field,
            fieldType: (cellConfig.fieldType as string) || 'text',
            label: cellConfig.label as string | undefined,
            prefix: cellConfig.prefix as string | undefined,
            suffix: cellConfig.suffix as string | undefined,
            value: rawValue,
            formattedValue,
            useScript,
            align: (cellConfig.align as string) || 'center',
            verticalAlign: (cellConfig.verticalAlign as string) || 'middle',
          });
        }
      }
    }

    return {
      type: 'grid',
      gridCols,
      gridRows,
      gridGap,
      cells,
    };
  }

  /**
   * Extract field value from data using dot notation
   * Supports: "field", "nested.field", "array[0].field"
   */
  private extractField(data: unknown, path: string): unknown {
    if (!path || data === null || data === undefined) {
      return data;
    }

    const parts = path.split(/\.|(\[\d+\])/).filter(Boolean);
    let current: unknown = data;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }

      // Handle array index: [0]
      const indexMatch = part.match(/\[(\d+)\]/);
      if (indexMatch) {
        const index = parseInt(indexMatch[1], 10);
        if (Array.isArray(current)) {
          current = current[index];
        } else {
          return null;
        }
      } else if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return null;
      }
    }

    return current;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Get all custom widgets as widget templates for the screen designer
   *
   * Custom widget templates use IDs offset by CUSTOM_WIDGET_TEMPLATE_OFFSET
   * to avoid collisions with built-in widget template IDs.
   */
  async getAsWidgetTemplates() {
    const customWidgets = await this.prisma.customWidget.findMany({
      include: {
        dataSource: {
          select: {
            id: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
    });

    return customWidgets.map((widget) => ({
      // Use offset ID to prevent collision with built-in template IDs
      id: CUSTOM_WIDGET_TEMPLATE_OFFSET + widget.id,
      name: `custom-${widget.id}`,
      label: widget.name,
      description: widget.description || `Custom widget using ${widget.dataSource.name}`,
      category: 'custom',
      defaultConfig: {
        // Store the actual widget ID for fetching preview data
        customWidgetId: widget.id,
        displayType: widget.displayType,
        template: widget.template,
        // Default styling settings - ensures consistent rendering
        fontSize: 24,
        fontFamily: 'sans-serif',
        fontWeight: 'normal',
        textAlign: 'center',
        verticalAlign: 'middle',
        color: '#000000',
        ...(widget.config as object),
        contextSchema: widget.contextSchema || undefined,
      },
      minWidth: widget.minWidth,
      minHeight: widget.minHeight,
    }));
  }

  private normalizeRenderContext(renderContext: CustomWidgetRenderContext = {}): CustomWidgetRenderContext {
    const ctx = renderContext.ctx;
    return {
      ...renderContext,
      ctx: ctx && typeof ctx === 'object' && !Array.isArray(ctx) ? ctx : {},
    };
  }

  private buildContextDefaults(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return {};
    const properties = (schema as Record<string, unknown>).properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return {};

    return Object.fromEntries(
      Object.entries(properties as Record<string, Record<string, unknown>>).map(([key, property]) => {
        if (property && Object.prototype.hasOwnProperty.call(property, 'default')) {
          return [key, property.default];
        }
        switch (property?.type) {
          case 'number':
          case 'integer':
            return [key, 0];
          case 'boolean':
            return [key, false];
          case 'array':
            return [key, []];
          case 'object':
            return [key, {}];
          default:
            return [key, ''];
        }
      }),
    );
  }

  private validateWidgetContextExtendsDataSource(widgetSchema: unknown, dataSourceSchema: unknown): void {
    if (!this.hasContextProperties(dataSourceSchema)) return;
    if (!this.hasContextProperties(widgetSchema)) {
      throw new BadRequestException('Widget context schema must include the selected data source context schema');
    }

    const dataSourceProperties = (dataSourceSchema as Record<string, any>).properties as Record<string, unknown>;
    const widgetProperties = (widgetSchema as Record<string, any>).properties as Record<string, unknown>;

    for (const [key, dataSourceProperty] of Object.entries(dataSourceProperties)) {
      if (!Object.prototype.hasOwnProperty.call(widgetProperties, key)) {
        throw new BadRequestException(`Widget context schema is missing data source context property: ${key}`);
      }
      if (this.stableStringify(widgetProperties[key]) !== this.stableStringify(dataSourceProperty)) {
        throw new BadRequestException(`Widget context property must match data source schema: ${key}`);
      }
    }

    const dataSourceRequired = new Set(Array.isArray((dataSourceSchema as Record<string, any>).required)
      ? (dataSourceSchema as Record<string, any>).required
      : []);
    const widgetRequired = new Set(Array.isArray((widgetSchema as Record<string, any>).required)
      ? (widgetSchema as Record<string, any>).required
      : []);

    for (const key of dataSourceRequired) {
      if (!widgetRequired.has(key)) {
        throw new BadRequestException(`Widget context schema must require data source context property: ${key}`);
      }
    }
  }

  private hasContextProperties(schema: unknown): schema is Record<string, unknown> {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
    const properties = (schema as Record<string, unknown>).properties;
    return !!properties && typeof properties === 'object' && !Array.isArray(properties) && Object.keys(properties).length > 0;
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      return `{${Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${this.stableStringify((value as Record<string, unknown>)[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }
}
