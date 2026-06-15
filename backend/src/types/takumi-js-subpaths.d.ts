declare module 'takumi-js/node' {
  export * from '@takumi-rs/core';
}

declare module 'takumi-js/helpers/html' {
  import type { Node } from '@takumi-rs/helpers';

  export function fromHtml(html: string): {
    node: Node;
    stylesheets: string[];
  };
}
