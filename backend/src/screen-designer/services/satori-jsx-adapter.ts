import {
  DOCUMENT_NODE,
  ELEMENT_NODE,
  TEXT_NODE,
  parse,
  type Node as UltraHtmlNode,
} from 'ultrahtml';
import { Fragment, type JsxChild } from './screen-render-document';

export function renderJsxToSatoriNode(node: JsxChild): any {
  if (node === null || node === undefined || node === false || node === true) return null;
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node.type === Fragment) return normalize(node.children.map(renderJsxToSatoriNode));

  const props: Record<string, any> = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (
      key === 'children'
      || key === 'dangerouslySetInnerHTML'
      || value === null
      || value === undefined
      || value === false
      || key === 'className'
    ) {
      continue;
    }
    props[key] = key === 'style' ? styleToObject(value) : value;
  }

  props.children = node.props.dangerouslySetInnerHTML?.__html !== undefined
    ? parseHtmlFragmentToSatoriChildren(String(node.props.dangerouslySetInnerHTML.__html))
    : normalize(node.children.map(renderJsxToSatoriNode));
  ensureDisplayForSatori(node.type, props);

  return { type: node.type, props };
}

function parseHtmlFragmentToSatoriChildren(markup: string): any {
  const document = parse(`<div>${markup}</div>`);
  const wrapper = document.children?.find((child: UltraHtmlNode) => child.type === ELEMENT_NODE);
  return normalize((wrapper?.children || []).map(ultraHtmlNodeToSatori));
}

function ultraHtmlNodeToSatori(node: UltraHtmlNode): any {
  if (node.type === TEXT_NODE) {
    const value = String(node.value || '').replace(/\s+/g, ' ').trim();
    return value || null;
  }
  if (node.type === DOCUMENT_NODE) return normalize((node.children || []).map(ultraHtmlNodeToSatori));
  if (node.type !== ELEMENT_NODE || node.name === 'style' || node.name === 'script') return null;

  const props: Record<string, any> = {};
  for (const [key, value] of Object.entries(node.attributes || {})) {
    if (key === 'class') continue;
    props[toCamelCase(key)] = key === 'style' ? styleToObject(value) : value;
  }
  props.children = normalize((node.children || []).map(ultraHtmlNodeToSatori));
  ensureDisplayForSatori(node.name, props);
  return { type: node.name, props };
}

function ensureDisplayForSatori(type: string, props: Record<string, any>) {
  if (type !== 'div') return;
  props.style = props.style || {};
  if (!props.style.display) {
    props.style.display = 'flex';
    props.style.flexDirection = 'column';
  }
}

function styleToObject(style: Record<string, any> | string): Record<string, any> {
  if (typeof style !== 'string') return style;
  return style
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce<Record<string, any>>((result, declaration) => {
      const separator = declaration.indexOf(':');
      if (separator === -1) return result;
      result[toCamelCase(declaration.slice(0, separator).trim())] = declaration.slice(separator + 1).trim();
      return result;
    }, {});
}

function normalize(children: any[]): any {
  const normalized = children
    .filter(child => child !== null && child !== undefined && child !== '')
    .filter(child => typeof child !== 'string' || child.trim() !== '');
  if (normalized.length === 0) return [];
  if (normalized.length === 1) return normalized[0];
  return normalized;
}

function toCamelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
}
