import { PrismaClient } from '@prisma/client';

type JsonObject = Record<string, any>;
type ToolHandler = (args: JsonObject) => Promise<unknown>;

const prisma = new PrismaClient();

const textDecoder = new TextDecoder();
let inputBuffer = Buffer.alloc(0);

function send(message: JsonObject) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function ok(id: unknown, result: unknown) {
  send({ jsonrpc: '2.0', id, result });
}

function fail(id: unknown, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  send({
    jsonrpc: '2.0',
    id,
    error: { code: -32000, message },
  });
}

function toolResult(value: unknown) {
  return {
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function asInt(value: unknown, name: string): number {
  const num = Number(value);
  if (!Number.isInteger(num)) throw new Error(`${name} must be an integer`);
  return num;
}

function cleanUndefined<T extends JsonObject>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
}

async function resolveWidgetTemplate(args: JsonObject) {
  if (args.customWidgetId !== undefined) {
    const customWidgetId = asInt(args.customWidgetId, 'customWidgetId');
    const customWidget = await prisma.customWidget.findUnique({ where: { id: customWidgetId } });
    if (!customWidget) throw new Error('Custom widget not found');
    const template = await prisma.widgetTemplate.findUnique({ where: { name: 'custom-widget-base' } });
    if (!template) throw new Error('Custom widget base template not found; run db seed');
    return {
      template,
      config: { ...(args.config ?? {}), customWidgetId, displayType: customWidget.displayType },
    };
  }

  const template = args.templateId !== undefined
    ? await prisma.widgetTemplate.findUnique({ where: { id: asInt(args.templateId, 'templateId') } })
    : await prisma.widgetTemplate.findUnique({ where: { name: String(args.templateName || '') } });
  if (!template) throw new Error('Widget template not found');
  return {
    template,
    config: { ...(template.defaultConfig as JsonObject), ...(args.config ?? {}) },
  };
}

async function includeScreenDesign(id: number) {
  const design = await prisma.screenDesign.findUnique({
    where: { id },
    include: {
      widgets: { include: { template: true }, orderBy: { zIndex: 'asc' } },
      playlistItems: true,
    },
  });
  if (!design) throw new Error('Screen design not found');
  return design;
}

const tools: Record<string, { description: string; inputSchema: JsonObject; handler: ToolHandler }> = {
  list_widget_templates: {
    description: 'List built-in widget templates and custom widgets available for screen designs.',
    inputSchema: {
      type: 'object',
      properties: {
        includeCustom: { type: 'boolean', default: true },
      },
    },
    async handler(args) {
      const templates = await prisma.widgetTemplate.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
      if (args.includeCustom === false) return templates;
      const customWidgets = await prisma.customWidget.findMany({ select: { id: true, name: true, description: true, displayType: true, minWidth: true, minHeight: true } });
      return {
        templates,
        customWidgets: customWidgets.map((widget) => ({
          ...widget,
          templateName: 'custom-widget-base',
          customWidgetId: widget.id,
        })),
      };
    },
  },

  create_screen_design: {
    description: 'Create a screen design, optionally with initial widgets.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        width: { type: 'integer', default: 800 },
        height: { type: 'integer', default: 480 },
        background: { type: 'string', default: '#FFFFFF' },
        widgets: { type: 'array', items: { type: 'object' } },
      },
    },
    async handler(args) {
      const widgets = Array.isArray(args.widgets) ? args.widgets : [];
      const createWidgets: JsonObject[] = [];
      for (const widget of widgets) {
        const resolved = await resolveWidgetTemplate(widget);
        createWidgets.push({
          templateId: resolved.template.id,
          x: widget.x ?? 0,
          y: widget.y ?? 0,
          width: widget.width ?? resolved.template.minWidth,
          height: widget.height ?? resolved.template.minHeight,
          rotation: widget.rotation ?? 0,
          zIndex: widget.zIndex ?? createWidgets.length,
          config: resolved.config,
        });
      }
      const design = await prisma.screenDesign.create({
        data: {
          name: String(args.name),
          description: args.description,
          width: args.width ?? 800,
          height: args.height ?? 480,
          background: args.background ?? '#FFFFFF',
          widgets: createWidgets.length ? { create: createWidgets as any } : undefined,
        },
      });
      return includeScreenDesign(design.id);
    },
  },

  list_screen_designs: {
    description: 'List screen designs with widgets.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', default: 20 } } },
    async handler(args) {
      return prisma.screenDesign.findMany({
        take: Math.min(asInt(args.limit ?? 20, 'limit'), 100),
        orderBy: { updatedAt: 'desc' },
        include: { widgets: { include: { template: true }, orderBy: { zIndex: 'asc' } } },
      });
    },
  },

  get_screen_design: {
    description: 'Get one screen design with widgets.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    async handler(args) {
      return includeScreenDesign(asInt(args.id, 'id'));
    },
  },

  update_screen_design: {
    description: 'Update screen design metadata. Use widget tools for widget edits.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
        description: { type: 'string' },
        width: { type: 'integer' },
        height: { type: 'integer' },
        background: { type: 'string' },
      },
    },
    async handler(args) {
      const id = asInt(args.id, 'id');
      await prisma.screenDesign.update({
        where: { id },
        data: cleanUndefined({
          name: args.name,
          description: args.description,
          width: args.width,
          height: args.height,
          background: args.background,
        }),
      });
      return includeScreenDesign(id);
    },
  },

  delete_screen_design: {
    description: 'Delete a screen design and its widgets.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    async handler(args) {
      const id = asInt(args.id, 'id');
      await prisma.screenDesign.delete({ where: { id } });
      return { deleted: true, id };
    },
  },

  add_widget: {
    description: 'Add a widget to a screen design. Use templateName/templateId or customWidgetId.',
    inputSchema: {
      type: 'object',
      required: ['screenDesignId'],
      properties: {
        screenDesignId: { type: 'integer' },
        templateName: { type: 'string' },
        templateId: { type: 'integer' },
        customWidgetId: { type: 'integer' },
        x: { type: 'integer' },
        y: { type: 'integer' },
        width: { type: 'integer' },
        height: { type: 'integer' },
        zIndex: { type: 'integer' },
        rotation: { type: 'integer' },
        config: { type: 'object' },
      },
    },
    async handler(args) {
      const screenDesignId = asInt(args.screenDesignId, 'screenDesignId');
      const design = await prisma.screenDesign.findUnique({ where: { id: screenDesignId } });
      if (!design) throw new Error('Screen design not found');
      const resolved = await resolveWidgetTemplate(args);
      const widget = await prisma.screenWidget.create({
        data: {
          screenDesignId,
          templateId: resolved.template.id,
          x: args.x ?? 0,
          y: args.y ?? 0,
          width: args.width ?? resolved.template.minWidth,
          height: args.height ?? resolved.template.minHeight,
          zIndex: args.zIndex ?? 0,
          rotation: args.rotation ?? 0,
          config: resolved.config,
        },
        include: { template: true },
      });
      return widget;
    },
  },

  update_widget: {
    description: 'Update a widget position, size, z-index, rotation, or config.',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'integer' },
        x: { type: 'integer' },
        y: { type: 'integer' },
        width: { type: 'integer' },
        height: { type: 'integer' },
        zIndex: { type: 'integer' },
        rotation: { type: 'integer' },
        config: { type: 'object' },
      },
    },
    async handler(args) {
      const id = asInt(args.id, 'id');
      return prisma.screenWidget.update({
        where: { id },
        data: cleanUndefined({
          x: args.x,
          y: args.y,
          width: args.width,
          height: args.height,
          zIndex: args.zIndex,
          rotation: args.rotation,
          config: args.config,
        }),
        include: { template: true },
      });
    },
  },

  delete_widget: {
    description: 'Delete a widget from a screen design.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    async handler(args) {
      const id = asInt(args.id, 'id');
      await prisma.screenWidget.delete({ where: { id } });
      return { deleted: true, id };
    },
  },

  create_data_source: {
    description: 'Create a JSON or RSS data source.',
    inputSchema: {
      type: 'object',
      required: ['name', 'type', 'url'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string', enum: ['json', 'rss'] },
        url: { type: 'string' },
        method: { type: 'string', enum: ['GET', 'POST'], default: 'GET' },
        headers: { type: 'object' },
        refreshInterval: { type: 'integer', default: 300 },
        jsonPath: { type: 'string' },
        isActive: { type: 'boolean', default: true },
      },
    },
    async handler(args) {
      return prisma.dataSource.create({
        data: {
          name: String(args.name),
          description: args.description,
          type: String(args.type),
          url: String(args.url),
          method: args.method ?? 'GET',
          headers: args.headers,
          refreshInterval: args.refreshInterval ?? 300,
          jsonPath: args.jsonPath,
          isActive: args.isActive ?? true,
        },
      });
    },
  },

  list_data_sources: {
    description: 'List data sources.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', default: 50 } } },
    async handler(args) {
      return prisma.dataSource.findMany({
        take: Math.min(asInt(args.limit ?? 50, 'limit'), 100),
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { customWidgets: true } } },
      });
    },
  },

  update_data_source: {
    description: 'Update a data source.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    async handler(args) {
      const id = asInt(args.id, 'id');
      return prisma.dataSource.update({
        where: { id },
        data: cleanUndefined({
          name: args.name,
          description: args.description,
          type: args.type,
          url: args.url,
          method: args.method,
          headers: args.headers,
          refreshInterval: args.refreshInterval,
          jsonPath: args.jsonPath,
          isActive: args.isActive,
        }),
      });
    },
  },

  delete_data_source: {
    description: 'Delete a data source.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    async handler(args) {
      const id = asInt(args.id, 'id');
      await prisma.dataSource.delete({ where: { id } });
      return { deleted: true, id };
    },
  },

  create_custom_widget: {
    description: 'Create a custom widget backed by a data source. displayType supports value, list, script, grid, framework.',
    inputSchema: {
      type: 'object',
      required: ['name', 'dataSourceId', 'displayType'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        dataSourceId: { type: 'integer' },
        displayType: { type: 'string', enum: ['value', 'list', 'script', 'grid', 'framework'] },
        template: { type: 'string' },
        config: { type: 'object' },
        minWidth: { type: 'integer', default: 100 },
        minHeight: { type: 'integer', default: 50 },
      },
    },
    async handler(args) {
      return prisma.customWidget.create({
        data: {
          name: String(args.name),
          description: args.description,
          dataSourceId: asInt(args.dataSourceId, 'dataSourceId'),
          displayType: String(args.displayType),
          template: args.template,
          config: args.config ?? {},
          minWidth: args.minWidth ?? 100,
          minHeight: args.minHeight ?? 50,
        },
        include: { dataSource: true },
      });
    },
  },

  list_custom_widgets: {
    description: 'List custom widgets.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', default: 50 } } },
    async handler(args) {
      return prisma.customWidget.findMany({
        take: Math.min(asInt(args.limit ?? 50, 'limit'), 100),
        orderBy: { updatedAt: 'desc' },
        include: { dataSource: { select: { id: true, name: true, type: true, isActive: true } } },
      });
    },
  },

  update_custom_widget: {
    description: 'Update a custom widget.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    async handler(args) {
      const id = asInt(args.id, 'id');
      return prisma.customWidget.update({
        where: { id },
        data: cleanUndefined({
          name: args.name,
          description: args.description,
          dataSourceId: args.dataSourceId,
          displayType: args.displayType,
          template: args.template,
          config: args.config,
          minWidth: args.minWidth,
          minHeight: args.minHeight,
        }),
      });
    },
  },

  delete_custom_widget: {
    description: 'Delete a custom widget.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    async handler(args) {
      const id = asInt(args.id, 'id');
      await prisma.customWidget.delete({ where: { id } });
      return { deleted: true, id };
    },
  },

  create_playlist: {
    description: 'Create a playlist with screen/design/composer items.',
    inputSchema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean', default: true },
        items: { type: 'array', items: { type: 'object' } },
      },
    },
    async handler(args) {
      const playlist = await prisma.playlist.create({
        data: { name: String(args.name), description: args.description, isActive: args.isActive ?? true },
      });
      if (Array.isArray(args.items) && args.items.length) {
        await prisma.playlistItem.createMany({
          data: args.items.map((item: JsonObject, index: number) => ({
            playlistId: playlist.id,
            kind: item.kind ?? (item.config?.items ? 'composer' : 'screen'),
            screenId: item.screenId,
            screenDesignId: item.screenDesignId,
            pluginInstanceId: item.pluginInstanceId,
            config: item.config,
            order: item.order ?? index,
            duration: item.duration ?? 60,
          })),
        });
      }
      return prisma.playlist.findUnique({
        where: { id: playlist.id },
        include: { items: { include: { screen: true, screenDesign: true, pluginInstance: true }, orderBy: { order: 'asc' } } },
      });
    },
  },

  list_playlists: {
    description: 'List playlists.',
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', default: 50 } } },
    async handler(args) {
      return prisma.playlist.findMany({
        take: Math.min(asInt(args.limit ?? 50, 'limit'), 100),
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { items: true, devices: true } } },
      });
    },
  },

  get_playlist: {
    description: 'Get playlist with items.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    async handler(args) {
      return prisma.playlist.findUniqueOrThrow({
        where: { id: asInt(args.id, 'id') },
        include: { items: { include: { screen: true, screenDesign: true, pluginInstance: true }, orderBy: { order: 'asc' } }, devices: true },
      });
    },
  },

  update_playlist: {
    description: 'Update playlist metadata. Pass items to replace playlist items.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' }, items: { type: 'array', items: { type: 'object' } } } },
    async handler(args) {
      const id = asInt(args.id, 'id');
      await prisma.playlist.update({
        where: { id },
        data: cleanUndefined({ name: args.name, description: args.description, isActive: args.isActive }),
      });
      if (Array.isArray(args.items)) {
        await prisma.playlistItem.deleteMany({ where: { playlistId: id } });
        if (args.items.length) {
          await prisma.playlistItem.createMany({
            data: args.items.map((item: JsonObject, index: number) => ({
              playlistId: id,
              kind: item.kind ?? (item.config?.items ? 'composer' : 'screen'),
              screenId: item.screenId,
              screenDesignId: item.screenDesignId,
              pluginInstanceId: item.pluginInstanceId,
              config: item.config,
              order: item.order ?? index,
              duration: item.duration ?? 60,
            })),
          });
        }
      }
      return tools.get_playlist.handler({ id });
    },
  },

  delete_playlist: {
    description: 'Delete a playlist.',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
    async handler(args) {
      const id = asInt(args.id, 'id');
      await prisma.playlist.delete({ where: { id } });
      return { deleted: true, id };
    },
  },
};

