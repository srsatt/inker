import { describe, expect, it } from 'bun:test';
import { renderJsxToHtml } from '../../screen-designer/services/screen-render-document';
import { FrameworkJsxExecutorService } from './framework-jsx-executor.service';

describe('FrameworkJsxExecutorService', () => {
  const service = new FrameworkJsxExecutorService({ get: async () => 'false' } as any);

  it('renders TSX with data manipulation', async () => {
    const result = await service.execute(
      `
        const rows = $.items.map(item => <div>{item.name.toUpperCase()}</div>);
        return <div style={{display: 'flex', flexDirection: 'column'}}>{rows}</div>;
      `,
      { items: [{ name: 'one' }, { name: 'two' }] },
    );

    expect(result.success).toBe(true);
    expect(renderJsxToHtml(result.node as any)).toContain('ONE');
    expect(renderJsxToHtml(result.node as any)).toContain('TWO');
  });

  it('exposes widget dimensions to the template', async () => {
    const result = await service.execute(
      'return <div>{widget.width}x{widget.height}</div>;',
      {},
      { width: 320, height: 180 },
    );

    expect(result.success).toBe(true);
    expect(renderJsxToHtml(result.node as any)).toContain('320x180');
  });

  it('blocks raw fetch and leaves fetchJson as the explicit helper', async () => {
    const result = await service.execute('return await fetch("https://example.com");', {});

    expect(result.success).toBe(false);
    expect(result.error).toContain('forbidden keyword');
  });
});
