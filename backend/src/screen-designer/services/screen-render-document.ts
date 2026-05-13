export type JsxChild = JsxElement | string | number | boolean | null | undefined;
export const Fragment = 'fragment';

export interface JsxElement {
  type: string;
  props: Record<string, any>;
  children: JsxChild[];
}

export interface ScreenRenderDocument {
  width: number;
  height: number;
  root: JsxElement;
  rootHtml: string;
  html: string;
}

export function jsx(type: string, props: Record<string, any> | null, ...children: JsxChild[]): JsxElement {
  const nextProps = { ...(props || {}) };
  const propChildren = nextProps.children;
  delete nextProps.children;

  return {
    type,
    props: nextProps,
    children: normalizeChildren(children.length > 0 ? children : propChildren),
  };
}

declare global {
  namespace JSX {
    type Element = JsxElement;
    interface IntrinsicElements {
      [elementName: string]: Record<string, any>;
    }
  }
}

export function renderDocumentHtml(root: JsxElement, fontStyleTag: string): ScreenRenderDocument['html'] {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${fontStyleTag}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      margin: 0;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
    }
  </style>
</head>
<body>
  ${renderJsxToHtml(root)}
</body>
</html>`;
}

export function renderJsxToHtml(node: JsxChild): string {
  if (node === null || node === undefined || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return escapeHtml(String(node));

  const { type, props, children } = node;
  if (type === Fragment) return children.map(renderJsxToHtml).join('');

  const attributes: string[] = [];

  for (const [key, rawValue] of Object.entries(props)) {
    if (
      key === 'children'
      || key === 'dangerouslySetInnerHTML'
      || rawValue === null
      || rawValue === undefined
      || rawValue === false
    ) {
      continue;
    }

    const attrName = key === 'className' ? 'class' : key;
    if (key === 'style') {
      attributes.push(`style="${escapeAttribute(styleToCss(rawValue))}"`);
    } else if (rawValue === true) {
      attributes.push(attrName);
    } else {
      attributes.push(`${attrName}="${escapeAttribute(String(rawValue))}"`);
    }
  }

  const html = props.dangerouslySetInnerHTML?.__html !== undefined
    ? String(props.dangerouslySetInnerHTML.__html)
    : children.map(renderJsxToHtml).join('');

  return `<${type}${attributes.length ? ` ${attributes.join(' ')}` : ''}>${html}</${type}>`;
}

function normalizeChildren(children: JsxChild | JsxChild[]): JsxChild[] {
  if (children === null || children === undefined) return [];
  return (Array.isArray(children) ? children : [children]).flat();
}

function styleToCss(style: Record<string, any> | string): string {
  if (typeof style === 'string') return style;
  return Object.entries(style)
    .filter(([, value]) => value !== null && value !== undefined && value !== false)
    .map(([key, value]) => `${toKebabCase(key)}: ${String(value)};`)
    .join(' ');
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