function toolList() {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}

async function handle(message: JsonObject) {
  if (!message.id && message.method?.startsWith('notifications/')) return;
  try {
    switch (message.method) {
      case 'initialize':
        ok(message.id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'inker-mcp', version: '0.1.0' },
        });
        return;
      case 'tools/list':
        ok(message.id, { tools: toolList() });
        return;
      case 'tools/call': {
        const name = message.params?.name;
        const tool = tools[name];
        if (!tool) throw new Error(`Unknown tool: ${name}`);
        const result = await tool.handler(message.params?.arguments ?? {});
        ok(message.id, toolResult(result));
        return;
      }
      default:
        throw new Error(`Unsupported method: ${message.method}`);
    }
  } catch (error) {
    fail(message.id, error);
  }
}

function consumeMessages() {
  while (true) {
    const newlineEnd = inputBuffer.indexOf('\n');
    const headerEnd = inputBuffer.indexOf('\r\n\r\n');

    if (newlineEnd !== -1 && (headerEnd === -1 || newlineEnd < headerEnd)) {
      const line = textDecoder.decode(inputBuffer.subarray(0, newlineEnd)).trim();
      inputBuffer = inputBuffer.subarray(newlineEnd + 1);
      if (line) void handle(JSON.parse(line));
      continue;
    }

    if (headerEnd === -1) return;

    const header = textDecoder.decode(inputBuffer.subarray(0, headerEnd));
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) {
      inputBuffer = inputBuffer.subarray(headerEnd + 4);
      continue;
    }

    const contentLength = Number(lengthMatch[1]);
    const bodyStart = headerEnd + 4;
    const bodyEnd = bodyStart + contentLength;
    if (inputBuffer.length < bodyEnd) return;

    const body = textDecoder.decode(inputBuffer.subarray(bodyStart, bodyEnd));
    inputBuffer = inputBuffer.subarray(bodyEnd);
    void handle(JSON.parse(body));
  }
}

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, Buffer.from(chunk)]);
  consumeMessages();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.stderr.write('Inker MCP server ready\n');
